using Tenacom.Api.Application;
using Tenacom.Api.Infrastructure;

namespace Tenacom.Api.Api;

public static class Endpoints
{
    public static void MapApi(this WebApplication app)
    {
        var api = app.MapGroup("/api").RequireAuthorization("Staff");
        api.MapPost("/auth/login", async (LoginRequest r, AccountService service, HttpContext context, IConfiguration config, CancellationToken ct) =>
        {
            var (user, token) = await service.Login(r, ct);
            context.Response.Cookies.Append(Tokens.Cookie, token, new CookieOptions { HttpOnly = true, Secure = config.GetValue<bool>("Security:SecureCookies"), SameSite = SameSiteMode.Lax, Path = "/", MaxAge = TimeSpan.FromHours(12), IsEssential = true });
            return Results.Ok(user);
        }).AllowAnonymous().RequireRateLimiting("auth");
        api.MapPost("/auth/logout", async (AccountService service, HttpContext context, CancellationToken ct) =>
        {
            await service.Logout(context.Request.Cookies[Tokens.Cookie], ct);
            context.Response.Cookies.Delete(Tokens.Cookie);
            return Results.NoContent();
        });
        api.MapGet("/auth/me", (AccountService s, CancellationToken ct) => s.Me(ct));
        api.MapPost("/auth/password", async (PasswordRequest r, AccountService s, CancellationToken ct) => { await s.ChangePassword(r, ct); return Results.NoContent(); }).RequireRateLimiting("auth");
        api.MapPost("/onboarding", async (RegisterRequest r, InvitationService s, CancellationToken ct) => { var id = await s.Register(r, ct); return Results.Created($"/api/resources/{id}", new { id }); }).AllowAnonymous().RequireRateLimiting("auth");
        api.MapGet("/terms", (ProfileService s, CancellationToken ct) => s.Terms(ct)).AllowAnonymous().RequireRateLimiting("public");
        api.MapPost("/terms", async (TermCreate r, ProfileService s, CancellationToken ct) => Results.Ok(await s.AddTerm(r, ct))).RequireAuthorization("Staff");
        api.MapGet("/users", (string? q, int? page, AccountService s, CancellationToken ct) => s.List(q, page ?? 1, ct)).RequireAuthorization("Staff");
        api.MapGet("/users/{id:guid}", (Guid id, AccountService s, CancellationToken ct) => s.Get(id.ToString(), ct)).RequireAuthorization("Staff");
        api.MapPost("/users", async (UserCreate r, AccountService s, CancellationToken ct) => { var id = await s.Create(r, ct); return Results.Created($"/api/users/{id}", new { id }); }).RequireAuthorization("Staff");
        api.MapPut("/users/{id:guid}", async (Guid id, UserUpdate r, AccountService s, CancellationToken ct) => { await s.Update(id.ToString(), r, ct); return Results.NoContent(); }).RequireAuthorization("Staff");
        api.MapGet("/resources", (string? q, string? status, string? terms, string? projectId, bool? includeInactive, string? sort, int? page, ProfileService s, CancellationToken ct) => s.Search(q, status, terms, projectId, includeInactive ?? false, sort, page ?? 1, ct)).RequireAuthorization("Staff");
        api.MapGet("/resources/{id:guid}", (Guid id, ProfileService s, CancellationToken ct) => s.Get(id.ToString(), ct));
        api.MapPut("/resources/{id:guid}", async (Guid id, ProfileUpdate r, ProfileService s, CancellationToken ct) => { await s.Update(id.ToString(), r, ct); return Results.NoContent(); });
        api.MapPut("/resources/{id:guid}/review", async (Guid id, ReviewRequest r, ProfileService s, CancellationToken ct) => { await s.Review(id.ToString(), r, ct); return Results.NoContent(); }).RequireAuthorization("Staff");
        api.MapGet("/invitations", (InvitationService s, CancellationToken ct) => s.List(ct)).RequireAuthorization("Staff");
        api.MapPost("/invitations", (InvitationCreate r, InvitationService s, CancellationToken ct) => s.Create(r, ct)).RequireAuthorization("Staff");
        api.MapDelete("/invitations/{id:guid}", async (Guid id, InvitationService s, CancellationToken ct) => { await s.Revoke(id.ToString(), ct); return Results.NoContent(); }).RequireAuthorization("Staff");
        api.MapGet("/projects", (string? q, int? page, ProjectService s, CancellationToken ct) => s.List(q, page ?? 1, ct));
        api.MapGet("/projects/{id:guid}", (Guid id, ProjectService s, CancellationToken ct) => s.Get(id.ToString(), ct));
        api.MapPost("/projects", async (ProjectWrite r, ProjectService s, CancellationToken ct) => { var id = await s.Save(null, r, ct); return Results.Created($"/api/projects/{id}", new { id }); }).RequireAuthorization("Admin");
        api.MapPut("/projects/{id:guid}", async (Guid id, ProjectWrite r, ProjectService s, CancellationToken ct) => { await s.Save(id.ToString(), r, ct); return Results.NoContent(); }).RequireAuthorization("Admin");
        api.MapGet("/assignments", (string? projectId, string? resourceId, int? page, ProjectService s, CancellationToken ct) => s.Assignments(projectId, resourceId, page ?? 1, ct));
        api.MapPost("/projects/{id:guid}/assignments", async (Guid id, AssignmentWrite r, ProjectService s, CancellationToken ct) => Results.Ok(new { id = await s.Assign(id.ToString(), null, r, ct) })).RequireAuthorization("Admin");
        api.MapPut("/projects/{projectId:guid}/assignments/{id:guid}", async (Guid projectId, Guid id, AssignmentWrite r, ProjectService s, CancellationToken ct) => { await s.Assign(projectId.ToString(), id.ToString(), r, ct); return Results.NoContent(); }).RequireAuthorization("Admin");
        api.MapGet("/time-entries", (string? resourceId, string? projectId, DateOnly? start, DateOnly? end, int? page, TimeService s, CancellationToken ct) => s.List(resourceId, projectId, start, end, page ?? 1, ct));
        api.MapPost("/time-entries", async (TimeWrite r, TimeService s, CancellationToken ct) => Results.Ok(new { id = await s.Save(null, r, ct) }));
        api.MapPut("/time-entries/{id:guid}", async (Guid id, TimeWrite r, TimeService s, CancellationToken ct) => { await s.Save(id.ToString(), r, ct); return Results.NoContent(); });
        api.MapDelete("/time-entries/{id:guid}", async (Guid id, int version, TimeService s, CancellationToken ct) => { await s.Delete(id.ToString(), version, ct); return Results.NoContent(); });
        api.MapGet("/reports/hours", (string? resourceId, string? projectId, DateOnly? start, DateOnly? end, int? page, TimeService s, CancellationToken ct) => s.Report(resourceId, projectId, start, end, page ?? 1, ct));
    }
}
