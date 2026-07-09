"use client";

import { useTransition } from "react";
import { approveRun, rejectRun } from "@/app/dashboard/actions";

export function ApprovalGate({ runId, reason }: { runId: string; reason: string | null }) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-4 rounded-lg border border-confidence-mid/40 bg-confidence-mid/5 p-5">
      <div className="space-y-1">
        <h2 className="font-medium">This run needs your approval</h2>
        <p className="text-sm leading-6 text-ink-muted">
          {reason ??
            "A policy rule flagged this question for human review before the agents run."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => startTransition(() => approveRun(runId))}
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Working…" : "Approve & run"}
        </button>
        <button
          onClick={() => startTransition(() => rejectRun(runId))}
          disabled={pending}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </section>
  );
}
