using Dapper;
using Tenacom.Api.Domain;
using Tenacom.Api.Infrastructure;
using static Tenacom.Api.Infrastructure.Database;

namespace Tenacom.Api.Application;

public sealed class ProjectService(Database database, Actor actor)
{
    public async Task<Page<ProjectDto>> List(string? q, int page, CancellationToken ct, bool eligible = false)
    {
        page = Math.Clamp(page, 1, 100000);
        var args = new { staff = actor.Staff, actor.Id, eligible, q = Rules.Text(q, "Search", 100, false), search = $"%{q?.Trim()}%", offset = (page - 1) * 20 };
        const string where = " WHERE (@staff=1 OR EXISTS(SELECT 1 FROM Assignments a WHERE a.ProjectId=p.Id AND a.ResourceId=@Id)) AND (@eligible=0 OR p.Status IN ('Planned','Active')) AND (@q='' OR p.Name LIKE @search OR p.Code LIKE @search)";
        await using var db = await database.Open(ct);
        var total = await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*) FROM Projects p" + where, args, ct: ct));
        var rows = await db.QueryAsync<ProjectDto>(Sql("SELECT p.Id,p.Code,p.Name,p.Description,p.Status,p.StartDate,p.EndDate,p.Version FROM Projects p" + where + " ORDER BY p.UpdatedAt DESC,p.Id LIMIT 20 OFFSET @offset", args, ct: ct));
        return new(rows.ToList(), total, page, 20);
    }
    public async Task<ProjectDto> Get(string id, CancellationToken ct)
    {
        await using var db = await database.Open(ct);
        var row = await db.QuerySingleOrDefaultAsync<ProjectDto>(Sql("SELECT p.Id,p.Code,p.Name,p.Description,p.Status,p.StartDate,p.EndDate,p.Version FROM Projects p WHERE p.Id=@id AND (@staff=1 OR EXISTS(SELECT 1 FROM Assignments a WHERE a.ProjectId=p.Id AND a.ResourceId=@actor))", new { id, staff = actor.Staff, actor = actor.Id }, ct: ct));
        Rules.Found(row != null);
        return row!;
    }
    public async Task<string> Save(string? id, ProjectWrite request, CancellationToken ct)
    {
        var code = Rules.Text(request.Code, "Project code", 30).ToUpperInvariant();
        var name = Rules.Text(request.Name, "Project name", 160);
        var description = Rules.Text(request.Description, "Description", 5000, false);
        var status = Rules.OneOf(request.Status, Rules.ProjectStatuses, "project status");
        Rules.Dates(request.StartDate, request.EndDate);
        var create = id == null;
        id ??= Guid.NewGuid().ToString();
        var args = new { id, code, name, description, status, start = request.StartDate.ToDateTime(TimeOnly.MinValue), end = request.EndDate?.ToDateTime(TimeOnly.MinValue), request.Version, actor = actor.Id };
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        if (create)
            await db.ExecuteAsync(Sql("INSERT INTO Projects(Id,Code,Name,Description,Status,StartDate,EndDate,CreatedBy,CreatedAt,UpdatedAt) VALUES(@id,@code,@name,@description,@status,@start,@end,@actor,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))", args, tx, ct));
        else
        {
            Rules.Found(await db.ExecuteScalarAsync<string?>(Sql("SELECT Id FROM Projects WHERE Id=@id FOR UPDATE", new { id }, tx, ct)) != null);
            Rules.Require(await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*) FROM Assignments WHERE ProjectId=@id AND (StartDate<@start OR (@end IS NOT NULL AND (EndDate IS NULL OR EndDate>@end)))", args, tx, ct)) == 0, "Project dates must contain all assignment dates. Close open assignments before setting a project end date.");
            AccountService.Conflict(await db.ExecuteAsync(Sql("UPDATE Projects SET Code=@code,Name=@name,Description=@description,Status=@status,StartDate=@start,EndDate=@end,Version=Version+1,UpdatedAt=UTC_TIMESTAMP(6) WHERE Id=@id AND Version=@Version", args, tx, ct)));
        }
        await Audit(db, tx, actor.Id, create ? "project.created" : "project.updated", id, new { status }, ct);
        await tx.CommitAsync(ct);
        return id;
    }
    public async Task<Page<AssignmentDto>> Assignments(string? projectId, string? resourceId, int page, CancellationToken ct)
    {
        page = Math.Clamp(page, 1, 100000);
        if (!actor.Staff) resourceId = actor.Id;
        var args = new { projectId = projectId ?? "", resourceId = resourceId ?? "", offset = (page - 1) * 50 };
        const string from = " FROM Assignments a JOIN Projects p ON p.Id=a.ProjectId JOIN Users u ON u.Id=a.ResourceId WHERE (@projectId='' OR a.ProjectId=@projectId) AND (@resourceId='' OR a.ResourceId=@resourceId)";
        await using var db = await database.Open(ct);
        var total = await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*)" + from, args, ct: ct));
        var rows = await db.QueryAsync<AssignmentDto>(Sql("SELECT a.Id,a.ProjectId,p.Name ProjectName,a.ResourceId,u.Name ResourceName,a.RoleDescription,a.StartDate,a.EndDate,a.Version" + from + " ORDER BY a.StartDate DESC,a.Id LIMIT 50 OFFSET @offset", args, ct: ct));
        return new(rows.ToList(), total, page, 50);
    }
    public async Task<string> Assign(string projectId, string? id, AssignmentWrite r, CancellationToken ct)
    {
        var role = Rules.Text(r.RoleDescription, "Assignment role", 160);
        Rules.Dates(r.StartDate, r.EndDate);
        var create = id == null;
        id ??= Guid.NewGuid().ToString();
        var args = new { id, projectId, r.ResourceId, role, start = r.StartDate.ToDateTime(TimeOnly.MinValue), end = r.EndDate?.ToDateTime(TimeOnly.MinValue), r.Version, actor = actor.Id, create };
        await using var db = await database.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        var project = await db.QuerySingleOrDefaultAsync<ProjectDto>(Sql("SELECT Id,Code,Name,Description,Status,StartDate,EndDate,Version FROM Projects WHERE Id=@projectId FOR UPDATE", args, tx, ct));
        Rules.Found(project != null);
        Rules.Require(project!.Status is "Planned" or "Active", "Only planned or active projects accept assignment changes.");
        Rules.Require(args.start >= project.StartDate && (project.EndDate == null || args.end != null && args.end <= project.EndDate), "Assignment dates must fit within the project dates.");
        Rules.Require(await db.ExecuteScalarAsync<string?>(Sql("SELECT Id FROM Users WHERE Id=@ResourceId AND Role='Resource' AND (@create=0 OR Active=1) FOR UPDATE", args, tx, ct)) != null, "Choose an active Resource account for a new assignment.");
        // Time edits lock this same resource row before validating assignment dates.
        await db.ExecuteScalarAsync<string>(Sql("SELECT UserId FROM ResourceProfiles WHERE UserId=@ResourceId FOR UPDATE", args, tx, ct));
        Rules.Require(await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*) FROM Assignments WHERE ProjectId=@projectId AND ResourceId=@ResourceId AND Id<>@id AND StartDate<=COALESCE(@end,'9999-12-31') AND COALESCE(EndDate,'9999-12-31')>=@start", args, tx, ct)) == 0, "This resource already has an overlapping assignment on the project.");
        if (create)
            await db.ExecuteAsync(Sql("INSERT INTO Assignments(Id,ProjectId,ResourceId,RoleDescription,StartDate,EndDate,CreatedBy,CreatedAt,UpdatedAt) VALUES(@id,@projectId,@ResourceId,@role,@start,@end,@actor,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))", args, tx, ct));
        else
        {
            Rules.Require(await db.ExecuteScalarAsync<int>(Sql("SELECT COUNT(*) FROM TimeEntries WHERE AssignmentId=@id AND DeletedAt IS NULL AND (WorkDate<@start OR (@end IS NOT NULL AND WorkDate>@end))", args, tx, ct)) == 0, "Assignment dates must contain its recorded time.");
            AccountService.Conflict(await db.ExecuteAsync(Sql("UPDATE Assignments SET RoleDescription=@role,StartDate=@start,EndDate=@end,Version=Version+1,UpdatedAt=UTC_TIMESTAMP(6) WHERE Id=@id AND ProjectId=@projectId AND ResourceId=@ResourceId AND Version=@Version", args, tx, ct)));
        }
        await Audit(db, tx, actor.Id, create ? "assignment.created" : "assignment.updated", id, new { projectId, r.ResourceId }, ct);
        await tx.CommitAsync(ct);
        return id;
    }
}
