package com.consilience.engine;

import java.util.concurrent.Callable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Exponential backoff for idempotent external calls. */
public final class Retry {
  private static final Logger log = LoggerFactory.getLogger(Retry.class);

  private Retry() {}

  @FunctionalInterface
  public interface Sleeper {
    void sleep(long millis) throws InterruptedException;
  }

  public static <T> T withBackoff(Callable<T> action, int attempts, long baseDelayMillis)
      throws Exception {
    return withBackoff(action, attempts, baseDelayMillis, Thread::sleep);
  }

  /** Retries {@code action} up to {@code attempts} times, doubling the delay each failure. */
  public static <T> T withBackoff(
      Callable<T> action, int attempts, long baseDelayMillis, Sleeper sleeper) throws Exception {
    Exception last = null;
    for (int attempt = 0; attempt < attempts; attempt++) {
      try {
        return action.call();
      } catch (Exception e) {
        last = e;
        if (attempt == attempts - 1) {
          break;
        }
        long delay = baseDelayMillis * (1L << attempt);
        log.warn("attempt {}/{} failed, retrying in {}ms", attempt + 1, attempts, delay);
        sleeper.sleep(delay);
      }
    }
    throw last;
  }
}
