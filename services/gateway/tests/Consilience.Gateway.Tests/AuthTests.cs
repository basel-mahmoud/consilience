using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Consilience.Gateway.Tests;

internal static class TestTokens
{
    public static string Create(
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
}

public class AuthTests(GatewayFactory factory) : IClassFixture<GatewayFactory>
{
    private HttpClient ClientWithToken(string token)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task Health_RequiresNoAuth()
    {
        var response = await factory.CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var response = await factory.CreateClient().GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithValidToken_ReturnsIdentity_AndUpsertsUser()
    {
        var response = await ClientWithToken(TestTokens.Create(sub: "user_abc"))
            .GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await response.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(me);
        Assert.Equal("user_abc", me.UserId);
        Assert.Equal("test@example.com", me.Email);
        Assert.Contains(("user_abc", "test@example.com"), factory.Users.Upserts);
    }

    [Fact]
    public async Task Me_WithExpiredToken_Returns401()
    {
        var expired = TestTokens.Create(lifetime: TimeSpan.FromMinutes(-10));
        var response = await ClientWithToken(expired).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithTamperedToken_Returns401()
    {
        var tampered = TestTokens.Create() + "x";
        var response = await ClientWithToken(tampered).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithDisallowedAzp_Returns401()
    {
        var token = TestTokens.Create(azp: "https://evil.example");
        var response = await ClientWithToken(token).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithAllowedAzp_Returns200()
    {
        // http://localhost:3000 is in appsettings Cors:AllowedOrigins
        var token = TestTokens.Create(azp: "http://localhost:3000");
        var response = await ClientWithToken(token).GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
