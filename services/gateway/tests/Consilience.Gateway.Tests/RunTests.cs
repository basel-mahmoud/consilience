using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Consilience.Gateway.Tests;

public class RunTests(GatewayFactory factory) : IClassFixture<GatewayFactory>
{
    private HttpClient AuthedClient(string sub = "user_runs")
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.Create(sub: sub));
        return client;
    }

    [Fact]
    public async Task CreateRun_WithoutToken_Returns401()
    {
        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/runs", new { question = "What is consilience in science?" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("")]
    public async Task CreateRun_WithTooShortQuestion_Returns400(string question)
    {
        var response = await AuthedClient().PostAsJsonAsync("/api/runs", new { question });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        // Shared fixture: assert this invalid question was never dispatched
        Assert.DoesNotContain(factory.Publisher.Published, m => m.Question == question);
    }

    [Fact]
    public async Task CreateRun_Valid_PersistsAndPublishes()
    {
        factory.Runs.ActiveCount = 0;
        var question = "What is the current state of solid-state battery research?";

        var response = await AuthedClient("user_create")
            .PostAsJsonAsync("/api/runs", new { question });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Contains(factory.Runs.Created, r => r.Question == question);
        Assert.Contains(factory.Publisher.Published, m => m.Question == question);
        // The published message must reference the run row the gateway created
        var published = factory.Publisher.Published.Last();
        Assert.Equal(factory.Runs.NextRunId, published.RunId);
    }

    [Fact]
    public async Task CreateRun_TrimsAndValidatesTrimmedLength()
    {
        // 8 visible chars padded with whitespace — must fail on the trimmed length
        var response = await AuthedClient().PostAsJsonAsync(
            "/api/runs", new { question = "   battery    " });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateRun_OverRunLimit_Returns429()
    {
        factory.Runs.ActiveCount = 3;
        var response = await AuthedClient("user_limit").PostAsJsonAsync(
            "/api/runs", new { question = "A perfectly valid research question here." });
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        factory.Runs.ActiveCount = 0;
    }

    [Fact]
    public async Task GetRun_NotOwned_Returns404()
    {
        var response = await AuthedClient("user_x").GetAsync($"/api/runs/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListRuns_WithoutToken_Returns401()
    {
        var response = await factory.CreateClient().GetAsync("/api/runs");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
