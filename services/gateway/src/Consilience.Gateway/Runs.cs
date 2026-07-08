using System.Text.Json;
using Npgsql;
using RabbitMQ.Client;

namespace Consilience.Gateway;

public sealed record RunListItem(
    Guid Id, string Question, string Status, DateTime CreatedAt, DateTime? CompletedAt,
    int ClaimCount, int SourceCount);

public sealed record RunSource(
    int Position, string Url, string? Title, string? Credibility, string? Agent);

public sealed record RunClaim(
    int Position, string Text, string Confidence, int[] SourcePositions, string? Agent);

public sealed record RunContradiction(int ClaimA, int ClaimB, string Explanation);

public sealed record RunEvaluation(string Metric, double Score, string Rationale);

public sealed record RunDetail(
    Guid Id, string Question, string Status, string? Summary, string? Error,
    DateTime CreatedAt, DateTime? CompletedAt, RunClaim[] Claims, RunSource[] Sources,
    RunContradiction[] Contradictions, RunEvaluation[] Evaluations);

/// <summary>packages/contracts/messages/research-run-requested.v1.json</summary>
public sealed record RunRequestedMessage(Guid RunId, Guid UserId, string Question, DateTimeOffset RequestedAt);

public interface IRunStore
{
    Task<Guid> CreateAsync(Guid userId, string question, CancellationToken ct);
    Task<int> CountActiveAsync(Guid userId, CancellationToken ct);
    Task<IReadOnlyList<RunListItem>> ListAsync(Guid userId, CancellationToken ct);
    Task<RunDetail?> GetAsync(Guid userId, Guid runId, CancellationToken ct);
    Task MarkFailedAsync(Guid userId, Guid runId, string error, CancellationToken ct);
}

public interface IRunPublisher
{
    Task PublishRunRequestedAsync(RunRequestedMessage message, CancellationToken ct);
}

public sealed class PostgresRunStore(NpgsqlDataSource dataSource) : IRunStore
{
    public async Task<Guid> CreateAsync(Guid userId, string question, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(
            "INSERT INTO runs (user_id, question) VALUES ($1, $2) RETURNING id");
        command.Parameters.AddWithValue(userId);
        command.Parameters.AddWithValue(question);
        return (Guid)(await command.ExecuteScalarAsync(ct))!;
    }

    public async Task<int> CountActiveAsync(Guid userId, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(
            "SELECT count(*) FROM runs WHERE user_id = $1 AND status IN ('queued','running')");
        command.Parameters.AddWithValue(userId);
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }

    public async Task<IReadOnlyList<RunListItem>> ListAsync(Guid userId, CancellationToken ct)
    {
        const string sql = """
            SELECT r.id, r.question, r.status, r.created_at, r.completed_at,
                   (SELECT count(*)::int FROM claims c WHERE c.run_id = r.id),
                   (SELECT count(*)::int FROM sources s WHERE s.run_id = r.id)
            FROM runs r
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC
            LIMIT 50
            """;
        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(userId);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var items = new List<RunListItem>();
        while (await reader.ReadAsync(ct))
        {
            items.Add(new RunListItem(
                reader.GetGuid(0), reader.GetString(1), reader.GetString(2),
                reader.GetDateTime(3),
                reader.IsDBNull(4) ? null : reader.GetDateTime(4),
                reader.GetInt32(5), reader.GetInt32(6)));
        }
        return items;
    }

    public async Task<RunDetail?> GetAsync(Guid userId, Guid runId, CancellationToken ct)
    {
        await using var connection = await dataSource.OpenConnectionAsync(ct);

        await using var runCommand = new NpgsqlCommand(
            """
            SELECT question, status, summary, error, created_at, completed_at
            FROM runs WHERE id = $1 AND user_id = $2
            """, connection);
        runCommand.Parameters.AddWithValue(runId);
        runCommand.Parameters.AddWithValue(userId);
        await using var runReader = await runCommand.ExecuteReaderAsync(ct);
        if (!await runReader.ReadAsync(ct)) return null;
        var (question, status) = (runReader.GetString(0), runReader.GetString(1));
        var summary = runReader.IsDBNull(2) ? null : runReader.GetString(2);
        var error = runReader.IsDBNull(3) ? null : runReader.GetString(3);
        var createdAt = runReader.GetDateTime(4);
        DateTime? completedAt = runReader.IsDBNull(5) ? null : runReader.GetDateTime(5);
        await runReader.CloseAsync();

        var claims = new List<RunClaim>();
        await using (var claimCommand = new NpgsqlCommand(
            """
            SELECT c.position, c.text, c.confidence,
                   COALESCE((SELECT array_agg(s.position ORDER BY s.position)
                             FROM claim_sources cs JOIN sources s ON s.id = cs.source_id
                             WHERE cs.claim_id = c.id), '{}'),
                   ra.lens
            FROM claims c
            LEFT JOIN run_agents ra ON ra.id = c.run_agent_id
            WHERE c.run_id = $1 ORDER BY c.position
            """, connection))
        {
            claimCommand.Parameters.AddWithValue(runId);
            await using var reader = await claimCommand.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                claims.Add(new RunClaim(
                    reader.GetInt32(0), reader.GetString(1), reader.GetString(2),
                    reader.GetFieldValue<int[]>(3),
                    reader.IsDBNull(4) ? null : reader.GetString(4)));
            }
        }

        var sources = new List<RunSource>();
        await using (var sourceCommand = new NpgsqlCommand(
            """
            SELECT s.position, s.url, s.title, s.credibility, ra.lens
            FROM sources s
            LEFT JOIN run_agents ra ON ra.id = s.run_agent_id
            WHERE s.run_id = $1 ORDER BY s.position
            """, connection))
        {
            sourceCommand.Parameters.AddWithValue(runId);
            await using var reader = await sourceCommand.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                sources.Add(new RunSource(
                    reader.GetInt32(0), reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetString(4)));
            }
        }

        var contradictions = new List<RunContradiction>();
        await using (var command = new NpgsqlCommand(
            """
            SELECT ca.position, cb.position, x.explanation
            FROM contradictions x
            JOIN claims ca ON ca.id = x.claim_a_id
            JOIN claims cb ON cb.id = x.claim_b_id
            WHERE x.run_id = $1 ORDER BY ca.position
            """, connection))
        {
            command.Parameters.AddWithValue(runId);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                contradictions.Add(new RunContradiction(
                    reader.GetInt32(0), reader.GetInt32(1), reader.GetString(2)));
            }
        }

        var evaluations = new List<RunEvaluation>();
        await using (var command = new NpgsqlCommand(
            "SELECT metric, score, rationale FROM run_evaluations WHERE run_id = $1 ORDER BY metric",
            connection))
        {
            command.Parameters.AddWithValue(runId);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                evaluations.Add(new RunEvaluation(
                    reader.GetString(0), reader.GetFloat(1), reader.GetString(2)));
            }
        }

        return new RunDetail(
            runId, question, status, summary, error, createdAt, completedAt,
            [.. claims], [.. sources], [.. contradictions], [.. evaluations]);
    }

    public async Task MarkFailedAsync(Guid userId, Guid runId, string error, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(
            """
            UPDATE runs SET status = 'failed', error = $3, completed_at = now()
            WHERE id = $1 AND user_id = $2
            """);
        command.Parameters.AddWithValue(runId);
        command.Parameters.AddWithValue(userId);
        command.Parameters.AddWithValue(error);
        await command.ExecuteNonQueryAsync(ct);
    }
}

public sealed class RabbitMqRunPublisher : IRunPublisher, IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ConnectionFactory _factory;
    private readonly SemaphoreSlim _channelLock = new(1, 1);
    private IConnection? _connection;
    private IChannel? _channel;

    public RabbitMqRunPublisher(IConfiguration configuration)
    {
        var url = configuration["RABBITMQ_URL"]
            ?? throw new InvalidOperationException("RABBITMQ_URL is not set.");
        _factory = new ConnectionFactory { Uri = new Uri(url) };
    }

    public async Task PublishRunRequestedAsync(RunRequestedMessage message, CancellationToken ct)
    {
        var channel = await GetChannelAsync(ct);
        var body = JsonSerializer.SerializeToUtf8Bytes(message, JsonOptions);
        var properties = new BasicProperties
        {
            ContentType = "application/json",
            DeliveryMode = DeliveryModes.Persistent,
        };
        // Publisher confirms are enabled: this awaits broker acknowledgement
        await channel.BasicPublishAsync(
            exchange: "consilience", routingKey: "run.requested", mandatory: false,
            basicProperties: properties, body: body, cancellationToken: ct);
    }

    private async Task<IChannel> GetChannelAsync(CancellationToken ct)
    {
        if (_channel is { IsOpen: true }) return _channel;
        await _channelLock.WaitAsync(ct);
        try
        {
            if (_channel is { IsOpen: true }) return _channel;
            if (_connection is not { IsOpen: true })
                _connection = await _factory.CreateConnectionAsync(ct);
            _channel = await _connection.CreateChannelAsync(
                new CreateChannelOptions(
                    publisherConfirmationsEnabled: true,
                    publisherConfirmationTrackingEnabled: true),
                ct);
            await _channel.ExchangeDeclareAsync(
                "consilience", ExchangeType.Topic, durable: true, cancellationToken: ct);
            return _channel;
        }
        finally
        {
            _channelLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null) await _channel.DisposeAsync();
        if (_connection is not null) await _connection.DisposeAsync();
    }
}
