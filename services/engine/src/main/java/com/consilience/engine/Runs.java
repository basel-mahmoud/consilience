package com.consilience.engine;

import java.util.UUID;

/** Run state the engine reads and transitions. All access is scoped by {@code userId}. */
public interface Runs {

  /** Runs this user created within the last hour (the current one included). */
  int countRunsInLastHour(UUID userId);

  /** Transition queued → rate_limited when the per-user throughput cap is exceeded. */
  void markRateLimited(UUID runId, UUID userId, String reason);

  /** Transition queued → awaiting_approval when a policy rule requires human review. */
  void markAwaitingApproval(UUID runId, UUID userId, String reason);

  /** Transition queued → failed when dispatch could not be completed. */
  void markFailed(UUID runId, UUID userId, String error);
}
