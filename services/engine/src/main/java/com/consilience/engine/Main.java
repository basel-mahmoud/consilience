package com.consilience.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.DeliverCallback;
import com.rabbitmq.client.Delivery;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Engine entry point. Consumes {@code run.requested} from the gateway, applies the per-user
 * throughput cap, and dispatches surviving runs to the mesh on {@code agent.dispatch}. Invalid or
 * failed messages are dead-lettered, never silently dropped.
 */
public final class Main {
  private static final Logger log = LoggerFactory.getLogger(Main.class);

  static final String EXCHANGE = "consilience";
  static final String DLX = "consilience.dlx";
  static final String QUEUE = "engine.run-requests";
  static final String ROUTING_KEY = "run.requested";

  private final RunProcessor processor;
  private final Runs runs;
  private final ObjectMapper mapper = new ObjectMapper();

  Main(RunProcessor processor, Runs runs) {
    this.processor = processor;
    this.runs = runs;
  }

  public static void main(String[] args) throws Exception {
    Config config = Config.fromEnv();
    Runs runs = PostgresRuns.fromUrl(config.databaseUrl());

    ConnectionFactory factory = new ConnectionFactory();
    factory.setUri(config.rabbitmqUrl());
    Connection connection = factory.newConnection();
    Channel channel = connection.createChannel();
    channel.confirmSelect();

    channel.exchangeDeclare(EXCHANGE, "topic", true);
    channel.exchangeDeclare(DLX, "topic", true);
    channel.queueDeclare(QUEUE, true, false, false, Map.of("x-dead-letter-exchange", DLX));
    channel.queueBind(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.queueDeclare(QUEUE + ".dlq", true, false, false, null);
    channel.queueBind(QUEUE + ".dlq", DLX, "#");
    channel.basicQos(4);

    RunProcessor processor =
        new RunProcessor(runs, new RabbitDispatcher(channel), config.maxRunsPerHour());
    Main engine = new Main(processor, runs);

    log.info("engine consuming {} (max {} runs/hour/user)", QUEUE, config.maxRunsPerHour());
    channel.basicConsume(QUEUE, false, engine.callback(channel), consumerTag -> {});
  }

  DeliverCallback callback(Channel channel) {
    return (consumerTag, delivery) -> {
      try {
        handle(delivery);
        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
      } catch (InvalidMessageException e) {
        log.error("invalid message — dead-lettering", e);
        channel.basicReject(delivery.getEnvelope().getDeliveryTag(), false);
      } catch (Exception e) {
        log.error("run processing failed — dead-lettering", e);
        channel.basicReject(delivery.getEnvelope().getDeliveryTag(), false);
      }
    };
  }

  void handle(Delivery delivery) throws Exception {
    RunRequested message;
    try {
      message = mapper.readValue(delivery.getBody(), RunRequested.class);
    } catch (Exception e) {
      throw new InvalidMessageException(e);
    }
    if (message.runId() == null || message.userId() == null) {
      throw new InvalidMessageException(new IllegalArgumentException("missing runId/userId"));
    }
    try {
      processor.process(message);
    } catch (Exception e) {
      runs.markFailed(message.runId(), message.userId(), "engine dispatch failed");
      throw e;
    }
  }

  static final class InvalidMessageException extends Exception {
    InvalidMessageException(Throwable cause) {
      super(cause);
    }
  }
}
