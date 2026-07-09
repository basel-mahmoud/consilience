"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAccountData } from "@/app/dashboard/actions";

export function DeleteAccount() {
  const { user } = useUser();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      // 1. Erase all research data owned by the account (gateway or demo DB)
      const { ok } = await deleteAccountData();
      if (!ok) throw new Error("data deletion failed");
      // 2. Erase the authentication identity itself
      await user?.delete();
      router.push("/");
    } catch {
      setError("Something went wrong. Your account was not deleted — please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-confidence-low/40 p-5">
      <div className="space-y-1">
        <h2 className="font-medium text-confidence-low">Delete account</h2>
        <p className="text-sm leading-6 text-ink-muted">
          Permanently deletes your account and every research run, claim, source,
          and trace it produced. This cannot be undone.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-confidence-low">
          {error}
        </p>
      )}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-md border border-confidence-low/50 px-4 py-2 text-sm font-medium text-confidence-low transition-colors hover:bg-confidence-low/5"
        >
          Delete my account
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-md bg-confidence-low px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Yes, delete everything"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
