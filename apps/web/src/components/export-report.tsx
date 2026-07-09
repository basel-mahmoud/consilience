"use client";

import type { RunDetail } from "@/lib/gateway";
import { buildMarkdownReport, reportFilename } from "@/lib/report";

export function ExportReport({ run }: { run: RunDetail }) {
  function download() {
    const markdown = buildMarkdownReport(run);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFilename(run);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-line/30"
    >
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
        <path
          d="M8 1.5v8m0 0 3-3m-3 3-3-3M2.5 11.5v1a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Export report
    </button>
  );
}
