using Dapper;
using Microsoft.AspNetCore.Identity;
using MySqlConnector;
using Tenacom.Api.Domain;
using Tenacom.Api.Infrastructure;
using static Tenacom.Api.Infrastructure.Database;

namespace Tenacom.Api.Application;

public sealed class AccountService(Database database, Actor actor, PasswordHasher<string> hasher, PasswordSecurity passwords)
{
    public async Task<(UserDto User, string Token)> Login(LoginRequest request, CancellationToken ct)
    {
        var email = Rules.Email(request.Email);
        Rules.Require(request.Password is { Length: > 0 and <= 128 }, "Enter your password.");
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        var row = await db.QuerySingleOrDefaultAsync<LoginRow>(Sql("SELECT Id,PasswordHash,Role,Active,LockedUntil FROM Users WHERE Email=@email FOR UPDATE", new { email }, tx, ct));
        var staffAccount = row is { Role: "Admin" or "Manager", PasswordHash: not null };
        var result = hasher.VerifyHashedPassword(staffAccount ? row!.Id : "dummy", staffAccount ? row!.PasswordHash! : passwords.DummyHash, request.Password);
        if (!staffAccount || !row!.Active || row.LockedUntil > DateTime.UtcNow || result == PasswordVerificationResult.Failed)
        {
            if (staffAccount && (row!.LockedUntil <= DateTime.UtcNow || row.LockedUntil == null))
                await db.ExecuteAsync(Sql("UPDATE Users SET FailedLogins=IF(LockedUntil<=UTC_TIMESTAMP(6),1,FailedLogins+1),LockedUntil=IF(FailedLogins>=5,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),NULL) WHERE Id=@Id", row, tx, ct));
            await tx.CommitAsync(ct);
            throw new AppException(401, "Unable to sign in. Check your details or try again later.");
        }
        await db.ExecuteAsync(Sql("UPDATE Users SET FailedLogins=0,LockedUntil=NULL,PasswordHash=@hash WHERE Id=@Id", new { row.Id, hash = result == PasswordVerificationResult.SuccessRehashNeeded ? hasher.HashPassword(row.Id, request.Password) : row.PasswordHash }, tx, ct));
        var token = Tokens.Create();
        await db.ExecuteAsync(Sql("DELETE FROM Sessions WHERE UserId=@Id AND ExpiresAt<=UTC_TIMESTAMP(6); INSERT INTO Sessions VALUES(@hash,@Id,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 12 HOUR))", new { row.Id, hash = Tokens.Hash(token) }, tx, ct));
        var user = await db.QuerySingleAsync<UserDto>(Sql("SELECT Id,Email,Name,Role,Active,Version FROM Users WHERE Id=@Id", row, tx, ct));
        await Audit(db, tx, row.Id, "session.created", row.Id, null, ct);
        await tx.CommitAsync(ct);
        return (user, token);
    }
    public async Task Logout(string? token, CancellationToken ct)
    {
        if (token == null) return;
        await using var db = await database.Open(ct);
        await db.ExecuteAsync(Sql("DELETE FROM Sessions WHERE TokenHash=@hash", new { hash = Tokens.Hash(token) }, ct: ct));
    }
    public async Task<UserDto> Me(CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        return await db.QuerySingleAsync<UserDto>(Sql("SELECT Id,Email,Name,Role,Active,Version FROM Users WHERE Id=@Id", new { actor.Id }, ct: ct));
    }
    public async Task<UserDto> Get(string id, CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        var user = await db.QuerySingleOrDefaultAsync<UserDto>(Sql("SELECT Id,Email,Name,Role,Active,Version FROM Users WHERE Id=@id", new { id }, ct: ct));
        Rules.Found(user != null && (actor.Role == "Admin" || actor.Role == "Manager" && user.Role == "Resource"));
        return user!;
    }
    public async Task ChangePassword(PasswordRequest request, CancellationToken ct)
    {
        Rules.Password(request.NewPassword);
        Rules.Require(request.CurrentPassword is { Length: > 0 and <= 128 }, "Enter your current password.");
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        var old = await db.QuerySingleAsync<string>(Sql("SELECT PasswordHash FROM Users WHERE Id=@Id FOR UPDATE", new { actor.Id }, tx, ct));
        Rules.Require(hasher.VerifyHashedPassword(actor.Id, old, request.CurrentPassword) != PasswordVerificationResult.Failed, "Current password is incorrect.");
        await db.ExecuteAsync(Sql("UPDATE Users SET PasswordHash=@hash,UpdatedAt=UTC_TIMESTAMP(6) WHERE Id=@Id; DELETE FROM Sessions WHERE UserId=@Id", new { actor.Id, hash = hasher.HashPassword(actor.Id, request.NewPassword) }, tx, ct));
        await Audit(db, tx, actor.Id, "password.changed", actor.Id, null, ct);
        await tx.CommitAsync(ct);
    }
    public async Task<Page<UserDto>> List(string? q, int page, CancellationToken ct, string? kind = null, string? status = null, string? sort = null)
    {
        page = Math.Clamp(page, 1, 100000);
        if (!string.IsNullOrEmpty(kind)) Rules.OneOf(kind, ["staff", "resources"], "person type");
        if (!string.IsNullOrEmpty(status)) Rules.OneOf(status, ["active", "inactive"], "account status");
        if (!string.IsNullOrEmpty(sort)) Rules.OneOf(sort, ["name", "email", "role"], "sort order");
        await using var db = await database.Open(ct);
        const string where = " WHERE (@admin=1 OR Role='Resource') AND (@kind='' OR (@kind='staff' AND Role IN ('Admin','Manager')) OR (@kind='resources' AND Role='Resource')) AND (@status='' OR (@status='active' AND Active=1) OR (@status='inactive' AND Active=0)) AND (@q='' OR Name LIKE @search OR Email LIKE @search)";
        var args = new { admin = actor.Role == "Admin", kind = kind ?? "", status = status ?? "", q = Rules.Text(q, "Search", 100, false), search = $"%{q?.Trim()}%", offset = (page - 1) * 20 };
        var order = sort switch { "email" => "Email,Id", "role" => "Role,Name,Id", _ => "Name,Id" };
        var count = await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*) FROM Users" + where, args, ct: ct));
        var rows = await db.QueryAsync<UserDto>(Sql("SELECT Id,Email,Name,Role,Active,Version FROM Users" + where + " ORDER BY " + order + " LIMIT 20 OFFSET @offset", args, ct: ct));
        return new(rows.ToList(), count, page, 20);
    }
    public async Task<string> Create(UserCreate request, CancellationToken ct)
    {
        Rules.ManageUser(actor.Role, request.Role, request.Role);
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        var id = await Insert(db, tx, request, ct);
        await Audit(db, tx, actor.Id, "user.created", id, new { request.Role }, ct);
        await tx.CommitAsync(ct);
        return id;
    }
    public async Task<string> Insert(MySqlConnection db, MySqlTransaction tx, UserCreate request, CancellationToken ct)
    {
        var email = Rules.Email(request.Email);
        var name = Rules.Text(request.Name, "Name", 120);
        var role = Rules.OneOf(request.Role, Rules.Roles, "role");
        if (role == "Resource") Rules.Require(string.IsNullOrEmpty(request.Password), "Resource profiles do not use passwords.");
        else Rules.Password(request.Password);
        var id = Guid.NewGuid().ToString();
        var hash = role == "Resource" ? null : hasher.HashPassword(id, request.Password!);
        await db.ExecuteAsync(Sql("INSERT INTO Users(Id,Email,Name,Role,PasswordHash,CreatedAt,UpdatedAt) VALUES(@id,@email,@name,@role,@hash,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))", new { id, email, name, role, hash }, tx, ct));
        if (role == "Resource") await db.ExecuteAsync(Sql("INSERT INTO ResourceProfiles(UserId,Summary,UpdatedAt) VALUES(@id,'',UTC_TIMESTAMP(6))", new { id }, tx, ct));
        return id;
    }
    public async Task Update(string id, UserUpdate request, CancellationToken ct)
    {
        var email = Rules.Email(request.Email);
        var name = Rules.Text(request.Name, "Name", 120);
        var role = Rules.OneOf(request.Role, Rules.Roles, "role");
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        // Lock staff rows in a stable order to protect the last active administrator.
        var admins = (await db.QueryAsync<string>(Sql("SELECT Id FROM Users WHERE Role='Admin' AND Active=1 ORDER BY Id FOR UPDATE", tx: tx, ct: ct))).ToList();
        var old = await db.QuerySingleOrDefaultAsync<UserDto>(Sql("SELECT Id,Email,Name,Role,Active,Version FROM Users WHERE Id=@id FOR UPDATE", new { id }, tx, ct));
        Rules.Found(old != null);
        Rules.ManageUser(actor.Role, old!.Role, role);
        Rules.Require(id != actor.Id || request.Active && role == old.Role, "You cannot deactivate yourself or change your own role.");
        Rules.Require(old.Role != "Resource" && role != "Resource" || old.Role == role, "Resource profiles retain their role to preserve project history. Create a separate staff account.");
        Rules.Require(!(old.Role == "Admin" && old.Active && (!request.Active || role != "Admin") && admins.Count <= 1), "Keep at least one active administrator.");
        Conflict(await db.ExecuteAsync(Sql("UPDATE Users SET Email=@email,Name=@name,Role=@role,Active=@Active,Version=Version+1,UpdatedAt=UTC_TIMESTAMP(6) WHERE Id=@id AND Version=@Version", new { id, email, name, role, request.Active, request.Version }, tx, ct)));
        await db.ExecuteAsync(Sql("DELETE FROM Sessions WHERE UserId=@id", new { id }, tx, ct));
        await Audit(db, tx, actor.Id, "user.updated", id, new { role, request.Active }, ct);
        await tx.CommitAsync(ct);
    }
    public static void Conflict(int affected)
    {
        if (affected != 1) throw new AppException(409, "This record changed. Refresh and try again.");
    }
    private sealed class LoginRow
    {
        public string Id { get; set; } = "";
        public string? PasswordHash { get; set; }
        public string Role { get; set; } = "";
        public bool Active { get; set; }
        public DateTime? LockedUntil { get; set; }
    }
}
