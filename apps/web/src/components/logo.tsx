/**
 * The Consilience mark: three independent lines of evidence
 * converging on a single verified point. Inherits `currentColor`.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7 13 C 24 13, 33 24, 41.5 29.5"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M7 32 L 38.5 32"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M7 51 C 24 51, 33 40, 41.5 34.5"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="46" cy="32" r="5.5" fill="currentColor" />
      <path
        d="M54.5 32 L 58 32"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
