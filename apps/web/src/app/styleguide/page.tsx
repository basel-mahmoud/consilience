import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Design system",
};

const colors = [
  { name: "bg", cls: "bg-bg", token: "--bg" },
  { name: "surface", cls: "bg-surface", token: "--surface" },
  { name: "ink", cls: "bg-ink", token: "--ink" },
  { name: "ink-muted", cls: "bg-ink-muted", token: "--ink-muted" },
  { name: "line", cls: "bg-line", token: "--line" },
  { name: "accent", cls: "bg-accent", token: "--accent" },
];

const confidence = [
  { name: "high", cls: "bg-confidence-high", note: "corroborated by independent sources" },
  { name: "mid", cls: "bg-confidence-mid", note: "single credible source, unverified" },
  { name: "low", cls: "bg-confidence-low", note: "contested or weakly sourced" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6 border-t border-line pt-10">
      <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Styleguide() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-16 px-6 py-20">
      <header className="space-y-4">
        <Link href="/" className="inline-block text-accent">
          <Logo className="h-9 w-9" />
        </Link>
        <h1 className="font-display text-4xl tracking-tight">Design system</h1>
        <p className="max-w-lg leading-7 text-ink-muted">
          The visual foundation for Consilience: warm paper and deep graphite
          surfaces, a teal accent, editorial display type over a precise UI
          face. Toggle your OS appearance to see both modes.
        </p>
      </header>

      <Section title="Mark">
        <div className="flex items-center gap-8">
          <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-line bg-surface text-ink">
            <Logo className="h-12 w-12" />
          </div>
          <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-ink text-bg">
            <Logo className="h-12 w-12" />
          </div>
          <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-line bg-surface text-accent">
            <Logo className="h-12 w-12" />
          </div>
        </div>
        <p className="max-w-lg text-sm leading-6 text-ink-muted">
          Three independent lines of evidence converging on a single verified
          point. Drawn with <code className="font-mono text-xs">currentColor</code> —
          it inherits ink, inverse, or accent from context.
        </p>
      </Section>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {colors.map((c) => (
            <div key={c.name} className="space-y-2">
              <div className={`h-16 rounded-md border border-line ${c.cls}`} />
              <p className="text-sm font-medium">{c.name}</p>
              <p className="font-mono text-xs text-ink-muted">{c.token}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Confidence scale">
        <div className="space-y-3">
          {confidence.map((c) => (
            <div key={c.name} className="flex items-center gap-4">
              <span className={`h-3 w-3 shrink-0 rounded-full ${c.cls}`} />
              <span className="w-12 font-mono text-xs uppercase">{c.name}</span>
              <span className="text-sm text-ink-muted">{c.note}</span>
            </div>
          ))}
        </div>
        <p className="max-w-lg text-sm leading-6 text-ink-muted">
          Every claim in a report carries one of these. The scale is reserved
          for evidence strength — never reused for generic status.
        </p>
      </Section>

      <Section title="Type">
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="font-display text-5xl tracking-tight">
              Evidence converges.
            </p>
            <p className="font-mono text-xs text-ink-muted">
              Newsreader · display · headlines and report titles
            </p>
          </div>
          <div className="space-y-2">
            <p className="max-w-lg text-base leading-7">
              Three agents researched this question independently. Two reached
              the same conclusion from different sources; the third flagged a
              contradiction in the underlying data.
            </p>
            <p className="font-mono text-xs text-ink-muted">
              Inter · UI and body · 16/28
            </p>
          </div>
          <div className="space-y-2">
            <p className="rounded-md border border-line bg-surface p-4 font-mono text-[13px] leading-6">
              agent:verifier · pulled 4 sources · 1 contradiction flagged
            </p>
            <p className="font-mono text-xs text-ink-muted">
              JetBrains Mono · traces, citations, data
            </p>
          </div>
        </div>
      </Section>

      <Section title="Surfaces & radii">
        <div className="flex flex-wrap items-end gap-6">
          <div className="h-20 w-32 rounded-sm border border-line bg-surface p-3 text-xs text-ink-muted">
            sm · chips
          </div>
          <div className="h-24 w-40 rounded-md border border-line bg-surface p-3 text-xs text-ink-muted">
            md · cards
          </div>
          <div className="h-28 w-48 rounded-lg border border-line bg-surface p-3 text-xs text-ink-muted">
            lg · panels
          </div>
        </div>
      </Section>
    </main>
  );
}
