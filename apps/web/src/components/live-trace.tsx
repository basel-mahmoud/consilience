"use client";

import { useAuth } from "@clerk/nextjs";
import {
  HubConnection,
  HubConnectionBuilder,
  HttpTransportType,
} from "@microsoft/signalr";
import { useEffect, useState } from "react";

interface TraceView {
  seq: number;
  type: string;
  message: string;
  data?: Record<string, unknown>;
  at: string;
}

const dotFor: Record<string, string> = {
  "run.started": "bg-ink-muted",
  "agent.started": "bg-accent",
  "agent.completed": "bg-confidence-high",
  synthesis: "bg-accent",
  contradictions: "bg-confidence-mid",
  "run.completed": "bg-confidence-high",
  "run.failed": "bg-confidence-low",
};

function mergeBySeq(prev: TraceView[], next: TraceView): TraceView[] {
  if (prev.some((e) => e.seq === next.seq)) return prev;
  return [...prev, next].sort((a, b) => a.seq - b.seq);
}

export function LiveTrace({ runId, live }: { runId: string; live: boolean }) {
  const { getToken } = useAuth();
  const [events, setEvents] = useState<TraceView[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_GATEWAY_URL;
    if (!base) return;

    let connection: HubConnection | undefined;
    let disposed = false;

    (async () => {
      const token = await getToken();
      if (disposed) return;

      // Replay recorded events so a mid-run connection still sees the whole story
      try {
        const res = await fetch(`${base}/api/runs/${runId}/trace`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !disposed) setEvents(await res.json());
      } catch {
        /* gateway unreachable — trace stays empty, run detail still polls */
      }

      if (!live || disposed) return;

      connection = new HubConnectionBuilder()
        .withUrl(`${base}/hubs/trace`, {
          accessTokenFactory: async () => (await getToken()) ?? "",
          transport: HttpTransportType.WebSockets,
          skipNegotiation: true,
        })
        .withAutomaticReconnect()
        .build();

      connection.on("trace", (ev: TraceView) =>
        setEvents((prev) => mergeBySeq(prev, ev)),
      );

      try {
        await connection.start();
        await connection.invoke("Subscribe", runId);
        if (!disposed) setConnected(true);
      } catch {
        /* live stream unavailable; recorded history above still renders */
      }
    })();

    return () => {
      disposed = true;
      connection?.stop();
    };
  }, [runId, live, getToken]);

  if (events.length === 0 && !connected) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Agent trace
        </h2>
        {live && connected && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            live
          </span>
        )}
      </div>
      <ol className="relative space-y-3 border-l border-line pl-5">
        {events.map((e) => (
          <li key={e.seq} className="trace-row relative">
            <span
              className={`absolute -left-[1.42rem] top-1.5 h-2 w-2 rounded-full ${
                dotFor[e.type] ?? "bg-ink-muted"
              }`}
            />
            <p className="text-sm leading-6">{e.message}</p>
            <p className="font-mono text-[11px] text-ink-muted">
              {e.type}
              {" · "}
              {new Date(e.at).toLocaleTimeString()}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
