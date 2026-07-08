using System.Security.Claims;
using Consilience.Gateway;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

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
builder.Services.AddSingleton<IUserStore, PostgresUserStore>();

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapOpenApi();

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

app.Run();

public sealed record MeResponse(string UserId, string? Email);

// Exposes the implicit Program class to WebApplicationFactory in tests
public partial class Program;
