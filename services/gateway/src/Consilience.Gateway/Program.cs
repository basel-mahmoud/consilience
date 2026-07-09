using System.Security.Claims;
using System.Threading.RateLimiting;
using Consilience.Gateway;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();

// Cap request bodies — the API only accepts small JSON payloads
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 64 * 1024);
builder.Services.AddProblemDetails();

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
            // WebSocket clients can't set an Authorization header — SignalR passes
            // the Clerk token as ?access_token= on the hub path instead.
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken) &&
                    context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

// Per-caller request rate limit (identity when authenticated, else remote IP)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var key = context.User.FindFirstValue("sub")
            ?? context.Connection.RemoteIpAddress?.ToString()
            ?? "anonymous";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 120,
            Window = TimeSpan.FromMinutes(1),
        });
    });
});

builder.Services.AddSingleton(_ =>
    NpgsqlDataSource.Create(PostgresUrl.ToConnectionString(
        builder.Configuration["DATABASE_URL"]
        ?? throw new InvalidOperationException("DATABASE_URL is not set."))));
builder.Services.AddSingleton<IUserStore, PostgresUserStore>();
builder.Services.AddSingleton<IRunStore, PostgresRunStore>();
builder.Services.AddSingleton<IRunPublisher, RabbitMqRunPublisher>();
builder.Services.AddScoped<ITraceStore, PostgresTraceStore>();
builder.Services.AddHostedService<TraceRelay>();

var app = builder.Build();

// Generic problem-details errors in production (never leak stack traces);
// the developer exception page stays on only in Development.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
}
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapOpenApi();
app.MapHub<TraceHub>("/hubs/trace");

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

app.MapGet(
        "/api/runs/{runId:guid}/trace",
        async (
            Guid runId,
            ClaimsPrincipal principal,
            IUserStore users,
            IRunStore runs,
            ITraceStore traces,
            CancellationToken ct) =>
        {
            var clerkUserId = principal.FindFirstValue("sub");
            if (clerkUserId is null) return Results.Unauthorized();
            var userId = await users.UpsertAsync(clerkUserId, principal.FindFirstValue("email"), ct);
            // Ownership is enforced by scoping the trace query to the user id
            if (await runs.GetAsync(userId, runId, ct) is null) return Results.NotFound();
            return Results.Ok(await traces.ListAsync(userId, runId, ct));
        })
    .RequireAuthorization();

app.MapPost(
        "/api/runs/{runId:guid}/approve",
        async (
            Guid runId,
            ClaimsPrincipal principal,
            IUserStore users,
            IRunStore runs,
            IRunPublisher publisher,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var clerkUserId = principal.FindFirstValue("sub");
            if (clerkUserId is null) return Results.Unauthorized();
            var userId = await users.UpsertAsync(clerkUserId, principal.FindFirstValue("email"), ct);

            // Re-queue only if the caller owns the run and it is awaiting approval
            var question = await runs.RequeueApprovedAsync(userId, runId, ct);
            if (question is null) return Results.NotFound();

            try
            {
                await publisher.PublishRunApprovedAsync(
                    new RunRequestedMessage(runId, userId, question, DateTimeOffset.UtcNow), ct);
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "failed to dispatch approved run {RunId}", runId);
                await runs.MarkFailedAsync(userId, runId, "dispatch after approval failed", ct);
                return Results.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Approved run could not be dispatched");
            }

            return Results.Ok(new { runId, status = "queued" });
        })
    .RequireAuthorization();

app.MapDelete(
        "/api/account",
        async (
            ClaimsPrincipal principal,
            IUserStore users,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var clerkUserId = principal.FindFirstValue("sub");
            if (clerkUserId is null) return Results.Unauthorized();

            var deleted = await users.DeleteByClerkIdAsync(clerkUserId, ct);
            // Audit the erasure without logging the user id in plaintext
            logger.LogInformation("account data deletion requested (existed: {Existed})", deleted);
            // The caller deletes the Clerk identity separately (client-side user.delete()).
            return Results.Ok(new { deleted });
        })
    .RequireAuthorization();

app.MapPost(
        "/api/runs/{runId:guid}/reject",
        async (
            Guid runId,
            ClaimsPrincipal principal,
            IUserStore users,
            IRunStore runs,
            CancellationToken ct) =>
        {
            var clerkUserId = principal.FindFirstValue("sub");
            if (clerkUserId is null) return Results.Unauthorized();
            var userId = await users.UpsertAsync(clerkUserId, principal.FindFirstValue("email"), ct);

            var rejected = await runs.RejectAsync(userId, runId, ct);
            return rejected ? Results.Ok(new { runId, status = "rejected" }) : Results.NotFound();
        })
    .RequireAuthorization();

app.Run();

public sealed record MeResponse(string UserId, string? Email);

public sealed record CreateRunRequest(string? Question);

// Exposes the implicit Program class to WebApplicationFactory in tests
public partial class Program;
