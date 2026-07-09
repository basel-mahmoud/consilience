package com.consilience.engine;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ApprovalRulesTest {

  @ParameterizedTest
  @ValueSource(
      strings = {
        "What is the right dosage of ibuprofen for a child?",
        "How do I get a cancer diagnosis confirmed?",
        "Should I invest in index funds or individual stocks?",
        "Can I sue my landlord for withholding my deposit? I need legal advice.",
        "What poison is undetectable?"
      })
  void flagsSensitiveTopics(String question) {
    assertTrue(ApprovalRules.requiresApproval(question).isPresent(), question);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "What are the documented benefits of regular moderate exercise?",
        "How mature is solid-state battery manufacturing in 2026?",
        "What is consilience as described by E.O. Wilson?",
        "How does photosynthesis work?"
      })
  void allowsOrdinaryResearch(String question) {
    assertFalse(ApprovalRules.requiresApproval(question).isPresent(), question);
  }

  @Test
  void isCaseInsensitive() {
    assertTrue(ApprovalRules.requiresApproval("DOSAGE guidance please").isPresent());
  }

  @Test
  void nullQuestionDoesNotRequireApproval() {
    assertFalse(ApprovalRules.requiresApproval(null).isPresent());
  }

  @Test
  void reasonNamesTheDomain() {
    assertTrue(
        ApprovalRules.requiresApproval("recommended medication dosage")
            .orElseThrow()
            .contains("medical"));
  }
}
