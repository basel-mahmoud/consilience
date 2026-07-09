import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { label: "Overview", href: "/dashboard", enabled: true, hint: "" },
  { label: "Settings", href: "/dashboard/settings", enabled: true, hint: "" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      <aside className="flex shrink-0 flex-row items-center gap-6 border-b border-line px-5 py-4 sm:w-56 sm:flex-col sm:items-stretch sm:gap-8 sm:border-b-0 sm:border-r sm:py-6">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <Logo className="h-6 w-6 text-accent" />
          <span className="font-display text-lg tracking-tight">
            Consilience
          </span>
        </Link>
        <nav className="flex flex-row gap-1 sm:flex-col">
          {nav.map((item) =>
            item.enabled && item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm text-ink-muted/70"
              >
                {item.label}
                <span className="hidden font-mono text-[10px] uppercase sm:inline">
                  {item.hint}
                </span>
              </span>
            ),
          )}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-line px-6 py-3.5">
          <ThemeToggle />
          <UserButton />
        </header>
        <div className="flex-1 px-6 py-8 sm:px-10">{children}</div>
      </div>
    </div>
  );
}
