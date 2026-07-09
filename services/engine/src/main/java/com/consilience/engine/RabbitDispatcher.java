package com.consilience.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;

/**
 * Publishes an approved run to the mesh on {@code agent.dispatch} with publisher confirms, retried
 * with exponential backoff. Idempotent: the mesh claims each run once, so a duplicate delivery
 * after a retry is harmless.
 */
public final class RabbitDispatcher implements Dispatcher {
  static final String EXCHANGE = "consilience";
  static final String ROUTING_KEY = "agent.dispatch";

  private final Channel channel;
  private final ObjectMapper mapper = new ObjectMapper();

  public RabbitDispatcher(Channel channel) {
    this.channel = channel;
  }

  @Override
  public void dispatch(RunRequested message) throws Exception {
    byte[] body = mapper.writeValueAsBytes(message);
    AMQP.BasicProperties props =
        new AMQP.BasicProperties.Builder()
            .contentType("application/json")
            .deliveryMode(2) // persistent
            .build();
    Retry.withBackoff(
        () -> {
          channel.basicPublish(EXCHANGE, ROUTING_KEY, props, body);
          channel.waitForConfirmsOrDie(5000);
          return null;
        },
        3,
        500);
  }
}
