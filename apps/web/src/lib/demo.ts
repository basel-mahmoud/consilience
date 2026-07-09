import "server-only";
import { sql } from "@/lib/db";
import { runResearch, type MeshResult } from "@/lib/research";
import type { Confidence, RunDetail, RunListItem } from "@/lib/gateway";

/**
 * Demo-mode data access: the same Neon database the polyglot backend uses,
 * queried directly from Next server code and scoped by the Clerk user id.
 * Active only when the .NET gateway isn't configured.
 */

async function userId(clerkUserId: string, email: string | null): Promise<string> {
  const rows = await sql`
    INSERT INTO users (clerk_user_id, email) VALUES (${clerkUserId}, ${email})
    ON CONFLICT (clerk_user_id) DO UPDATE
      SET email = COALESCE(EXCLUDED.email, users.email), last_seen_at = now()
    RETURNING id`;
  return rows[0].id as string;
}

export async function createRun(
  clerkUserId: string, email: string | null, question: string, approvalReason: string | null,
) {
  const uid = await userId(clerkUserId, email);
  const active = await sql`
    SELECT count(*)::int AS n FROM runs
    WHERE user_id = ${uid} AND status IN ('queued','running','awaiting_approval')`;
  if ((active[0].n as number) >= 3) return { error: "too_many" as const };

  const status = approvalReason ? "awaiting_approval" : "running";
  const startedAt = approvalReason ? null : "now";
  const rows = approvalReason
    ? await sql`INSERT INTO runs (user_id, question, status, approval_reason)
        VALUES (${uid}, ${question}, ${status}, ${approvalReason}) RETURNING id`
    : await sql`INSERT INTO runs (user_id, question, status, started_at)
        VALUES (${uid}, ${question}, ${status}, now()) RETURNING id`;
  void startedAt;
  return { runId: rows[0].id as string, userId: uid, awaiting: !!approvalReason };
}

/** Runs the research pipeline and persists it, emitting trace events as it goes. */
export async function executeRun(runId: string, uid: string, question: string) {
  let seq = 0;
  const trace = async (type: string, message: string) => {
    await appendTrace(runId, uid, seq++, type, message);
  };
  await trace("run.started", "Dispatching research agents");
  try {
    const result = await runResearch(question, trace);
    await saveResult(runId, uid, result);
    const claims = result.agents.reduce((n, a) => n + a.claims.length, 0);
    await trace("run.completed", `Report ready: ${claims} claims from ${result.agents.length} agents`);
  } catch (e) {
    await markFailed(runId, uid, e instanceof Error ? e.message : String(e));
    await trace("run.failed", "The run failed before completing");
  }
}

export async function appendTrace(runId: string, uid: string, seq: number, type: string, message: string) {
  await sql`
    INSERT INTO trace_events (run_id, user_id, seq, type, message)
    VALUES (${runId}, ${uid}, ${seq}, ${type}, ${message})
    ON CONFLICT (run_id, seq) DO NOTHING`;
}

export async function markFailed(runId: string, uid: string, error: string) {
  await sql`
    UPDATE runs SET status='failed', error=left(${error},500), completed_at=now()
    WHERE id=${runId} AND user_id=${uid} AND status='running'`;
}

export async function saveResult(runId: string, uid: string, mesh: MeshResult) {
  await sql`UPDATE runs SET summary=${mesh.summary} WHERE id=${runId} AND user_id=${uid}`;
  const claimIds: string[] = [];
  let sPos = 0;
  let cPos = 0;
  for (const agent of mesh.agents) {
    const ar = await sql`
      INSERT INTO run_agents (run_id, lens, status, completed_at)
      VALUES (${runId}, ${agent.lensLabel}, 'completed', now()) RETURNING id`;
    const agentId = ar[0].id as string;
    const localSource: Record<number, string> = {};
    for (const s of agent.sources) {
      sPos += 1;
      const sr = await sql`
        INSERT INTO sources (run_id, run_agent_id, position, url, title, credibility)
        VALUES (${runId}, ${agentId}, ${sPos}, ${s.url}, ${s.title}, ${s.credibility})
        RETURNING id`;
      localSource[s.position] = sr[0].id as string;
    }
    for (const c of agent.claims) {
      cPos += 1;
      const cr = await sql`
        INSERT INTO claims (run_id, run_agent_id, position, text, confidence)
        VALUES (${runId}, ${agentId}, ${cPos}, ${c.text}, ${c.confidence}) RETURNING id`;
      const claimId = cr[0].id as string;
      claimIds.push(claimId);
      for (const p of c.sourcePositions) {
        if (localSource[p]) {
          await sql`INSERT INTO claim_sources (claim_id, source_id) VALUES (${claimId}, ${localSource[p]})`;
        }
      }
    }
  }
  for (const x of mesh.contradictions) {
    if (claimIds[x.claimA] && claimIds[x.claimB]) {
      await sql`
        INSERT INTO contradictions (run_id, claim_a_id, claim_b_id, explanation)
        VALUES (${runId}, ${claimIds[x.claimA]}, ${claimIds[x.claimB]}, ${x.explanation})`;
    }
  }
  for (const e of mesh.evaluations) {
    await sql`
      INSERT INTO run_evaluations (run_id, metric, score, rationale)
      VALUES (${runId}, ${e.metric}, ${e.score}, ${e.rationale})`;
  }
  await sql`
    UPDATE runs SET status='completed', completed_at=now()
    WHERE id=${runId} AND user_id=${uid} AND status='running'`;
}

export async function listRuns(clerkUserId: string, email: string | null): Promise<RunListItem[]> {
  const uid = await userId(clerkUserId, email);
  const rows = await sql`
    SELECT r.id, r.question, r.status, r.created_at, r.completed_at,
      (SELECT count(*)::int FROM claims c WHERE c.run_id=r.id) AS claim_count,
      (SELECT count(*)::int FROM sources s WHERE s.run_id=r.id) AS source_count
    FROM runs r WHERE r.user_id=${uid} ORDER BY r.created_at DESC LIMIT 50`;
  return rows.map((r) => ({
    id: r.id, question: r.question, status: r.status,
    createdAt: r.created_at, completedAt: r.completed_at,
    claimCount: r.claim_count, sourceCount: r.source_count,
  }));
}

export async function getRun(
  clerkUserId: string, email: string | null, runId: string,
): Promise<RunDetail | null> {
  const uid = await userId(clerkUserId, email);
  const runs = await sql`
    SELECT question, status, summary, error, approval_reason, created_at, completed_at
    FROM runs WHERE id=${runId} AND user_id=${uid}`;
  if (runs.length === 0) return null;
  const run = runs[0];

  const claims = await sql`
    SELECT c.position, c.text, c.confidence, ra.lens,
      COALESCE((SELECT array_agg(s.position ORDER BY s.position)
                FROM claim_sources cs JOIN sources s ON s.id=cs.source_id
                WHERE cs.claim_id=c.id), '{}') AS source_positions
    FROM claims c LEFT JOIN run_agents ra ON ra.id=c.run_agent_id
    WHERE c.run_id=${runId} ORDER BY c.position`;
  const sources = await sql`
    SELECT s.position, s.url, s.title, s.credibility, ra.lens
    FROM sources s LEFT JOIN run_agents ra ON ra.id=s.run_agent_id
    WHERE s.run_id=${runId} ORDER BY s.position`;
  const contradictions = await sql`
    SELECT ca.position AS a, cb.position AS b, x.explanation
    FROM contradictions x JOIN claims ca ON ca.id=x.claim_a_id JOIN claims cb ON cb.id=x.claim_b_id
    WHERE x.run_id=${runId} ORDER BY ca.position`;
  const evaluations = await sql`
    SELECT metric, score, rationale FROM run_evaluations WHERE run_id=${runId} ORDER BY metric`;
  const trace = await sql`
    SELECT seq, type, message, created_at FROM trace_events
    WHERE run_id=${runId} ORDER BY seq`;

  return {
    id: runId, question: run.question, status: run.status, summary: run.summary,
    error: run.error, approvalReason: run.approval_reason,
    createdAt: run.created_at, completedAt: run.completed_at,
    claims: claims.map((c) => ({
      position: c.position, text: c.text, confidence: c.confidence as Confidence,
      sourcePositions: c.source_positions, agent: c.lens,
    })),
    sources: sources.map((s) => ({
      position: s.position, url: s.url, title: s.title,
      credibility: s.credibility as Confidence | null, agent: s.lens,
    })),
    contradictions: contradictions.map((x) => ({ claimA: x.a, claimB: x.b, explanation: x.explanation })),
    evaluations: evaluations.map((e) => ({ metric: e.metric, score: e.score, rationale: e.rationale })),
    trace: trace.map((t) => ({ seq: t.seq, type: t.type, message: t.message, at: t.created_at })),
  };
}

export async function approveRun(clerkUserId: string, email: string | null, runId: string) {
  const uid = await userId(clerkUserId, email);
  const rows = await sql`
    UPDATE runs SET status='running', approval_reason=NULL, started_at=now()
    WHERE id=${runId} AND user_id=${uid} AND status='awaiting_approval'
    RETURNING question`;
  return rows.length ? { question: rows[0].question as string, userId: uid } : null;
}

export async function rejectRun(clerkUserId: string, email: string | null, runId: string) {
  const uid = await userId(clerkUserId, email);
  const rows = await sql`
    UPDATE runs SET status='rejected', completed_at=now()
    WHERE id=${runId} AND user_id=${uid} AND status='awaiting_approval' RETURNING id`;
  return rows.length > 0;
}

export async function deleteAccount(clerkUserId: string) {
  await sql`DELETE FROM users WHERE clerk_user_id=${clerkUserId}`;
}
