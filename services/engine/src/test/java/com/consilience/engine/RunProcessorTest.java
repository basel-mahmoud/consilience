package com.consilience.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RunProcessorTest {

  static final class FakeRuns implements Runs {
    int recentCount;
    final List<UUID> rateLimited = new ArrayList<>();
    final List<UUID> awaitingApproval = new ArrayList<>();
    final List<UUID> failed = new ArrayList<>();

    @Override
    public int countRunsInLastHour(UUID userId) {
      return recentCount;
    }

    @Override
    public void markRateLimited(UUID runId, UUID userId, String reason) {
      rateLimited.add(runId);
    }

    @Override
    public void markAwaitingApproval(UUID runId, UUID userId, String reason) {
      awaitingApproval.add(runId);
    }

    @Override
    public void markFailed(UUID runId, UUID userId, String error) {
      failed.add(runId);
    }
  }

  static final class FakeDispatcher implements Dispatcher {
    final List<UUID> dispatched = new ArrayList<>();
    boolean fail;

    @Override
    public void dispatch(RunRequested message) throws Exception {
      if (fail) {
        throw new RuntimeException("broker down");
      }
      dispatched.add(message.runId());
    }
  }

  private static RunRequested message() {
    return message("a perfectly ordinary research question");
  }

  private static RunRequested message(String question) {
    return new RunRequested(UUID.randomUUID(), UUID.randomUUID(), question, "2026-07-09T00:00:00Z");
  }

  @Test
  void dispatchesWhenUnderLimit() throws Exception {
    FakeRuns runs = new FakeRuns();
    runs.recentCount = 5;
    FakeDispatcher dispatcher = new FakeDispatcher();
    RunRequested msg = message();

    RunProcessor.Outcome outcome = new RunProcessor(runs, dispatcher, 10).process(msg);

    assertEquals(RunProcessor.Outcome.DISPATCHED, outcome);
    assertEquals(List.of(msg.runId()), dispatcher.dispatched);
    assertTrue(runs.rateLimited.isEmpty());
  }

  @Test
  void dispatchesExactlyAtLimit() throws Exception {
    FakeRuns runs = new FakeRuns();
    runs.recentCount = 10; // equal to the cap is still allowed
    FakeDispatcher dispatcher = new FakeDispatcher();

    assertEquals(
        RunProcessor.Outcome.DISPATCHED, new RunProcessor(runs, dispatcher, 10).process(message()));
  }

  @Test
  void rateLimitsWhenOverLimit() throws Exception {
    FakeRuns runs = new FakeRuns();
    runs.recentCount = 11; // one past the cap
    FakeDispatcher dispatcher = new FakeDispatcher();
    RunRequested msg = message();

    RunProcessor.Outcome outcome = new RunProcessor(runs, dispatcher, 10).process(msg);

    assertEquals(RunProcessor.Outcome.RATE_LIMITED, outcome);
    assertEquals(List.of(msg.runId()), runs.rateLimited);
    assertTrue(dispatcher.dispatched.isEmpty());
  }

  @Test
  void dispatchFailurePropagates() {
    FakeRuns runs = new FakeRuns();
    FakeDispatcher dispatcher = new FakeDispatcher();
    dispatcher.fail = true;

    assertThrows(
        RuntimeException.class, () -> new RunProcessor(runs, dispatcher, 10).process(message()));
  }

  @Test
  void sensitiveQuestionAwaitsApprovalInsteadOfDispatch() throws Exception {
    FakeRuns runs = new FakeRuns();
    FakeDispatcher dispatcher = new FakeDispatcher();
    RunRequested msg = message("What is the correct medication dosage for my child?");

    RunProcessor.Outcome outcome = new RunProcessor(runs, dispatcher, 10).process(msg);

    assertEquals(RunProcessor.Outcome.AWAITING_APPROVAL, outcome);
    assertEquals(List.of(msg.runId()), runs.awaitingApproval);
    assertTrue(dispatcher.dispatched.isEmpty());
  }

  @Test
  void rateLimitTakesPrecedenceOverApproval() throws Exception {
    FakeRuns runs = new FakeRuns();
    runs.recentCount = 11;
    FakeDispatcher dispatcher = new FakeDispatcher();
    RunRequested msg = message("What is the correct medication dosage?");

    RunProcessor.Outcome outcome = new RunProcessor(runs, dispatcher, 10).process(msg);

    assertEquals(RunProcessor.Outcome.RATE_LIMITED, outcome);
    assertTrue(runs.awaitingApproval.isEmpty());
  }
}
