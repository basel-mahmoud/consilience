using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Consilience.Gateway;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Consilience.Gateway.Tests;

/// <summary>
/// Runs the real pipeline (JwtBearer + azp check + endpoints) against a local
/// test signing key instead of Clerk's JWKS endpoint.
/// </summary>
public sealed class GatewayFactory : WebApplicationFactory<Program>
{
    public const string Issuer = "https://test-issuer.example";
    public static readonly SymmetricSecurityKey SigningKey =
        new(SHA256.HashData("consilience-gateway-test-key"u8.ToArray()));

    public FakeUserStore Users { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.AddSingleton<IUserStore>(Users);
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
    public List<(string ClerkUserId, string? Email)> Upserts { get; } = [];

    public Task UpsertAsync(string clerkUserId, string? email, CancellationToken ct)
    {
        Upserts.Add((clerkUserId, email));
        return Task.CompletedTask;
    }
}

public class AuthTests : IClassFixture<GatewayFactory>
{
    private readonly GatewayFactory _factory;

    public AuthTests(GatewayFactory factory) => _factory = factory;

    private static string CreateToken(
        string sub = "user_test123",
        string? email = "test@example.com",
        string? azp = null,
        TimeSpan? lifetime = null)
    {
        var claims = new Dictionary<string, object> { ["sub"] = sub };
        if (email is not null) claims["email"] = email;
        if (azp is not null) claims["azp"] = azp;

        var now = DateTime.UtcNow;
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = GatewayFactory.Issuer,
            Claims = claims,
            IssuedAt = now.AddMinutes(-15),
            NotBefore = now.AddMinutes(-15),
            Expires = now.Add(lifetime ?? TimeSpan.FromMinutes(5)),
            SigningCredentials = new SigningCredentials(
                GatewayFactory.SigningKey, SecurityAlgorithms.HmacSha256),
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    private HttpClient ClientWithToken(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task Health_RequiresNoAuth()
    {
        var response = await _factory.CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var response = await _factory.CreateClient().GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithValidToken_ReturnsIdentity_AndUpsertsUser()
    {
        var response = await ClientWithToken(CreateToken(sub: "user_abc"))
            .GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await response.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(me);
        Assert.Equal("user_abc", me.UserId);
        Assert.Equal("test@example.com", me.Email);
        Assert.Contains(("user_abc", "test@example.com"), _factory.Users.Upserts);
    }

    [Fact]
    public async Task Me_WithExpiredToken_Returns401()
    {
        var expired = CreateToken(lifetime: TimeSpan.FromMinutes(-10));
        var response = await ClientWithToken(expired).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithTamperedToken_Returns401()
    {
        var tampered = CreateToken() + "x";
        var response = await ClientWithToken(tampered).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithDisallowedAzp_Returns401()
    {
        var token = CreateToken(azp: "https://evil.example");
        var response = await ClientWithToken(token).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithAllowedAzp_Returns200()
    {
        // http://localhost:3000 is in appsettings Cors:AllowedOrigins
        var token = CreateToken(azp: "http://localhost:3000");
        var response = await ClientWithToken(token).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
