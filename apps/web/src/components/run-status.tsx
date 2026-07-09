import type { Confidence, RunStatus } from "@/lib/gateway";

const statusStyles: Record<RunStatus, { dot: string; label: string }> = {
  queued: { dot: "bg-ink-muted", label: "Queued" },
  running: { dot: "bg-accent animate-pulse", label: "Researching" },
  completed: { dot: "bg-confidence-high", label: "Complete" },
  failed: { dot: "bg-confidence-low", label: "Failed" },
  rate_limited: { dot: "bg-confidence-mid", label: "Rate limited" },
  awaiting_approval: { dot: "bg-confidence-mid animate-pulse", label: "Awaiting approval" },
  rejected: { dot: "bg-ink-muted", label: "Rejected" },
};

export function StatusPill({ status }: { status: RunStatus }) {
  const { dot, label } = statusStyles[status];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

const confidenceStyles: Record<Confidence, { text: string; label: string }> = {
  high: { text: "text-confidence-high", label: "High confidence" },
  mid: { text: "text-confidence-mid", label: "Medium confidence" },
  low: { text: "text-confidence-low", label: "Low confidence" },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { text, label } = confidenceStyles[confidence];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${text}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

const credibilityStyles: Record<Confidence, string> = {
  high: "text-confidence-high",
  mid: "text-confidence-mid",
  low: "text-confidence-low",
};

export function CredibilityDot({ credibility }: { credibility: Confidence }) {
  return (
    <span
      title={`${credibility} credibility source`}
      className={`inline-flex items-center gap-1 font-mono text-[11px] uppercase ${credibilityStyles[credibility]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {credibility}
    </span>
  );
}

export function AgentTag({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
      {label}
    </span>
  );
}
