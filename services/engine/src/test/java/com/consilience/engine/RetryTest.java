package com.consilience.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class RetryTest {

  @Test
  void succeedsWithoutRetryWhenActionSucceeds() throws Exception {
    AtomicInteger calls = new AtomicInteger();
    String result =
        Retry.withBackoff(
            () -> {
              calls.incrementAndGet();
              return "ok";
            },
            3,
            10,
            millis -> {});
    assertEquals("ok", result);
    assertEquals(1, calls.get());
  }

  @Test
  void retriesThenSucceeds() throws Exception {
    AtomicInteger calls = new AtomicInteger();
    String result =
        Retry.withBackoff(
            () -> {
              if (calls.incrementAndGet() < 3) {
                throw new RuntimeException("transient");
              }
              return "ok";
            },
            3,
            10,
            millis -> {});
    assertEquals("ok", result);
    assertEquals(3, calls.get());
  }

  @Test
  void exhaustsAttemptsAndThrowsLastError() {
    AtomicInteger calls = new AtomicInteger();
    Exception e =
        assertThrows(
            RuntimeException.class,
            () ->
                Retry.withBackoff(
                    () -> {
                      calls.incrementAndGet();
                      throw new RuntimeException("boom");
                    },
                    3,
                    10,
                    millis -> {}));
    assertEquals("boom", e.getMessage());
    assertEquals(3, calls.get());
  }

  @Test
  void backoffDelaysDoubleEachAttempt() throws Exception {
    List<Long> delays = new ArrayList<>();
    assertThrows(
        RuntimeException.class,
        () ->
            Retry.withBackoff(
                () -> {
                  throw new RuntimeException("x");
                },
                4,
                100,
                delays::add));
    // 3 sleeps between 4 attempts: 100, 200, 400
    assertEquals(List.of(100L, 200L, 400L), delays);
  }
}
