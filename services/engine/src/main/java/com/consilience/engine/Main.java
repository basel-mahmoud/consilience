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
  static final String APPROVAL_QUEUE = "engine.approvals";
  static final String APPROVAL_ROUTING_KEY = "run.approved";

  private final RunProcessor processor;
  private final Runs runs;
  private final Dispatcher dispatcher;
  private final ObjectMapper mapper = new ObjectMapper();

  Main(RunProcessor processor, Runs runs, Dispatcher dispatcher) {
    this.processor = processor;
    this.runs = runs;
    this.dispatcher = dispatcher;
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
    channel.queueDeclare(APPROVAL_QUEUE, true, false, false, Map.of("x-dead-letter-exchange", DLX));
    channel.queueBind(APPROVAL_QUEUE, EXCHANGE, APPROVAL_ROUTING_KEY);
    channel.basicQos(4);

    Dispatcher dispatcher = new RabbitDispatcher(channel);
    RunProcessor processor = new RunProcessor(runs, dispatcher, config.maxRunsPerHour());
    Main engine = new Main(processor, runs, dispatcher);

    log.info(
        "engine consuming {} and {} (max {} runs/hour/user)",
        QUEUE,
        APPROVAL_QUEUE,
        config.maxRunsPerHour());
    channel.basicConsume(QUEUE, false, engine.callback(channel), consumerTag -> {});
    channel.basicConsume(APPROVAL_QUEUE, false, engine.approvalCallback(channel), tag -> {});
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
    RunRequested message = parse(delivery);
    try {
      processor.process(message);
    } catch (Exception e) {
      runs.markFailed(message.runId(), message.userId(), "engine dispatch failed");
      throw e;
    }
  }

  /** A human approved a gated run: dispatch it, skipping the rules that flagged it. */
  DeliverCallback approvalCallback(Channel channel) {
    return (consumerTag, delivery) -> {
      try {
        handleApproval(delivery);
        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
      } catch (InvalidMessageException e) {
        log.error("invalid approval message — dead-lettering", e);
        channel.basicReject(delivery.getEnvelope().getDeliveryTag(), false);
      } catch (Exception e) {
        log.error("approval dispatch failed — dead-lettering", e);
        channel.basicReject(delivery.getEnvelope().getDeliveryTag(), false);
      }
    };
  }

  void handleApproval(Delivery delivery) throws Exception {
    RunRequested message = parse(delivery);
    try {
      dispatcher.dispatch(message);
      log.info("approved run {} dispatched to mesh", message.runId());
    } catch (Exception e) {
      runs.markFailed(message.runId(), message.userId(), "engine dispatch failed after approval");
      throw e;
    }
  }

  private RunRequested parse(Delivery delivery) throws InvalidMessageException {
    RunRequested message;
    try {
      message = mapper.readValue(delivery.getBody(), RunRequested.class);
    } catch (Exception e) {
      throw new InvalidMessageException(e);
    }
    if (message.runId() == null || message.userId() == null) {
      throw new InvalidMessageException(new IllegalArgumentException("missing runId/userId"));
    }
    return message;
  }

  static final class InvalidMessageException extends Exception {
    InvalidMessageException(Throwable cause) {
      super(cause);
    }
  }
}
