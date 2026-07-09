using System.Net;
using System.Net.Http.Headers;

namespace Consilience.Gateway.Tests;

public class ApprovalTests(GatewayFactory factory) : IClassFixture<GatewayFactory>
{
    private HttpClient AuthedClient(string sub)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.Create(sub: sub));
        return client;
    }

    // The gateway derives the internal user id from the Clerk sub via the fake user store.
    private Guid UserIdFor(string sub) => factory.Users.UpsertAsync(sub, null, default).Result;

    [Fact]
    public async Task Approve_WithoutToken_Returns401()
    {
        var response = await factory.CreateClient()
            .PostAsync($"/api/runs/{Guid.NewGuid()}/approve", null);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Approve_AwaitingRun_RequeuesAndPublishesApproved()
    {
        var runId = Guid.NewGuid();
        var userId = UserIdFor("user_approve");
        factory.Runs.AwaitingApproval[(userId, runId)] = "a sensitive question";

        var response = await AuthedClient("user_approve").PostAsync($"/api/runs/{runId}/approve", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(runId, factory.Runs.Requeued);
        Assert.Contains(factory.Publisher.Approved, m => m.RunId == runId && m.UserId == userId);
    }

    [Fact]
    public async Task Approve_RunNotAwaiting_Returns404()
    {
        var response = await AuthedClient("user_approve")
            .PostAsync($"/api/runs/{Guid.NewGuid()}/approve", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Approve_OtherUsersRun_Returns404_AndDoesNotPublish()
    {
        var runId = Guid.NewGuid();
        var ownerId = UserIdFor("user_owner");
        factory.Runs.AwaitingApproval[(ownerId, runId)] = "a sensitive question";

        // A different user tries to approve it
        var response = await AuthedClient("user_intruder").PostAsync($"/api/runs/{runId}/approve", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain(factory.Publisher.Approved, m => m.RunId == runId);
    }

    [Fact]
    public async Task Reject_AwaitingRun_MarksRejected()
    {
        var runId = Guid.NewGuid();
        var userId = UserIdFor("user_reject");
        factory.Runs.AwaitingApproval[(userId, runId)] = "a sensitive question";

        var response = await AuthedClient("user_reject").PostAsync($"/api/runs/{runId}/reject", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(runId, factory.Runs.Rejected);
    }

    [Fact]
    public async Task Reject_RunNotAwaiting_Returns404()
    {
        var response = await AuthedClient("user_reject")
            .PostAsync($"/api/runs/{Guid.NewGuid()}/reject", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
