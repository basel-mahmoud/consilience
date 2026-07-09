import { auth, currentUser } from "@clerk/nextjs/server";
import { demoModeEnabled } from "@/lib/db";

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "rate_limited"
  | "awaiting_approval"
  | "rejected";
export type Confidence = "high" | "mid" | "low";

export interface RunListItem {
  id: string;
  question: string;
  status: RunStatus;
  createdAt: string;
  completedAt: string | null;
  claimCount: number;
  sourceCount: number;
}

export interface RunClaim {
  position: number;
  text: string;
  confidence: Confidence;
  sourcePositions: number[];
  agent: string | null;
}

export interface RunSource {
  position: number;
  url: string;
  title: string | null;
  credibility: Confidence | null;
  agent: string | null;
}

export interface RunContradiction {
  claimA: number;
  claimB: number;
  explanation: string;
}

export interface RunEvaluation {
  metric: string;
  score: number;
  rationale: string;
}

export interface RunTraceEvent {
  seq: number;
  type: string;
  message: string;
  at: string;
}

export interface RunDetail {
  id: string;
  question: string;
  status: RunStatus;
  summary: string | null;
  error: string | null;
  approvalReason: string | null;
  createdAt: string;
  completedAt: string | null;
  claims: RunClaim[];
  sources: RunSource[];
  contradictions: RunContradiction[];
  evaluations: RunEvaluation[];
  // Populated in demo mode (serverless); gateway mode streams these over SignalR
  trace?: RunTraceEvent[];
}

export class GatewayUnavailableError extends Error {}

function gatewayUrl(): string | null {
  return process.env.NEXT_PUBLIC_GATEWAY_URL ?? null;
}

/** True when a gateway is configured; the dashboard degrades gracefully when not. */
export function isGatewayConfigured(): boolean {
  return gatewayUrl() !== null;
}

/** True when runs can be created — via the gateway, or serverless demo mode. */
export function isBackendAvailable(): boolean {
  return isGatewayConfigured() || demoModeEnabled();
}

async function clerkIdentity(): Promise<{ id: string; email: string | null }> {
  const user = await currentUser();
  if (!user) throw new Error("not authenticated");
  return { id: user.id, email: user.primaryEmailAddress?.emailAddress ?? null };
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = gatewayUrl();
  if (!base) throw new GatewayUnavailableError("gateway not configured");
  const { getToken } = await auth();
  const token = await getToken();
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (cause) {
    throw new GatewayUnavailableError("gateway unreachable", { cause });
  }
}

export async function listRuns(): Promise<RunListItem[]> {
  if (!isGatewayConfigured() && demoModeEnabled()) {
    const { id, email } = await clerkIdentity();
    const demo = await import("@/lib/demo");
    return demo.listRuns(id, email);
  }
  const response = await authedFetch("/api/runs");
  if (!response.ok) throw new Error(`gateway returned ${response.status}`);
  return response.json();
}

export async function getRun(runId: string): Promise<RunDetail | null> {
  if (!isGatewayConfigured() && demoModeEnabled()) {
    const { id, email } = await clerkIdentity();
    const demo = await import("@/lib/demo");
    return demo.getRun(id, email, runId);
  }
  const response = await authedFetch(`/api/runs/${runId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`gateway returned ${response.status}`);
  return response.json();
}
