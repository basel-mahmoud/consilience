import Link from "next/link";
import { Logo } from "@/components/logo";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center">
      <Logo className="h-11 w-11 text-accent" />
      <div className="space-y-4">
        <h1 className="font-display text-5xl tracking-tight text-balance sm:text-6xl">
          Consilience
        </h1>
        <p className="mx-auto max-w-md text-lg leading-8 text-ink-muted">
          Independent research agents that gather, cross-check, and converge on
          verified claims.
        </p>
      </div>
      <div className="flex items-center gap-6 text-sm font-medium">
        <Link
          href="/styleguide"
          className="text-accent underline-offset-4 transition-colors hover:underline"
        >
          Design system
        </Link>
        <a
          href="https://github.com/basel-mahmoud/consilience"
          className="text-ink-muted transition-colors hover:text-ink"
        >
          GitHub
        </a>
      </div>
      <p className="fixed bottom-6 font-mono text-xs text-ink-muted">
        milestone 0 · foundation
      </p>
    </main>
  );
}
