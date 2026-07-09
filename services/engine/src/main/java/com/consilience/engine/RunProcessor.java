package com.consilience.engine;

import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The engine's decision for one run request: enforce the per-user throughput cap, apply the
 * approval-gate rules, then dispatch to the mesh. Depends only on the {@link Runs} and {@link
 * Dispatcher} interfaces so the policy is unit-testable without a broker or database.
 */
public final class RunProcessor {
  private static final Logger log = LoggerFactory.getLogger(RunProcessor.class);

  public enum Outcome {
    DISPATCHED,
    RATE_LIMITED,
    AWAITING_APPROVAL
  }

  private final Runs runs;
  private final Dispatcher dispatcher;
  private final int maxRunsPerHour;

  public RunProcessor(Runs runs, Dispatcher dispatcher, int maxRunsPerHour) {
    this.runs = runs;
    this.dispatcher = dispatcher;
    this.maxRunsPerHour = maxRunsPerHour;
  }

  /**
   * @throws Exception if dispatch ultimately fails; the caller marks the run failed and
   *     dead-letters the message.
   */
  public Outcome process(RunRequested message) throws Exception {
    int recent = runs.countRunsInLastHour(message.userId());
    if (recent > maxRunsPerHour) {
      String reason =
          "Exceeded the limit of %d runs per hour (%d in the last hour)."
              .formatted(maxRunsPerHour, recent);
      log.info("run {} rate-limited: {}", message.runId(), reason);
      runs.markRateLimited(message.runId(), message.userId(), reason);
      return Outcome.RATE_LIMITED;
    }

    Optional<String> approval = ApprovalRules.requiresApproval(message.question());
    if (approval.isPresent()) {
      log.info("run {} awaiting approval: {}", message.runId(), approval.get());
      runs.markAwaitingApproval(message.runId(), message.userId(), approval.get());
      return Outcome.AWAITING_APPROVAL;
    }

    dispatcher.dispatch(message);
    log.info("run {} dispatched to mesh", message.runId());
    return Outcome.DISPATCHED;
  }
}
