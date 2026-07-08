using System.Security.Claims;
using Consilience.Gateway;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();

var clerkAuthority =
    builder.Configuration["Clerk:Authority"]
    ?? throw new InvalidOperationException("Clerk:Authority is not configured.");
var allowedOrigins =
    builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = clerkAuthority;
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = clerkAuthority,
            // Clerk session tokens carry the origin in `azp` rather than `aud`
            ValidateAudience = false,
            NameClaimType = "sub",
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var azp = context.Principal?.FindFirstValue("azp");
                if (azp is not null && !allowedOrigins.Contains(azp))
                    context.Fail("Token authorized party is not an allowed origin.");
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddOpenApi();

builder.Services.AddSingleton(_ =>
    NpgsqlDataSource.Create(PostgresUrl.ToConnectionString(
        builder.Configuration["DATABASE_URL"]
        ?? throw new InvalidOperationException("DATABASE_URL is not set."))));
builder.Services.AddSingleton<IUserStore, PostgresUserStore>();
builder.Services.AddSingleton<IRunStore, PostgresRunStore>();
builder.Services.AddSingleton<IRunPublisher, RabbitMqRunPublisher>();

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapOpenApi();

const int MaxActiveRuns = 3;

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet(
        "/api/me",
        async (ClaimsPrincipal principal, IUserStore users, CancellationToken ct) =>
        {
            var clerkUserId = principal.FindFirstValue("sub");
            if (clerkUserId is null) return Results.Unauthorized();

            var email = principal.FindFirstValue("email");
            await users.UpsertAsync(clerkUserId, email, ct);
            return Results.Ok(new MeResponse(clerkUserId, email));
        })
    .RequireAuthorization();

app.MapPost(
        "/api/runs",
        async (
            CreateRunRequest request,
            ClaimsPrincipal principal,
            IUserStore users,
            IRunStore runs,
            IRunPublisher publisher,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var clerkUserId = principal.FindFirstValue("sub");
            if (clerkUserId is null) return Results.Unauthorized();

            var question = request.Question?.Trim() ?? "";
            if (question.Length is < 10 or > 500)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["question"] = ["Question must be between 10 and 500 characters."],
                });
            }

            var userId = await users.UpsertAsync(
                clerkUserId, principal.FindFirstValue("email"), ct);

            if (await runs.CountActiveAsync(userId, ct) >= MaxActiveRuns)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status429TooManyRequests,
                    title: "Too many active runs",
                    detail: $"At most {MaxActiveRuns} runs may be queued or running at once.");
            }

            var runId = await runs.CreateAsync(userId, question, ct);
            try
            {
                await publisher.PublishRunRequestedAsync(
                    new RunRequestedMessage(runId, userId, question, DateTimeOffset.UtcNow), ct);
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "failed to dispatch run {RunId}", runId);
                await runs.MarkFailedAsync(userId, runId, "dispatch to the research mesh failed", ct);
                return Results.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Run could not be dispatched");
            }

            return Results.Created($"/api/runs/{runId}", new { runId });
        })
    .RequireAuthorization();

app.MapGet(
        "/api/runs",
        async (ClaimsPrincipal principal, IUserStore users, IRunStore runs, CancellationToken ct) =>
        {
            var clerkUserId = principal.FindFirstValue("sub");
            if (clerkUserId is null) return Results.Unauthorized();
            var userId = await users.UpsertAsync(
                clerkUserId, principal.FindFirstValue("email"), ct);
            return Results.Ok(await runs.ListAsync(userId, ct));
        })
    .RequireAuthorization();

app.MapGet(
        "/api/runs/{runId:guid}",
        async (
            Guid runId,
            ClaimsPrincipal principal,
            IUserStore users,
            IRunStore runs,
            CancellationToken ct) =>
        {
            var clerkUserId = principal.FindFirstValue("sub");
            if (clerkUserId is null) return Results.Unauthorized();
            var userId = await users.UpsertAsync(
                clerkUserId, principal.FindFirstValue("email"), ct);
            var run = await runs.GetAsync(userId, runId, ct);
            return run is null ? Results.NotFound() : Results.Ok(run);
        })
    .RequireAuthorization();

app.Run();

public sealed record MeResponse(string UserId, string? Email);

public sealed record CreateRunRequest(string? Question);

// Exposes the implicit Program class to WebApplicationFactory in tests
public partial class Program;
