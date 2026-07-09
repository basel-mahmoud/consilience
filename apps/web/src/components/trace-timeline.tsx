import type { RunTraceEvent } from "@/lib/gateway";

const dotFor: Record<string, string> = {
  "run.started": "bg-ink-muted",
  "agent.started": "bg-accent",
  "agent.completed": "bg-confidence-high",
  synthesis: "bg-accent",
  contradictions: "bg-confidence-mid",
  "run.completed": "bg-confidence-high",
  "run.failed": "bg-confidence-low",
};

/** Server-rendered agent trace. In demo mode the events arrive via polling; the
 *  gateway path streams them live through SignalR (LiveTrace) instead. */
export function TraceTimeline({
  events,
  live,
}: {
  events: RunTraceEvent[];
  live: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Agent trace
        </h2>
        {live && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            live
          </span>
        )}
      </div>
      <ol
        aria-live="polite"
        aria-label="Agent activity"
        className="relative space-y-3 border-l border-line pl-5"
      >
        {events.map((e) => (
          <li key={e.seq} className="trace-row relative">
            <span
              aria-hidden="true"
              className={`absolute -left-[1.42rem] top-1.5 h-2 w-2 rounded-full ${
                dotFor[e.type] ?? "bg-ink-muted"
              }`}
            />
            <p className="text-sm leading-6">{e.message}</p>
            <p className="font-mono text-[11px] text-ink-muted">
              {e.type} · {new Date(e.at).toLocaleTimeString()}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
