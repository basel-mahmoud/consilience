"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const options = [
  {
    value: "light",
    label: "Light theme",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System theme",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
        <rect x="1.5" y="3" width="13" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark theme",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
        <path
          d="M13.5 9.5A5.75 5.75 0 0 1 6.5 2.5a5.75 5.75 0 1 0 7 7Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Theme is unknown until hydration; treat server render as "not mounted"
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {options.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={() => setTheme(o.value)}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
              active
                ? "bg-ink text-bg"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {o.icon}
          </button>
        );
      })}
    </div>
  );
}
