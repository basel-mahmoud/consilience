package com.consilience.engine;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

/**
 * packages/contracts/messages/research-run-requested.v1.json
 *
 * <p>Consumed from the gateway on {@code run.requested}; relayed unchanged to the mesh on {@code
 * agent.dispatch} once the engine's policy checks pass.
 */
public record RunRequested(
    @JsonProperty("runId") UUID runId,
    @JsonProperty("userId") UUID userId,
    @JsonProperty("question") String question,
    @JsonProperty("requestedAt") String requestedAt) {}
