import { auth } from "@clerk/nextjs/server";

export type RunStatus = "queued" | "running" | "completed" | "failed";
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

export interface RunDetail {
  id: string;
  question: string;
  status: RunStatus;
  summary: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  claims: RunClaim[];
  sources: RunSource[];
}

export class GatewayUnavailableError extends Error {}

function gatewayUrl(): string | null {
  return process.env.NEXT_PUBLIC_GATEWAY_URL ?? null;
}

/** True when a gateway is configured; the dashboard degrades gracefully when not. */
export function isGatewayConfigured(): boolean {
  return gatewayUrl() !== null;
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
  const response = await authedFetch("/api/runs");
  if (!response.ok) throw new Error(`gateway returned ${response.status}`);
  return response.json();
}

export async function getRun(runId: string): Promise<RunDetail | null> {
  const response = await authedFetch(`/api/runs/${runId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`gateway returned ${response.status}`);
  return response.json();
}
