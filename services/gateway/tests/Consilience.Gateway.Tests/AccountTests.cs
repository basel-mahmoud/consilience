using System.Net;
using System.Net.Http.Headers;

namespace Consilience.Gateway.Tests;

public class AccountTests(GatewayFactory factory) : IClassFixture<GatewayFactory>
{
    [Fact]
    public async Task DeleteAccount_WithoutToken_Returns401()
    {
        var response = await factory.CreateClient().DeleteAsync("/api/account");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_ErasesTheCallersData()
    {
        // Establish the user first (so the fake reports it existed)
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.Create(sub: "user_delete"));
        await client.GetAsync("/api/me");

        var response = await client.DeleteAsync("/api/account");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("user_delete", factory.Users.Deleted);
    }
}
