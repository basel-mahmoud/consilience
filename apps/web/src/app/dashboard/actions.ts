"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export type CreateRunState = { error: string | null };

export async function createRun(
  _prev: CreateRunState,
  formData: FormData,
): Promise<CreateRunState> {
  const question = String(formData.get("question") ?? "").trim();
  if (question.length < 10 || question.length > 500) {
    return { error: "Ask a question between 10 and 500 characters." };
  }

  const base = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!base) {
    return { error: "The research gateway isn't configured in this environment yet." };
  }

  let runId: string;
  try {
    const { getToken } = await auth();
    const token = await getToken();
    const response = await fetch(`${base}/api/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 429) {
      return { error: "You already have the maximum number of runs in flight. Let one finish first." };
    }
    if (!response.ok) {
      return { error: "Couldn't start the run. Please try again in a moment." };
    }
    ({ runId } = await response.json());
  } catch {
    return { error: "The research gateway is unreachable right now." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/runs/${runId}`);
}
