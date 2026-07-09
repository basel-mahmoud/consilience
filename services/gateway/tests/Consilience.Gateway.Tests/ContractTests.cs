using System.Text.Json;

namespace Consilience.Gateway.Tests;

/// <summary>
/// Boundary tests: the JSON the gateway produces for the engine/mesh, and the trace JSON it
/// consumes from the mesh, must match packages/contracts. Serialization uses Web defaults
/// (camelCase), matching the mesh (Pydantic aliases) and engine (Jackson) models.
/// </summary>
public class ContractTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public void RunRequested_SerializesToTheContractShape()
    {
        var message = new RunRequestedMessage(
            Guid.Parse("5a6c1a1e-9d1f-4d3a-8a52-0f6f6c1c2d3e"),
            Guid.Parse("1b2d3f4a-5c6e-4788-99aa-bbccddeeff00"),
            "What is the current state of solid-state batteries?",
            DateTimeOffset.Parse("2026-07-09T17:00:00Z"));

        using var doc = JsonDocument.Parse(JsonSerializer.SerializeToUtf8Bytes(message, Web));
        var root = doc.RootElement;

        // Exactly the fields the contract requires, in camelCase
        Assert.Equal("5a6c1a1e-9d1f-4d3a-8a52-0f6f6c1c2d3e", root.GetProperty("runId").GetString());
        Assert.Equal("1b2d3f4a-5c6e-4788-99aa-bbccddeeff00", root.GetProperty("userId").GetString());
        Assert.Equal(
            "What is the current state of solid-state batteries?",
            root.GetProperty("question").GetString());
        Assert.True(root.TryGetProperty("requestedAt", out _));
    }

    [Fact]
    public void TraceEvent_DeserializesFromTheMeshShape()
    {
        // This is exactly what mesh/trace.py RabbitTracer publishes
        const string meshJson = """
            {"runId":"5a6c1a1e-9d1f-4d3a-8a52-0f6f6c1c2d3e",
             "userId":"1b2d3f4a-5c6e-4788-99aa-bbccddeeff00",
             "seq":3,"type":"agent.completed",
             "message":"Primary evidence: 9 claims, 11 sources",
             "data":{"lens":"primary","claims":9,"sources":11},
             "at":"2026-07-09T17:00:00+00:00"}
            """;

        var trace = JsonSerializer.Deserialize<TraceEvent>(meshJson, Web);

        Assert.NotNull(trace);
        Assert.Equal(3, trace.Seq);
        Assert.Equal("agent.completed", trace.Type);
        Assert.Equal("Primary evidence: 9 claims, 11 sources", trace.Message);
        Assert.Equal(9, trace.Data!.Value.GetProperty("claims").GetInt32());
    }

    [Fact]
    public void TraceEvent_WithoutData_Deserializes()
    {
        const string meshJson = """
            {"runId":"5a6c1a1e-9d1f-4d3a-8a52-0f6f6c1c2d3e",
             "userId":"1b2d3f4a-5c6e-4788-99aa-bbccddeeff00",
             "seq":0,"type":"run.started","message":"Dispatching research agents",
             "at":"2026-07-09T17:00:00+00:00"}
            """;

        var trace = JsonSerializer.Deserialize<TraceEvent>(meshJson, Web);

        Assert.NotNull(trace);
        Assert.Null(trace.Data);
        Assert.Equal("run.started", trace.Type);
    }
}
