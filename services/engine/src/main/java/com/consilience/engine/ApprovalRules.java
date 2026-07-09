package com.consilience.engine;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Decides whether a research run needs human approval before the mesh spends compute on it.
 *
 * <p>The mesh presents confident, cited-looking claims; on high-stakes topics (medical, legal,
 * financial, safety) that authority is itself a risk, so a human confirms before the run proceeds.
 * The rules are a transparent, auditable keyword policy rather than an opaque classifier.
 */
public final class ApprovalRules {

  private record Domain(String label, List<String> terms) {}

  private static final List<Domain> DOMAINS =
      List.of(
          new Domain(
              "medical",
              List.of(
                  "diagnos",
                  "symptom",
                  "treatment",
                  "dosage",
                  "dose",
                  "prescri",
                  "medication",
                  "cancer",
                  "disease",
                  "therapy",
                  "cure ",
                  "overdose",
                  "self-harm",
                  "suicide")),
          new Domain(
              "legal",
              List.of("legal advice", "lawsuit", "sue ", "liable", "prosecut", "criminal charge")),
          new Domain(
              "financial",
              List.of(
                  "invest",
                  "stock ",
                  "stocks",
                  "which crypto",
                  "buy shares",
                  "portfolio allocat",
                  "financial advice")),
          new Domain(
              "safety",
              List.of("explosive", "weapon", "poison", "bioweapon", "how to make a bomb")));

  private ApprovalRules() {}

  /**
   * @return a human-readable reason approval is required, or empty if the run may proceed
   *     automatically.
   */
  public static Optional<String> requiresApproval(String question) {
    if (question == null) {
      return Optional.empty();
    }
    String normalized = question.toLowerCase(Locale.ROOT);
    for (Domain domain : DOMAINS) {
      for (String term : domain.terms()) {
        if (normalized.contains(term)) {
          return Optional.of(
              "Touches a sensitive %s topic — a human should confirm before the agents run."
                  .formatted(domain.label()));
        }
      }
    }
    return Optional.empty();
  }
}
