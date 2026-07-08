import type { Confidence, RunStatus } from "@/lib/gateway";

const statusStyles: Record<RunStatus, { dot: string; label: string }> = {
  queued: { dot: "bg-ink-muted", label: "Queued" },
  running: { dot: "bg-accent animate-pulse", label: "Researching" },
  completed: { dot: "bg-confidence-high", label: "Complete" },
  failed: { dot: "bg-confidence-low", label: "Failed" },
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
