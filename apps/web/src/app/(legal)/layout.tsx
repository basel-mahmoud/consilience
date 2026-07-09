import Link from "next/link";
import { Logo } from "@/components/logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="mb-12 inline-flex items-center gap-2 text-ink">
        <Logo className="h-6 w-6 text-accent" />
        <span className="font-display text-lg tracking-tight">Consilience</span>
      </Link>
      <article className="prose-consilience space-y-6">{children}</article>
    </div>
  );
}
