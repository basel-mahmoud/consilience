package com.consilience.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Boundary test: the engine must deserialize exactly the JSON the gateway publishes on {@code
 * run.requested} (packages/contracts/messages/research-run-requested.v1.json). This canonical
 * payload matches the gateway's RunRequestedMessage serialization (camelCase, Web defaults).
 */
class RunRequestedContractTest {
  private final ObjectMapper mapper = new ObjectMapper();

  private static final String CANONICAL =
      """
      {"runId":"5a6c1a1e-9d1f-4d3a-8a52-0f6f6c1c2d3e",
       "userId":"1b2d3f4a-5c6e-4788-99aa-bbccddeeff00",
       "question":"What is the current state of solid-state battery commercialization?",
       "requestedAt":"2026-07-09T17:00:00+00:00"}
      """;

  @Test
  void deserializesTheGatewayPayload() throws Exception {
    RunRequested message = mapper.readValue(CANONICAL, RunRequested.class);

    assertEquals(UUID.fromString("5a6c1a1e-9d1f-4d3a-8a52-0f6f6c1c2d3e"), message.runId());
    assertEquals(UUID.fromString("1b2d3f4a-5c6e-4788-99aa-bbccddeeff00"), message.userId());
    assertEquals(
        "What is the current state of solid-state battery commercialization?", message.question());
  }

  @Test
  void missingIdsDeserializeToNull_soHandleCanReject() throws Exception {
    RunRequested message = mapper.readValue("{\"question\":\"hi\"}", RunRequested.class);
    assertNull(message.runId());
    assertNull(message.userId());
  }

  @Test
  void malformedJsonThrows() {
    assertThrows(Exception.class, () -> mapper.readValue("not json", RunRequested.class));
  }
}
