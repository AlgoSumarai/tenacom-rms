using Dapper;
using MySqlConnector;
using Tenacom.Api.Domain;
using Tenacom.Api.Infrastructure;
using static Tenacom.Api.Infrastructure.Database;

namespace Tenacom.Api.Application;

public sealed class ProfileService(Database database, Actor actor)
{
    private const string Select = "SELECT u.Id,u.Name,u.Email,u.Active,p.Headline,p.Summary,p.Phone,p.Location,p.Status,p.ReviewStatus,p.ReviewNote,p.Version FROM Users u JOIN ResourceProfiles p ON p.UserId=u.Id";
    public async Task<ProfileDto> Get(string id, CancellationToken ct)
    {
        actor.OwnOrStaff(id);
        await using var db = await database.Open(ct);
        var row = await db.QuerySingleOrDefaultAsync<ProfileDto>(Sql(Select + " WHERE u.Id=@id", new { id }, ct: ct));
        Rules.Found(row != null);
        row!.Terms = (await db.QueryAsync<ProfileTermDto>(Sql("SELECT t.Id TermId,t.Kind,t.Name,pt.Proficiency,pt.Years FROM ProfileTerms pt JOIN VocabularyTerms t ON t.Id=pt.TermId WHERE pt.ResourceId=@id ORDER BY t.Kind,t.Name", new { id }, ct: ct))).ToList();
        return row;
    }
    public async Task<Page<ProfileDto>> Search(string? q, string? status, string? terms, string? projectId, bool includeInactive, string? sort, int page, CancellationToken ct)
    {
        page = Math.Clamp(page, 1, 100000);
        var selected = (terms ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Distinct().ToArray();
        Rules.Require(selected.Length <= 20 && selected.All(x => Guid.TryParse(x, out _)), "Select at most 20 valid terms.");
        if (!string.IsNullOrEmpty(status)) Rules.OneOf(status, Rules.ResourceStatuses, "status");
        var args = new DynamicParameters(new { q = Rules.Text(q, "Search", 100, false), search = $"%{q?.Trim()}%", status = status ?? "", projectId = projectId ?? "", includeInactive, offset = (page - 1) * 20 });
        var where = " WHERE (@includeInactive=1 OR u.Active=1) AND (@q='' OR u.Name LIKE @search OR p.Headline LIKE @search OR p.Summary LIKE @search OR p.Location LIKE @search) AND (@status='' OR p.Status=@status) AND (@projectId='' OR EXISTS(SELECT 1 FROM Assignments a WHERE a.ResourceId=u.Id AND a.ProjectId=@projectId))";
        for (var i = 0; i < selected.Length; i++)
        {
            args.Add($"term{i}", selected[i]);
            where += $" AND EXISTS(SELECT 1 FROM ProfileTerms pt WHERE pt.ResourceId=u.Id AND pt.TermId=@term{i})";
        }
        await using var db = await database.Open(ct);
        var total = await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*) FROM Users u JOIN ResourceProfiles p ON p.UserId=u.Id" + where, args, ct: ct));
        var order = sort == "recent" ? "p.UpdatedAt DESC,u.Id" : "u.Name,u.Id";
        var rows = (await db.QueryAsync<ProfileDto>(Sql(Select + where + " ORDER BY " + order + " LIMIT 20 OFFSET @offset", args, ct: ct))).ToList();
        if (rows.Count > 0)
        {
            var items = await db.QueryAsync<TermRow>(Sql("SELECT pt.ResourceId,t.Id TermId,t.Kind,t.Name,pt.Proficiency,pt.Years FROM ProfileTerms pt JOIN VocabularyTerms t ON t.Id=pt.TermId WHERE pt.ResourceId IN @ids ORDER BY t.Kind,t.Name", new { ids = rows.Select(x => x.Id).ToArray() }, ct: ct));
            var lookup = items.ToLookup(x => x.ResourceId);
            foreach (var row in rows) row.Terms = lookup[row.Id].Select(x => new ProfileTermDto(x.TermId, x.Kind, x.Name, x.Proficiency, x.Years)).ToList();
        }
        return new(rows, total, page, 20);
    }
    public async Task Update(string id, ProfileUpdate request, CancellationToken ct)
    {
        actor.OwnOrStaff(id);
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        await Save(db, tx, id, request, ct);
        await Audit(db, tx, actor.Id, "profile.updated", id, null, ct);
        await tx.CommitAsync(ct);
    }
    public static async Task Save(MySqlConnection db, MySqlTransaction tx, string id, ProfileUpdate r, CancellationToken ct)
    {
        var name = Rules.Text(r.Name, "Name", 120);
        var headline = Rules.Text(r.Headline, "Professional headline", 160);
        var summary = Rules.Text(r.Summary, "Summary", 3000, false);
        var phone = Rules.Text(r.Phone, "Phone", 40, false);
        var location = Rules.Text(r.Location, "Location", 120, false);
        var status = Rules.OneOf(r.Status, Rules.ResourceStatuses, "availability");
        Rules.Require(r.Terms != null && r.Terms.Length <= 40 && r.Terms.All(x => x != null && Guid.TryParse(x.TermId, out _)) && r.Terms.Select(x => x.TermId).Distinct().Count() == r.Terms.Length, "Choose up to 40 distinct skills or fields.");
        foreach (var term in r.Terms!)
        {
            Rules.OneOf(term.Proficiency, ["Learning", "Practitioner", "Advanced", "Expert"], "proficiency");
            Rules.Require(term.Years == null || term.Years is >= 0 and <= 80, "Years of experience must be 0–80.");
        }
        if (r.Terms.Length > 0)
            Rules.Require(await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*) FROM VocabularyTerms WHERE Id IN @ids", new { ids = r.Terms.Select(x => x.TermId).ToArray() }, tx, ct)) == r.Terms.Length, "One or more selected terms no longer exist.");
        AccountService.Conflict(await db.ExecuteAsync(Sql("UPDATE ResourceProfiles SET Headline=@headline,Summary=@summary,Phone=@phone,Location=@location,Status=@status,ReviewStatus='Pending',ReviewNote='',Version=Version+1,UpdatedAt=UTC_TIMESTAMP(6) WHERE UserId=@id AND Version=@Version", new { id, headline, summary, phone, location, status, r.Version }, tx, ct)));
        await db.ExecuteAsync(Sql("UPDATE Users SET Name=@name,UpdatedAt=UTC_TIMESTAMP(6),Version=Version+1 WHERE Id=@id; DELETE FROM ProfileTerms WHERE ResourceId=@id", new { id, name }, tx, ct));
        foreach (var term in r.Terms)
            await db.ExecuteAsync(Sql("INSERT INTO ProfileTerms VALUES(@id,@TermId,@Proficiency,@Years)", new { id, term.TermId, term.Proficiency, term.Years }, tx, ct));
    }
    public async Task Review(string id, ReviewRequest request, CancellationToken ct)
    {
        var status = Rules.OneOf(request.Status, ["Pending", "Verified", "NeedsChanges"], "review status");
        var note = Rules.Text(request.Note, "Review note", 1000, status == "NeedsChanges");
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        AccountService.Conflict(await db.ExecuteAsync(Sql("UPDATE ResourceProfiles SET ReviewStatus=@status,ReviewNote=@note,Version=Version+1,UpdatedAt=UTC_TIMESTAMP(6) WHERE UserId=@id AND Version=@Version", new { id, status, note, request.Version }, tx, ct)));
        await Audit(db, tx, actor.Id, "profile.reviewed", id, new { status }, ct);
        await tx.CommitAsync(ct);
    }
    public async Task<IReadOnlyList<TermDto>> Terms(CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        return (await db.QueryAsync<TermDto>(Sql("SELECT Id,Kind,Name FROM VocabularyTerms ORDER BY Kind,Name LIMIT 5000", ct: ct))).ToList();
    }
    public async Task<TermDto> AddTerm(TermCreate request, CancellationToken ct)
    {
        var kind = Rules.OneOf(request.Kind, Rules.TermKinds, "term type");
        var name = Rules.Text(request.Name, "Term", 100);
        var id = Guid.NewGuid().ToString();
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        await db.ExecuteAsync(Sql("INSERT INTO VocabularyTerms VALUES(@id,@kind,@name)", new { id, kind, name }, tx, ct));
        await Audit(db, tx, actor.Id, "term.created", id, null, ct);
        await tx.CommitAsync(ct);
        return new(id, kind, name);
    }
    private sealed class TermRow
    {
        public string ResourceId { get; set; } = "";
        public string TermId { get; set; } = "";
        public string Kind { get; set; } = "";
        public string Name { get; set; } = "";
        public string Proficiency { get; set; } = "";
        public int? Years { get; set; }
    }
}
