using System.Net;

namespace Consilience.Gateway.Tests;

public class SecurityTests(GatewayFactory factory) : IClassFixture<GatewayFactory>
{
    [Fact]
    public async Task Responses_CarrySecurityHeaders()
    {
        var response = await factory.CreateClient().GetAsync("/health");

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.Contains("frame-ancestors 'none'",
            response.Headers.GetValues("Content-Security-Policy").Single());
    }

    [Fact]
    public async Task ExceedingTheRateLimit_Returns429()
    {
        // A dedicated host so exhausting the fixed window can't affect other tests
        using var isolated = new GatewayFactory();
        var client = isolated.CreateClient();

        // The per-IP window is 120/min; a burst past it must start returning 429
        var sawTooMany = false;
        for (var i = 0; i < 200; i++)
        {
            var response = await client.GetAsync("/health");
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                sawTooMany = true;
                break;
            }
        }

        Assert.True(sawTooMany, "expected a 429 once the fixed window was exhausted");
    }
}
