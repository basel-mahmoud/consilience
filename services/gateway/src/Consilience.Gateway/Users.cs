using Npgsql;

namespace Consilience.Gateway;

public interface IUserStore
{
    /// <summary>Records a Clerk user on first sight and bumps last_seen_at after.</summary>
    Task UpsertAsync(string clerkUserId, string? email, CancellationToken ct);
}

public sealed class PostgresUserStore : IUserStore, IAsyncDisposable
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresUserStore(IConfiguration configuration)
    {
        var url =
            configuration["DATABASE_URL"]
            ?? throw new InvalidOperationException("DATABASE_URL is not set.");
        _dataSource = NpgsqlDataSource.Create(PostgresUrl.ToConnectionString(url));
    }

    public async Task UpsertAsync(string clerkUserId, string? email, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO users (clerk_user_id, email)
            VALUES ($1, $2)
            ON CONFLICT (clerk_user_id) DO UPDATE
            SET email = COALESCE(EXCLUDED.email, users.email),
                last_seen_at = now()
            """;
        await using var command = _dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(clerkUserId);
        command.Parameters.AddWithValue((object?)email ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(ct);
    }

    public ValueTask DisposeAsync() => _dataSource.DisposeAsync();
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
