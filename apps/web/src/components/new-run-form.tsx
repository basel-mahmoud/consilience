"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createRun, type CreateRunState } from "@/app/dashboard/actions";

const initial: CreateRunState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-accent/40 border-t-on-accent" />
          Dispatching agents…
        </>
      ) : (
        "Start research run"
      )}
    </button>
  );
}

export function NewRunForm({ disabled }: { disabled?: boolean }) {
  const [state, formAction] = useActionState(createRun, initial);

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="question" className="sr-only">
        Research question
      </label>
      <textarea
        id="question"
        name="question"
        required
        minLength={10}
        maxLength={500}
        rows={3}
        disabled={disabled}
        placeholder="What would you like the mesh to research? e.g. How mature is solid-state battery manufacturing in 2026?"
        className="w-full resize-none rounded-lg border border-line bg-surface px-4 py-3 text-sm leading-6 text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-4">
        {state.error ? (
          <p role="alert" className="text-sm text-confidence-low">
            {state.error}
          </p>
        ) : (
          <p className="text-xs text-ink-muted">
            One agent researches, extracts claims, and cites sources. The mesh
            expands to multiple cross-checking agents in a later release.
          </p>
        )}
        <SubmitButton />
      </div>
    </form>
  );
}
