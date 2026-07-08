import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun, type RunDetail } from "@/lib/gateway";
import { ConfidenceBadge, StatusPill } from "@/components/run-status";
import { RunAutoRefresh } from "@/components/run-auto-refresh";

export const metadata: Metadata = {
  title: "Run",
};

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  let run: RunDetail | null;
  try {
    run = await getRun(runId);
  } catch {
    run = null;
  }
  if (run === null) notFound();

  const inProgress = run.status === "queued" || run.status === "running";

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8">
      {inProgress && <RunAutoRefresh />}

      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← all runs
        </Link>
        <div className="flex items-start justify-between gap-6">
          <h1 className="font-display text-2xl leading-snug tracking-tight">
            {run.question}
          </h1>
          <div className="shrink-0 pt-1">
            <StatusPill status={run.status} />
          </div>
        </div>
      </div>

      {run.status === "failed" && (
        <p className="rounded-md border border-confidence-low/40 bg-confidence-low/5 px-4 py-3 text-sm text-confidence-low">
          This run failed{run.error ? `: ${run.error}` : "."} You can start a new
          one from the dashboard.
        </p>
      )}

      {inProgress && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-5 py-8">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
          <p className="text-sm text-ink-muted">
            {run.status === "queued"
              ? "Queued — an agent will pick this up shortly."
              : "An agent is gathering sources and extracting claims…"}
          </p>
        </div>
      )}

      {run.status === "completed" && (
        <>
          {run.summary && (
            <section className="space-y-2">
              <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
                Summary
              </h2>
              <p className="leading-7">{run.summary}</p>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
              Claims ({run.claims.length})
            </h2>
            <ul className="space-y-3">
              {run.claims.map((claim) => (
                <li
                  key={claim.position}
                  className="space-y-2 rounded-lg border border-line bg-surface p-4"
                >
                  <p className="leading-7">{claim.text}</p>
                  <div className="flex items-center gap-4">
                    <ConfidenceBadge confidence={claim.confidence} />
                    {claim.sourcePositions.length > 0 && (
                      <span className="font-mono text-xs text-ink-muted">
                        {claim.sourcePositions.map((p) => `[${p}]`).join(" ")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
              Sources ({run.sources.length})
            </h2>
            <ol className="space-y-2">
              {run.sources.map((source) => (
                <li key={source.position} className="flex gap-3 text-sm">
                  <span className="font-mono text-xs text-ink-muted">
                    [{source.position}]
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="min-w-0 break-words text-accent underline-offset-4 hover:underline"
                  >
                    {source.title || source.url}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
