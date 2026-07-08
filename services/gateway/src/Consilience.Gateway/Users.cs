using Npgsql;

namespace Consilience.Gateway;

public interface IUserStore
{
    /// <summary>
    /// Records a Clerk user on first sight, bumps last_seen_at after,
    /// and returns the internal users.id used to scope all owned resources.
    /// </summary>
    Task<Guid> UpsertAsync(string clerkUserId, string? email, CancellationToken ct);
}

public sealed class PostgresUserStore(NpgsqlDataSource dataSource) : IUserStore
{
    public async Task<Guid> UpsertAsync(string clerkUserId, string? email, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO users (clerk_user_id, email)
            VALUES ($1, $2)
            ON CONFLICT (clerk_user_id) DO UPDATE
            SET email = COALESCE(EXCLUDED.email, users.email),
                last_seen_at = now()
            RETURNING id
            """;
        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(clerkUserId);
        command.Parameters.AddWithValue((object?)email ?? DBNull.Value);
        return (Guid)(await command.ExecuteScalarAsync(ct))!;
    }
}

public static class PostgresUrl
{
    /// <summary>Converts a postgresql:// URL (Neon's format) to an Npgsql connection string.</summary>
    public static string ToConnectionString(string url)
    {
        var uri = new Uri(url);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            SslMode = SslMode.Require,
        };
        return builder.ConnectionString;
    }
}
