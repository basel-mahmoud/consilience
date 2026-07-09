using System.Linq;
using System.Security.Cryptography;
using Consilience.Gateway;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace Consilience.Gateway.Tests;

/// <summary>
/// Runs the real pipeline (JwtBearer + azp check + endpoints) against a local
/// test signing key instead of Clerk's JWKS, with in-memory stores so no
/// Postgres or RabbitMQ connection is needed.
/// </summary>
public sealed class GatewayFactory : WebApplicationFactory<Program>
{
    public const string Issuer = "https://test-issuer.example";
    public static readonly SymmetricSecurityKey SigningKey =
        new(SHA256.HashData("consilience-gateway-test-key"u8.ToArray()));

    public FakeUserStore Users { get; } = new();
    public FakeRunStore Runs { get; } = new();
    public FakeRunPublisher Publisher { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("DATABASE_URL", "postgresql://ignored:ignored@localhost/ignored");
        builder.UseSetting("RABBITMQ_URL", "amqp://guest:guest@localhost:5672");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IUserStore>();
            services.RemoveAll<IRunStore>();
            services.RemoveAll<IRunPublisher>();
            services.AddSingleton<IUserStore>(Users);
            services.AddSingleton<IRunStore>(Runs);
            services.AddSingleton<IRunPublisher>(Publisher);

            // The trace relay needs a live broker; it isn't under test here
            var relay = services.FirstOrDefault(d => d.ImplementationType == typeof(TraceRelay));
            if (relay is not null) services.Remove(relay);

            services.PostConfigure<JwtBearerOptions>(
                JwtBearerDefaults.AuthenticationScheme,
                options =>
                {
                    options.Authority = null;
                    options.ConfigurationManager = null;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidIssuer = Issuer,
                        IssuerSigningKey = SigningKey,
                        ValidateAudience = false,
                        NameClaimType = "sub",
                    };
                });
        });
    }
}

public sealed class FakeUserStore : IUserStore
{
    private readonly Dictionary<string, Guid> _ids = [];
    public List<(string ClerkUserId, string? Email)> Upserts { get; } = [];

    public Task<Guid> UpsertAsync(string clerkUserId, string? email, CancellationToken ct)
    {
        Upserts.Add((clerkUserId, email));
        if (!_ids.TryGetValue(clerkUserId, out var id))
            _ids[clerkUserId] = id = Guid.NewGuid();
        return Task.FromResult(id);
    }
}

public sealed class FakeRunStore : IRunStore
{
    public List<(Guid UserId, string Question)> Created { get; } = [];
    public List<(Guid UserId, Guid RunId, string Error)> Failed { get; } = [];
    public int ActiveCount { get; set; }
    public Dictionary<(Guid UserId, Guid RunId), RunDetail> Details { get; } = [];
    public Guid NextRunId { get; set; } = Guid.NewGuid();

    // Runs that RequeueApproved/Reject will treat as awaiting_approval, keyed by (user, run)
    public Dictionary<(Guid UserId, Guid RunId), string> AwaitingApproval { get; } = [];
    public List<Guid> Requeued { get; } = [];
    public List<Guid> Rejected { get; } = [];

    public Task<Guid> CreateAsync(Guid userId, string question, CancellationToken ct)
    {
        Created.Add((userId, question));
        return Task.FromResult(NextRunId);
    }

    public Task<int> CountActiveAsync(Guid userId, CancellationToken ct) =>
        Task.FromResult(ActiveCount);

    public Task<string?> RequeueApprovedAsync(Guid userId, Guid runId, CancellationToken ct)
    {
        if (AwaitingApproval.TryGetValue((userId, runId), out var question))
        {
            AwaitingApproval.Remove((userId, runId));
            Requeued.Add(runId);
            return Task.FromResult<string?>(question);
        }
        return Task.FromResult<string?>(null);
    }

    public Task<bool> RejectAsync(Guid userId, Guid runId, CancellationToken ct)
    {
        if (AwaitingApproval.Remove((userId, runId)))
        {
            Rejected.Add(runId);
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }

    public Task<IReadOnlyList<RunListItem>> ListAsync(Guid userId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<RunListItem>>(
            [.. Details.Where(kvp => kvp.Key.UserId == userId)
                .Select(kvp => new RunListItem(
                    kvp.Value.Id, kvp.Value.Question, kvp.Value.Status,
                    kvp.Value.CreatedAt, kvp.Value.CompletedAt,
                    kvp.Value.Claims.Length, kvp.Value.Sources.Length))]);

    public Task<RunDetail?> GetAsync(Guid userId, Guid runId, CancellationToken ct) =>
        Task.FromResult(Details.GetValueOrDefault((userId, runId)));

    public Task MarkFailedAsync(Guid userId, Guid runId, string error, CancellationToken ct)
    {
        Failed.Add((userId, runId, error));
        return Task.CompletedTask;
    }
}

public sealed class FakeRunPublisher : IRunPublisher
{
    public List<RunRequestedMessage> Published { get; } = [];
    public List<RunRequestedMessage> Approved { get; } = [];
    public Exception? ThrowOnPublish { get; set; }

    public Task PublishRunRequestedAsync(RunRequestedMessage message, CancellationToken ct)
    {
        if (ThrowOnPublish is not null) throw ThrowOnPublish;
        Published.Add(message);
        return Task.CompletedTask;
    }

    public Task PublishRunApprovedAsync(RunRequestedMessage message, CancellationToken ct)
    {
        if (ThrowOnPublish is not null) throw ThrowOnPublish;
        Approved.Add(message);
        return Task.CompletedTask;
    }
}
