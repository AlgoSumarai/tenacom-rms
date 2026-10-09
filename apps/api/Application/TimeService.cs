using Dapper;
using Tenacom.Api.Domain;
using Tenacom.Api.Infrastructure;
using static Tenacom.Api.Infrastructure.Database;

namespace Tenacom.Api.Application;

public sealed class TimeService(Database database, Actor actor)
{
    private const string From = " FROM TimeEntries t JOIN Assignments a ON a.Id=t.AssignmentId JOIN Projects p ON p.Id=a.ProjectId JOIN Users u ON u.Id=a.ResourceId JOIN Users creator ON creator.Id=t.CreatedBy WHERE t.DeletedAt IS NULL AND (@resource='' OR a.ResourceId=@resource) AND (@project='' OR a.ProjectId=@project) AND (@start IS NULL OR t.WorkDate>=@start) AND (@end IS NULL OR t.WorkDate<=@end)";
    private object Filters(string? resource, string? project, DateOnly? start, DateOnly? end, int page)
    {
        Rules.Require(start == null || end == null || start <= end, "End date must be on or after start date.");
        RequireStaff();
        return new { resource = resource ?? "", project = project ?? "", start = start?.ToDateTime(TimeOnly.MinValue), end = end?.ToDateTime(TimeOnly.MinValue), offset = (Math.Clamp(page, 1, 100000) - 1) * 50 };
    }
    public async Task<Page<TimeDto>> List(string? resource, string? project, DateOnly? start, DateOnly? end, int page, CancellationToken ct)
    {
        var args = Filters(resource, project, start, end, page);
        await using var db = await database.Open(ct);
        var total = await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*)" + From, args, ct: ct));
        var rows = await db.QueryAsync<TimeDto>(Sql("SELECT t.Id,t.AssignmentId,a.ProjectId,p.Name ProjectName,a.ResourceId,u.Name ResourceName,t.WorkDate,t.Minutes,t.Notes,t.Version,t.CreatedBy,creator.Name CreatedByName" + From + " ORDER BY t.WorkDate DESC,t.Id LIMIT 50 OFFSET @offset", args, ct: ct));
        return new(rows.ToList(), total, Math.Clamp(page, 1, 100000), 50);
    }
    public async Task<HoursReport> Report(string? resource, string? project, DateOnly? start, DateOnly? end, int page, CancellationToken ct)
    {
        var args = Filters(resource, project, start, end, page);
        await using var db = await database.Open(ct);
        var total = await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*) FROM (SELECT a.ResourceId,a.ProjectId" + From + " GROUP BY a.ResourceId,a.ProjectId) grouped", args, ct: ct));
        var totalMinutes = await db.ExecuteScalarAsync<decimal>(Sql("SELECT COALESCE(SUM(t.Minutes),0)" + From, args, ct: ct));
        var rows = await db.QueryAsync<HoursDto>(Sql("SELECT a.ResourceId,u.Name ResourceName,a.ProjectId,p.Name ProjectName,SUM(t.Minutes) Minutes" + From + " GROUP BY a.ResourceId,u.Name,a.ProjectId,p.Name ORDER BY u.Name,p.Name,a.ResourceId,a.ProjectId LIMIT 50 OFFSET @offset", args, ct: ct));
        return new(rows.ToList(), total, Math.Clamp(page, 1, 100000), 50, totalMinutes);
    }
    public async Task<string> Save(string? id, TimeWrite r, CancellationToken ct)
    {
        RequireStaff();
        var notes = Rules.Text(r.Notes, "Notes", 1000, false);
        var create = id == null;
        id ??= Guid.NewGuid().ToString();
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, ct);
        var owner = await db.QuerySingleOrDefaultAsync<string>(Sql("SELECT ResourceId FROM Assignments WHERE Id=@AssignmentId", r, tx, ct));
        Rules.Found(owner != null);
        // Serialize by the actual resource, even when different staff enter their hours.
        await db.ExecuteScalarAsync<string>(Sql("SELECT UserId FROM ResourceProfiles WHERE UserId=@owner FOR UPDATE", new { owner }, tx, ct));
        var assignment = await db.QuerySingleAsync<AssignmentDto>(Sql("SELECT Id,ProjectId,ResourceId,RoleDescription,StartDate,EndDate,Version FROM Assignments WHERE Id=@AssignmentId FOR UPDATE", r, tx, ct));
        var date = r.WorkDate.ToDateTime(TimeOnly.MinValue);
        var otherMinutes = await db.ExecuteScalarAsync<int>(Sql("SELECT COALESCE(SUM(t.Minutes),0) FROM TimeEntries t JOIN Assignments a ON a.Id=t.AssignmentId WHERE a.ResourceId=@owner AND t.WorkDate=@date AND t.DeletedAt IS NULL AND t.Id<>@id", new { owner, date, id }, tx, ct));
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Africa/Johannesburg")));
        Rules.Time(r.WorkDate, r.Minutes, DateOnly.FromDateTime(assignment.StartDate), assignment.EndDate == null ? null : DateOnly.FromDateTime(assignment.EndDate.Value), otherMinutes, today);
        var args = new { id, r.AssignmentId, date, r.Minutes, notes, r.Version, actor = actor.Id };
        if (create)
            await db.ExecuteAsync(Sql("INSERT INTO TimeEntries(Id,AssignmentId,WorkDate,Minutes,Notes,CreatedBy,CreatedAt,UpdatedAt) VALUES(@id,@AssignmentId,@date,@Minutes,@notes,@actor,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))", args, tx, ct));
        else
            AccountService.Conflict(await db.ExecuteAsync(Sql("UPDATE TimeEntries SET WorkDate=@date,Minutes=@Minutes,Notes=@notes,Version=Version+1,UpdatedAt=UTC_TIMESTAMP(6) WHERE Id=@id AND AssignmentId=@AssignmentId AND Version=@Version AND DeletedAt IS NULL", args, tx, ct)));
        await Audit(db, tx, actor.Id, create ? "time.created" : "time.updated", id, new { date = r.WorkDate, r.Minutes }, ct);
        await tx.CommitAsync(ct);
        return id;
    }
    public async Task Delete(string id, int version, CancellationToken ct)
    {
        RequireStaff();
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        var owner = await db.QuerySingleOrDefaultAsync<string>(Sql("SELECT a.ResourceId FROM TimeEntries t JOIN Assignments a ON a.Id=t.AssignmentId WHERE t.Id=@id AND t.DeletedAt IS NULL", new { id }, tx, ct));
        Rules.Found(owner != null);
        await db.ExecuteScalarAsync<string>(Sql("SELECT UserId FROM ResourceProfiles WHERE UserId=@owner FOR UPDATE", new { owner }, tx, ct));
        AccountService.Conflict(await db.ExecuteAsync(Sql("UPDATE TimeEntries SET DeletedAt=UTC_TIMESTAMP(6),UpdatedAt=UTC_TIMESTAMP(6),Version=Version+1 WHERE Id=@id AND Version=@version AND DeletedAt IS NULL", new { id, version }, tx, ct)));
        await Audit(db, tx, actor.Id, "time.deleted", id, null, ct);
        await tx.CommitAsync(ct);
    }
    private void RequireStaff()
    {
        if (!actor.Staff) throw new AppException(403, "Time tracking is available to the Tenacom management team.");
    }
}
