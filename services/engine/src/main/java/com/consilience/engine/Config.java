package com.consilience.engine;

/** Environment configuration for the engine. */
public record Config(String databaseUrl, String rabbitmqUrl, int maxRunsPerHour) {

  public static Config fromEnv() {
    return new Config(
        required("DATABASE_URL"),
        required("RABBITMQ_URL"),
        Integer.parseInt(System.getenv().getOrDefault("ENGINE_MAX_RUNS_PER_HOUR", "10")));
  }

  private static String required(String name) {
    String value = System.getenv(name);
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(name + " is not set");
    }
    return value;
  }
}
