"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isGatewayConfigured } from "@/lib/gateway";
import { demoModeEnabled } from "@/lib/db";
import { requiresApproval } from "@/lib/research";

export type CreateRunState = { error: string | null };

async function identity() {
  const user = await currentUser();
  if (!user) throw new Error("not authenticated");
  return { id: user.id, email: user.primaryEmailAddress?.emailAddress ?? null };
}

async function postToGateway(path: string): Promise<{ ok: boolean }> {
  const base = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!base) return { ok: false };
  try {
    const { getToken } = await auth();
    const token = await getToken();
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function createRun(
  _prev: CreateRunState,
  formData: FormData,
): Promise<CreateRunState> {
  const question = String(formData.get("question") ?? "").trim();
  if (question.length < 10 || question.length > 500) {
    return { error: "Ask a question between 10 and 500 characters." };
  }

  let runId: string;

  if (!isGatewayConfigured() && demoModeEnabled()) {
    const { id, email } = await identity();
    const reason = requiresApproval(question);
    const demo = await import("@/lib/demo");
    const res = await demo.createRun(id, email, question, reason);
    if ("error" in res) {
      return { error: "You already have the maximum number of runs in flight. Let one finish first." };
    }
    // Run the research in the background; the run page polls until it completes
    if (!res.awaiting) after(() => demo.executeRun(res.runId, res.userId, question));
    runId = res.runId;
  } else {
    const base = process.env.NEXT_PUBLIC_GATEWAY_URL;
    if (!base) return { error: "The research gateway isn't configured in this environment yet." };
    try {
      const { getToken } = await auth();
      const token = await getToken();
      const response = await fetch(`${base}/api/runs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 429) {
        return { error: "You already have the maximum number of runs in flight. Let one finish first." };
      }
      if (!response.ok) return { error: "Couldn't start the run. Please try again in a moment." };
      ({ runId } = await response.json());
    } catch {
      return { error: "The research gateway is unreachable right now." };
    }
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/runs/${runId}`);
}

export async function approveRun(runId: string): Promise<void> {
  if (!isGatewayConfigured() && demoModeEnabled()) {
    const { id, email } = await identity();
    const demo = await import("@/lib/demo");
    const approved = await demo.approveRun(id, email, runId);
    if (approved) after(() => demo.executeRun(runId, approved.userId, approved.question));
  } else {
    await postToGateway(`/api/runs/${runId}/approve`);
  }
  revalidatePath(`/dashboard/runs/${runId}`);
}

export async function deleteAccountData(): Promise<{ ok: boolean }> {
  if (!isGatewayConfigured() && demoModeEnabled()) {
    const { id } = await identity();
    const demo = await import("@/lib/demo");
    await demo.deleteAccount(id);
    return { ok: true };
  }
  const base = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!base) return { ok: true };
  try {
    const { getToken } = await auth();
    const token = await getToken();
    const res = await fetch(`${base}/api/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function rejectRun(runId: string): Promise<void> {
  if (!isGatewayConfigured() && demoModeEnabled()) {
    const { id, email } = await identity();
    const demo = await import("@/lib/demo");
    await demo.rejectRun(id, email, runId);
  } else {
    await postToGateway(`/api/runs/${runId}/reject`);
  }
  revalidatePath(`/dashboard/runs/${runId}`);
}
