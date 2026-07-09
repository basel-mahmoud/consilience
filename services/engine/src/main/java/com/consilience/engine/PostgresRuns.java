package com.consilience.engine;

import java.net.URI;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;
import javax.sql.DataSource;
import org.postgresql.ds.PGSimpleDataSource;

/** JDBC-backed {@link Runs}. Every statement is scoped by {@code user_id}. */
public final class PostgresRuns implements Runs {
  private final DataSource dataSource;

  public PostgresRuns(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  /** Builds a TLS-enabled datasource from a Neon {@code postgresql://} URL. */
  public static PostgresRuns fromUrl(String databaseUrl) {
    URI uri = URI.create(databaseUrl);
    String[] userInfo = uri.getUserInfo().split(":", 2);
    PGSimpleDataSource ds = new PGSimpleDataSource();
    ds.setServerNames(new String[] {uri.getHost()});
    ds.setPortNumbers(new int[] {uri.getPort() > 0 ? uri.getPort() : 5432});
    ds.setDatabaseName(uri.getPath().replaceFirst("/", ""));
    ds.setUser(userInfo[0]);
    if (userInfo.length > 1) {
      ds.setPassword(userInfo[1]);
    }
    ds.setSslMode("require");
    return new PostgresRuns(ds);
  }

  @Override
  public int countRunsInLastHour(UUID userId) {
    String sql =
        "SELECT count(*) FROM runs WHERE user_id = ? AND created_at > now() - interval '1 hour'";
    try (Connection c = dataSource.getConnection();
        PreparedStatement ps = c.prepareStatement(sql)) {
      ps.setObject(1, userId);
      try (ResultSet rs = ps.executeQuery()) {
        rs.next();
        return rs.getInt(1);
      }
    } catch (SQLException e) {
      throw new RuntimeException("countRunsInLastHour failed", e);
    }
  }

  @Override
  public void markRateLimited(UUID runId, UUID userId, String reason) {
    update(
        "UPDATE runs SET status = 'rate_limited', error = left(?, 500), completed_at = now()"
            + " WHERE id = ? AND user_id = ? AND status = 'queued'",
        reason,
        runId,
        userId);
  }

  @Override
  public void markFailed(UUID runId, UUID userId, String error) {
    update(
        "UPDATE runs SET status = 'failed', error = left(?, 500), completed_at = now()"
            + " WHERE id = ? AND user_id = ? AND status = 'queued'",
        error,
        runId,
        userId);
  }

  private void update(String sql, String text, UUID runId, UUID userId) {
    try (Connection c = dataSource.getConnection();
        PreparedStatement ps = c.prepareStatement(sql)) {
      ps.setString(1, text);
      ps.setObject(2, runId);
      ps.setObject(3, userId);
      ps.executeUpdate();
    } catch (SQLException e) {
      throw new RuntimeException("run status update failed", e);
    }
  }
}
