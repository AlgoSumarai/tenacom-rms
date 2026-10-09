using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Dapper;
using MySqlConnector;

namespace Tenacom.Api.Infrastructure;

public sealed class Database(IConfiguration configuration)
{
    public async Task<MySqlConnection> Open(CancellationToken ct)
    {
        // IDs are explicit string contracts; prevent automatic CHAR(36) -> Guid coercion.
        var settings = new MySqlConnectionStringBuilder(configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Database connection is required.")) { GuidFormat = MySqlGuidFormat.None };
        var connection = new MySqlConnection(settings.ConnectionString);
        await connection.OpenAsync(ct);
        return connection;
    }
    public static CommandDefinition Sql(string sql, object? args = null, MySqlTransaction? tx = null, CancellationToken ct = default)
        => new(sql, args, tx, cancellationToken: ct);
    public static Task Audit(MySqlConnection db, MySqlTransaction tx, string? actor, string action, string id, object? details, CancellationToken ct)
        => db.ExecuteAsync(Sql("INSERT INTO AuditEvents(ActorId,Action,EntityId,OccurredAt,Details) VALUES(@actor,@action,@id,UTC_TIMESTAMP(6),@details)",
            new { actor, action, id, details = JsonSerializer.Serialize(details ?? new { }) }, tx, ct));
    public async Task Migrate(CancellationToken ct)
    {
        await using var db = await Open(ct);
        if (await db.ExecuteScalarAsync<int>(Sql("SELECT GET_LOCK('tenacom_migrations',30)", ct: ct)) != 1)
            throw new InvalidOperationException("Could not acquire migration lock.");
        try
        {
            await db.ExecuteAsync(Sql("CREATE TABLE IF NOT EXISTS SchemaMigrations (Name varchar(200) PRIMARY KEY, Hash char(64) NOT NULL, AppliedAt datetime(6) NOT NULL)", ct: ct));
            var assembly = Assembly.GetExecutingAssembly();
            foreach (var name in assembly.GetManifestResourceNames().Where(n => n.EndsWith(".sql", StringComparison.Ordinal)).Order())
            {
                using var reader = new StreamReader(assembly.GetManifestResourceStream(name)!);
                var sql = await reader.ReadToEndAsync(ct);
                var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sql)));
                var applied = await db.QuerySingleOrDefaultAsync<string>(Sql("SELECT Hash FROM SchemaMigrations WHERE Name=@name", new { name }, ct: ct));
                if (applied != null)
                {
                    if (applied != hash) throw new InvalidOperationException($"Migration checksum changed: {name}");
                    continue;
                }
                await db.ExecuteAsync(Sql(sql, ct: ct));
                await db.ExecuteAsync(Sql("INSERT INTO SchemaMigrations VALUES(@name,@hash,UTC_TIMESTAMP(6))", new { name, hash }, ct: ct));
            }
        }
        finally { await db.ExecuteAsync("SELECT RELEASE_LOCK('tenacom_migrations')"); }
    }
}
