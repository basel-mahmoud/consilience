import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount } from "@/components/delete-account";

export const metadata: Metadata = {
  title: "Settings",
};

export default function Settings() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-tight">Settings</h1>
        <p className="text-ink-muted">Manage your account and data.</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Your data
        </h2>
        <p className="text-sm leading-6 text-ink-muted">
          Consilience stores your account (via Clerk) and the research runs you
          create. See the{" "}
          <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">
            privacy policy
          </Link>{" "}
          and{" "}
          <a
            href="https://github.com/basel-mahmoud/consilience/blob/main/DATA_HANDLING.md"
            className="text-accent underline-offset-4 hover:underline"
          >
            data handling
          </a>{" "}
          for exactly what is collected and how long it is kept.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Danger zone
        </h2>
        <DeleteAccount />
      </section>
    </main>
  );
}
