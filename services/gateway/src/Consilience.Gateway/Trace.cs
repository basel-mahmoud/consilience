using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Npgsql;
using NpgsqlTypes;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Consilience.Gateway;

/// <summary>packages/contracts/messages/trace-event.v1.json — the mesh's view over the broker.</summary>
public sealed record TraceEvent(
    Guid RunId, Guid UserId, int Seq, string Type, string Message,
    JsonElement? Data, DateTimeOffset At);

/// <summary>What the browser sees — no user id, ordered by seq.</summary>
public sealed record TraceView(int Seq, string Type, string Message, JsonElement? Data, DateTimeOffset At);

public interface ITraceStore
{
    Task AppendAsync(TraceEvent trace, CancellationToken ct);
    Task<IReadOnlyList<TraceView>> ListAsync(Guid userId, Guid runId, CancellationToken ct);
}

public sealed class PostgresTraceStore(NpgsqlDataSource dataSource) : ITraceStore
{
    public async Task AppendAsync(TraceEvent trace, CancellationToken ct)
    {
        // Idempotent on (run_id, seq): a redelivered trace event is ignored
        const string sql = """
            INSERT INTO trace_events (run_id, user_id, seq, type, message, data)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (run_id, seq) DO NOTHING
            """;
        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(trace.RunId);
        command.Parameters.AddWithValue(trace.UserId);
        command.Parameters.AddWithValue(trace.Seq);
        command.Parameters.AddWithValue(trace.Type);
        command.Parameters.AddWithValue(trace.Message);
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Jsonb,
            Value = trace.Data is { } d ? d.GetRawText() : DBNull.Value,
        });
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<TraceView>> ListAsync(Guid userId, Guid runId, CancellationToken ct)
    {
        const string sql = """
            SELECT seq, type, message, data, created_at
            FROM trace_events WHERE run_id = $1 AND user_id = $2 ORDER BY seq
            """;
        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(runId);
        command.Parameters.AddWithValue(userId);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var items = new List<TraceView>();
        while (await reader.ReadAsync(ct))
        {
            JsonElement? data = reader.IsDBNull(3)
                ? null
                : JsonDocument.Parse(reader.GetString(3)).RootElement;
            items.Add(new TraceView(
                reader.GetInt32(0), reader.GetString(1), reader.GetString(2),
                data, reader.GetDateTime(4)));
        }
        return items;
    }
}

/// <summary>
/// Streams live agent-trace events to the browser. A client subscribes to a run only after the
/// hub confirms it owns that run — trace is scoped exactly like every other resource.
/// </summary>
[Authorize]
public sealed class TraceHub(IUserStore users, IRunStore runs) : Hub
{
    public static string Group(Guid runId) => $"run:{runId}";

    public async Task Subscribe(string runId)
    {
        var clerkUserId = Context.User?.FindFirstValue("sub");
        if (clerkUserId is null || !Guid.TryParse(runId, out var id))
        {
            throw new HubException("invalid subscription");
        }
        var userId = await users.UpsertAsync(clerkUserId, Context.User?.FindFirstValue("email"),
            Context.ConnectionAborted);
        var run = await runs.GetAsync(userId, id, Context.ConnectionAborted);
        if (run is null)
        {
            throw new HubException("run not found");
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, Group(id), Context.ConnectionAborted);
    }
}

/// <summary>
/// Consumes trace events from the mesh, persists them, and fans them out to the run's SignalR
/// group. Persisting means a browser that connects mid-run still gets the full history.
/// </summary>
public sealed class TraceRelay(
    IConfiguration configuration,
    IServiceProvider services,
    IHubContext<TraceHub> hub,
    ILogger<TraceRelay> logger) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var url = configuration["RABBITMQ_URL"]
            ?? throw new InvalidOperationException("RABBITMQ_URL is not set.");
        var factory = new ConnectionFactory { Uri = new Uri(url) };

        // Retry the initial broker connection so the gateway can start before RabbitMQ
        IConnection? connection = null;
        while (connection is null && !stoppingToken.IsCancellationRequested)
        {
            try
            {
                connection = await factory.CreateConnectionAsync(stoppingToken);
            }
            catch (Exception e)
            {
                logger.LogWarning(e, "trace relay: broker not ready, retrying in 3s");
                await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
            }
        }
        if (connection is null) return;

        var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);
        await channel.ExchangeDeclareAsync("consilience", ExchangeType.Topic, durable: true,
            cancellationToken: stoppingToken);
        await channel.QueueDeclareAsync("gateway.trace", durable: true, exclusive: false,
            autoDelete: false, cancellationToken: stoppingToken);
        await channel.QueueBindAsync("gateway.trace", "consilience", "trace.event",
            cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, ea) =>
        {
            try
            {
                await HandleAsync(ea.Body.ToArray(), stoppingToken);
                await channel.BasicAckAsync(ea.DeliveryTag, false, stoppingToken);
            }
            catch (Exception e)
            {
                logger.LogError(e, "trace relay: failed to handle event");
                await channel.BasicNackAsync(ea.DeliveryTag, false, requeue: false, stoppingToken);
            }
        };
        await channel.BasicConsumeAsync("gateway.trace", autoAck: false, consumer,
            cancellationToken: stoppingToken);

        logger.LogInformation("trace relay consuming gateway.trace");
        await Task.Delay(Timeout.Infinite, stoppingToken).ContinueWith(_ => { });
    }

    private async Task HandleAsync(byte[] body, CancellationToken ct)
    {
        var trace = JsonSerializer.Deserialize<TraceEvent>(body, JsonOptions);
        if (trace is null) return;

        using var scope = services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<ITraceStore>();
        await store.AppendAsync(trace, ct);

        var view = new TraceView(trace.Seq, trace.Type, trace.Message, trace.Data, trace.At);
        await hub.Clients.Group(TraceHub.Group(trace.RunId)).SendAsync("trace", view, ct);
    }
}
