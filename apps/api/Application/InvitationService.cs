using Dapper;
using Tenacom.Api.Domain;
using Tenacom.Api.Infrastructure;
using static Tenacom.Api.Infrastructure.Database;

namespace Tenacom.Api.Application;

public sealed record InvitationDto(string Id, string Label, DateTime ExpiresAt, int MaxUses, int Uses, bool Revoked);
public sealed class InvitationService(Database database, Actor actor, AccountService accounts)
{
    public async Task<IReadOnlyList<InvitationDto>> List(CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        return (await db.QueryAsync<InvitationDto>(Sql("SELECT Id,Label,ExpiresAt,MaxUses,Uses,Revoked FROM Invitations ORDER BY CreatedAt DESC LIMIT 100", ct: ct))).ToList();
    }
    public async Task<object> Create(InvitationCreate request, CancellationToken ct)
    {
        var label = Rules.Text(request.Label, "Invitation label", 120);
        Rules.Require(request.Days is >= 1 and <= 365 && request.MaxUses is >= 1 and <= 10000, "Use 1–365 days and 1–10000 registrations.");
        var id = Guid.NewGuid().ToString();
        var token = Tokens.Create();
        var expiresAt = DateTime.UtcNow.AddDays(request.Days);
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        await db.ExecuteAsync(Sql("INSERT INTO Invitations(Id,TokenHash,Label,ExpiresAt,MaxUses,CreatedBy,CreatedAt) VALUES(@id,@hash,@label,@expiresAt,@MaxUses,@actor,UTC_TIMESTAMP(6))", new { id, hash = Tokens.Hash(token), label, expiresAt, request.MaxUses, actor = actor.Id }, tx, ct));
        await Audit(db, tx, actor.Id, "invitation.created", id, null, ct);
        await tx.CommitAsync(ct);
        return new { id, token, expiresAt };
    }
    public async Task Revoke(string id, CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        Rules.Found(await db.ExecuteAsync(Sql("UPDATE Invitations SET Revoked=1 WHERE Id=@id", new { id }, tx, ct)) == 1);
        await Audit(db, tx, actor.Id, "invitation.revoked", id, null, ct);
        await tx.CommitAsync(ct);
    }
    public async Task<string> Register(RegisterRequest request, CancellationToken ct)
    {
        Rules.Require(request.Token is { Length: 64 } && string.IsNullOrEmpty(request.Website), "This invitation is not available.");
        Rules.Require(request.Consent, "Please agree to the professional information notice.");
        Rules.Require(request.Profile != null, "Enter your profile.");
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        var invitation = await db.QuerySingleOrDefaultAsync<string>(Sql("SELECT Id FROM Invitations WHERE TokenHash=@hash AND Revoked=0 AND ExpiresAt>UTC_TIMESTAMP(6) AND Uses<MaxUses FOR UPDATE", new { hash = Tokens.Hash(request.Token) }, tx, ct));
        Rules.Require(invitation != null, "This invitation has expired, reached its limit, or been revoked. Ask your Tenacom contact for a new link.");
        var id = await accounts.Insert(db, tx, new(request.Email, request.Profile!.Name, "Resource"), ct);
        await ProfileService.Save(db, tx, id, request.Profile with { Version = 1 }, ct);
        await db.ExecuteAsync(Sql("UPDATE ResourceProfiles SET ConsentAt=UTC_TIMESTAMP(6) WHERE UserId=@id; UPDATE Invitations SET Uses=Uses+1 WHERE Id=@invitation", new { id, invitation }, tx, ct));
        await Audit(db, tx, null, "resource.submitted", id, new { invitation }, ct);
        await tx.CommitAsync(ct);
        return id;
    }
}
