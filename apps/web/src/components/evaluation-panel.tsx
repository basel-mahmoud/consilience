import type { RunEvaluation } from "@/lib/gateway";

const labels: Record<string, string> = {
  grounding: "Grounding",
  source_quality: "Source quality",
  consistency: "Consistency",
  corroboration: "Corroboration",
};

function tone(score: number): string {
  if (score >= 0.75) return "text-confidence-high";
  if (score >= 0.5) return "text-confidence-mid";
  return "text-confidence-low";
}

export function EvaluationPanel({ evaluations }: { evaluations: RunEvaluation[] }) {
  if (evaluations.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {evaluations.map((e) => (
        <div
          key={e.metric}
          title={e.rationale}
          className="rounded-lg border border-line bg-surface px-4 py-3"
        >
          <p className={`font-mono text-xl ${tone(e.score)}`}>
            {Math.round(e.score * 100)}
            <span className="text-sm text-ink-muted">%</span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {labels[e.metric] ?? e.metric}
          </p>
        </div>
      ))}
    </div>
  );
}
