using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dapper;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using Tenacom.Api.Application;
using Tenacom.Api.Infrastructure;

namespace Tenacom.Api.Tests;

[Trait("Category", "Integration")]
public sealed class WorkflowTests
{
    [Fact]
    public async Task DashboardListsStaySeparatedAndAssignmentsEnforceEligibility()
    {
        var connection = Environment.GetEnvironmentVariable("TEST_DATABASE") ?? throw new InvalidOperationException("Set TEST_DATABASE to a dedicated MySQL test database.");
        await using var factory = new TestApp(connection);
        using var scope = factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<Database>();
        await database.Migrate(default);
        var suffix = Guid.NewGuid().ToString("N")[..10];
        var password = Tokens.Create();
        var accounts = scope.ServiceProvider.GetRequiredService<AccountService>();
        await using var db = await database.Open(default);
        await using (var tx = await db.BeginTransactionAsync())
        {
            await accounts.Insert(db, tx, new($"dashboard-admin-{suffix}@example.test", $"Dashboard {suffix} Admin", "Admin", password), default);
            await accounts.Insert(db, tx, new($"dashboard-manager-{suffix}@example.test", $"Dashboard {suffix} Manager", "Manager", password), default);
            for (var i = 0; i < 22; i++)
                await accounts.Insert(db, tx, new($"dashboard-{suffix}-{i:D2}@example.test", $"Dashboard {suffix} Resource {i:D2}", "Resource"), default);
            await tx.CommitAsync();
        }
        using var admin = Client(factory);
        using var manager = Client(factory);
        await Login(admin, $"dashboard-admin-{suffix}@example.test", password);
        await Login(manager, $"dashboard-manager-{suffix}@example.test", password);
        var staff = (await admin.GetFromJsonAsync<Page<UserDto>>($"/api/users?kind=staff&q={suffix}&sort=role"))!;
        Assert.Equal(2, staff.Total);
        Assert.All(staff.Items, x => Assert.Contains(x.Role, new[] { "Admin", "Manager" }));
        var resources = (await admin.GetFromJsonAsync<Page<UserDto>>($"/api/users?kind=resources&q={suffix}&sort=email"))!;
        Assert.Equal(22, resources.Total);
        Assert.Equal(20, resources.Items.Count);
        Assert.All(resources.Items, x => Assert.Equal("Resource", x.Role));
        var secondPage = (await admin.GetFromJsonAsync<Page<UserDto>>($"/api/users?kind=resources&q={suffix}&sort=email&page=2"))!;
        Assert.Equal(2, secondPage.Items.Count);
        Assert.Empty(resources.Items.Select(x => x.Id).Intersect(secondPage.Items.Select(x => x.Id)));
        Assert.Empty((await manager.GetFromJsonAsync<Page<UserDto>>($"/api/users?kind=staff&q={suffix}"))!.Items);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/users?sort=Name;DROP")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/users?kind=unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/users?status=unknown")).StatusCode);
        var person = resources.Items[0];
        await SendNoContent(admin, HttpMethod.Put, $"/api/users/{person.Id}", new UserUpdate(person.Email, person.Name, person.Role, false, person.Version));
        Assert.Equal(person.Id, Assert.Single((await admin.GetFromJsonAsync<Page<UserDto>>($"/api/users?kind=resources&q={suffix}&status=inactive"))!.Items).Id);
        Assert.Equal(21, (await manager.GetFromJsonAsync<Page<UserDto>>($"/api/users?kind=resources&q={suffix}&status=active"))!.Total);
        var project = new ProjectWrite($"D-{suffix}", $"Dashboard {suffix} project", "", "Active", new(2026, 1, 1), new(2026, 12, 31), 0);
        var projectId = (await Send<JsonElement>(admin, HttpMethod.Post, "/api/projects", project)).GetProperty("id").GetString()!;
        foreach (var status in new[] { "Planned", "Completed", "Archived" })
            await Send<JsonElement>(admin, HttpMethod.Post, "/api/projects", project with { Code = $"{status[..1]}-{suffix}", Status = status });
        var eligible = (await admin.GetFromJsonAsync<Page<ProjectDto>>($"/api/projects?q={suffix}&eligible=true"))!;
        Assert.Equal(2, eligible.Total);
        Assert.All(eligible.Items, x => Assert.Contains(x.Status, new[] { "Planned", "Active" }));
        var assignment = new AssignmentWrite(resources.Items[1].Id, "Engineer", new(2026, 2, 1), new(2026, 2, 28), 0);
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.PostAsJsonAsync($"/api/projects/{projectId}/assignments", assignment)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"/api/projects/{projectId}/assignments", assignment with { ResourceId = person.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"/api/projects/{projectId}/assignments", assignment with { ResourceId = staff.Items[0].Id })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"/api/projects/{projectId}/assignments", assignment with { StartDate = new(2025, 12, 31) })).StatusCode);
        var simultaneous = await Task.WhenAll(admin.PostAsJsonAsync($"/api/projects/{projectId}/assignments", assignment), admin.PostAsJsonAsync($"/api/projects/{projectId}/assignments", assignment));
        Assert.Single(simultaneous, x => x.IsSuccessStatusCode);
        Assert.Single(simultaneous, x => x.StatusCode == HttpStatusCode.BadRequest);
        Assert.Equal(1, (await admin.GetFromJsonAsync<Page<AssignmentDto>>($"/api/assignments?projectId={projectId}"))!.Total);
        await Send<JsonElement>(admin, HttpMethod.Post, $"/api/projects/{projectId}/assignments", assignment with { StartDate = new(2026, 3, 1), EndDate = new(2026, 3, 31) });
        Assert.Equal(2, (await admin.GetFromJsonAsync<Page<AssignmentDto>>($"/api/assignments?resourceId={assignment.ResourceId}&projectId={projectId}"))!.Total);
    }

    [Fact]
    public async Task CompleteWorkflowEnforcesDatabaseRulesAndRoleBoundaries()
    {
        var connection = Environment.GetEnvironmentVariable("TEST_DATABASE")
            ?? throw new InvalidOperationException("Set TEST_DATABASE to a dedicated MySQL test database. See scripts/Test-Backend.ps1.");
        await using var factory = new TestApp(connection);
        using var scope = factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<Database>();
        await database.Migrate(default);
        await database.Migrate(default); // A second deployment must be a no-op.
        var suffix = Guid.NewGuid().ToString("N")[..10];
        var password = Tokens.Create();
        var accounts = scope.ServiceProvider.GetRequiredService<AccountService>();
        var securityId = "";
        await using var db = await database.Open(default);
        await using (var tx = await db.BeginTransactionAsync())
        {
            await accounts.Insert(db, tx, new($"admin-{suffix}@example.test", "Test administrator", "Admin", password), default);
            await accounts.Insert(db, tx, new($"manager-{suffix}@example.test", "Test manager", "Manager", password), default);
            securityId = await accounts.Insert(db, tx, new($"security-{suffix}@example.test", "Security manager", "Manager", password), default);
            await tx.CommitAsync();
        }
        using var admin = Client(factory);
        using var manager = Client(factory);
        using var resource = Client(factory);
        using var outsider = Client(factory);
        using var anonymous = Client(factory);
        await Login(admin, $"admin-{suffix}@example.test", password);
        await Login(manager, $"manager-{suffix}@example.test", password);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/resources")).StatusCode);
        using (var unsafeRequest = new HttpRequestMessage(HttpMethod.Post, "/api/invitations") { Content = JsonContent.Create(new InvitationCreate("Unsafe", 1, 1)) })
        {
            using var unsafeClient = factory.CreateClient();
            Assert.Equal(HttpStatusCode.Forbidden, (await unsafeClient.SendAsync(unsafeRequest)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.PostAsJsonAsync("/api/users", new UserCreate($"bad-{suffix}@example.test", "Bad", "Admin", password))).StatusCode);
        var term = await Send<TermDto>(admin, HttpMethod.Post, "/api/terms", new TermCreate("Skill", $"Integration skill {suffix}"));
        var invitation = await Send<JsonElement>(manager, HttpMethod.Post, "/api/invitations", new InvitationCreate("Integration invitation", 2, 2));
        var token = invitation.GetProperty("token").GetString()!;
        var profile = new ProfileUpdate("Test professional", "Systems specialist", "Cross-disciplinary experience", "", "Johannesburg", "Available", [new(term.Id, "Advanced", 5)], 1);
        var registration = new RegisterRequest(token, $"resource-{suffix}@example.test", true, profile, "");
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsJsonAsync("/api/onboarding", registration with { Consent = false })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsJsonAsync("/api/onboarding", registration with { Profile = profile with { Terms = [new("invalid-id", "Expert", 2)] } })).StatusCode);
        Assert.Equal(0, await db.ExecuteScalarAsync<int>("SELECT Uses FROM Invitations WHERE Id=@id", new { id = invitation.GetProperty("id").GetString() }));
        using var submission = await anonymous.PostAsJsonAsync("/api/onboarding", registration);
        Assert.Equal(HttpStatusCode.Created, submission.StatusCode);
        Assert.False(submission.Headers.Contains("Set-Cookie"));
        var registered = await submission.Content.ReadFromJsonAsync<JsonElement>();
        var resourceId = registered.GetProperty("id").GetString()!;
        Assert.Null(await db.ExecuteScalarAsync<string?>("SELECT PasswordHash FROM Users WHERE Id=@resourceId", new { resourceId }));
        Assert.Equal(0, await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Sessions WHERE UserId=@resourceId", new { resourceId }));
        Assert.Equal(1, await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM AuditEvents WHERE EntityId=@resourceId AND Action='resource.submitted' AND ActorId IS NULL", new { resourceId }));
        await Assert.ThrowsAsync<MySqlException>(() => db.ExecuteAsync("UPDATE Users SET PasswordHash=@hash WHERE Id=@resourceId", new { resourceId, hash = "not-a-resource-credential" }));
        Assert.Equal(resourceId, (await admin.GetFromJsonAsync<UserDto>($"/api/users/{resourceId}"))!.Id);
        var staffAccount = await admin.GetFromJsonAsync<UserDto>("/api/auth/me");
        Assert.Equal(HttpStatusCode.NotFound, (await manager.GetAsync($"/api/users/{staffAccount!.Id}")).StatusCode);
        var second = await Send<JsonElement>(anonymous, HttpMethod.Post, "/api/onboarding", registration with { Email = $"other-{suffix}@example.test" });
        var otherId = second.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsJsonAsync("/api/onboarding", registration with { Email = $"exhausted-{suffix}@example.test" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await resource.PostAsJsonAsync("/api/auth/login", new LoginRequest(registration.Email, password))).StatusCode);
        var legacyToken = Tokens.Create();
        await db.ExecuteAsync("INSERT INTO Sessions(TokenHash,UserId,ExpiresAt) VALUES(@hash,@resourceId,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR))", new { hash = Tokens.Hash(legacyToken), resourceId });
        resource.DefaultRequestHeaders.Add("Cookie", $"{Tokens.Cookie}={legacyToken}");
        Assert.Equal(HttpStatusCode.Unauthorized, (await resource.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await resource.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await resource.GetAsync("/api/resources")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await resource.GetAsync($"/api/resources/{otherId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await outsider.PutAsJsonAsync($"/api/resources/{resourceId}", profile)).StatusCode);
        var staffCreated = await Send<JsonElement>(manager, HttpMethod.Post, "/api/users", new UserCreate($"staff-created-{suffix}@example.test", "Staff-created resource", "Resource"));
        Assert.Null(await db.ExecuteScalarAsync<string?>("SELECT PasswordHash FROM Users WHERE Id=@id", new { id = staffCreated.GetProperty("id").GetString() }));
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/users", new UserCreate($"forbidden-password-{suffix}@example.test", "Resource", "Resource", password))).StatusCode);
        var found = await admin.GetFromJsonAsync<Page<ProfileDto>>($"/api/resources?terms={term.Id}&q=Systems&status=Available");
        Assert.Contains(found!.Items, x => x.Id == resourceId && x.Terms.Any(t => t.TermId == term.Id));
        var own = await admin.GetFromJsonAsync<ProfileDto>($"/api/resources/{resourceId}");
        Assert.Equal(HttpStatusCode.Unauthorized, (await resource.PutAsJsonAsync($"/api/resources/{resourceId}/review", new ReviewRequest("Verified", "", own!.Version))).StatusCode);
        await SendNoContent(manager, HttpMethod.Put, $"/api/resources/{resourceId}/review", new ReviewRequest("Verified", "Profile reviewed", own!.Version));
        own = await admin.GetFromJsonAsync<ProfileDto>($"/api/resources/{resourceId}");
        Assert.Equal("Verified", own!.ReviewStatus);
        await SendNoContent(manager, HttpMethod.Put, $"/api/resources/{resourceId}", profile with { Version = own!.Version });
        Assert.Equal("Pending", (await admin.GetFromJsonAsync<ProfileDto>($"/api/resources/{resourceId}"))!.ReviewStatus);
        Assert.Equal(HttpStatusCode.Conflict, (await manager.PutAsJsonAsync($"/api/resources/{resourceId}", profile with { Version = own.Version })).StatusCode);
        var project = new ProjectWrite($"T-{suffix}", "Integration project", "Database and API workflow", "Active", new(2026, 1, 1), null, 0);
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.PostAsJsonAsync("/api/projects", project)).StatusCode);
        var created = await Send<JsonElement>(admin, HttpMethod.Post, "/api/projects", project);
        var projectId = created.GetProperty("id").GetString()!;
        var assignment = new AssignmentWrite(resourceId, "Engineer", new(2026, 1, 1), null, 0);
        var assigned = await Send<JsonElement>(admin, HttpMethod.Post, $"/api/projects/{projectId}/assignments", assignment);
        var assignmentId = assigned.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"/api/projects/{projectId}/assignments", assignment)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await outsider.GetAsync($"/api/projects/{projectId}")).StatusCode);
        var work = new TimeWrite(assignmentId, new(2026, 1, 2), 120, "Integration work", 0);
        Assert.Equal(HttpStatusCode.Unauthorized, (await outsider.PostAsJsonAsync("/api/time-entries", work)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await manager.PostAsJsonAsync("/api/time-entries", work with { Minutes = -1 })).StatusCode);
        var time = await Send<JsonElement>(manager, HttpMethod.Post, "/api/time-entries", work);
        var timeId = time.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/time-entries", work with { Minutes = 1400 })).StatusCode);
        var recorded = Assert.Single((await admin.GetFromJsonAsync<Page<TimeDto>>($"/api/time-entries?resourceId={resourceId}"))!.Items);
        Assert.Equal("Test manager", recorded.CreatedByName);
        Assert.Equal((await manager.GetFromJsonAsync<UserDto>("/api/auth/me"))!.Id, recorded.CreatedBy);
        var report = await manager.GetFromJsonAsync<HoursReport>($"/api/reports/hours?resourceId={resourceId}&start=2026-01-01&end=2026-01-31");
        Assert.Equal(120, Assert.Single(report!.Items).Minutes);
        Assert.Equal(120, report.TotalMinutes);
        var nextPage = await manager.GetFromJsonAsync<HoursReport>($"/api/reports/hours?resourceId={resourceId}&page=2");
        Assert.Empty(nextPage!.Items);
        Assert.Equal(120, nextPage.TotalMinutes);
        Assert.Equal(HttpStatusCode.Unauthorized, (await outsider.GetAsync($"/api/reports/hours?resourceId={resourceId}")).StatusCode);
        await SendNoContent(admin, HttpMethod.Put, $"/api/time-entries/{timeId}", work with { Minutes = 90, Version = 1 });
        Assert.Equal(recorded.CreatedBy, Assert.Single((await manager.GetFromJsonAsync<Page<TimeDto>>($"/api/time-entries?resourceId={resourceId}"))!.Items).CreatedBy);
        Assert.Equal(HttpStatusCode.Conflict, (await manager.PutAsJsonAsync($"/api/time-entries/{timeId}", work with { Version = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await manager.DeleteAsync($"/api/time-entries/{timeId}?version=2")).StatusCode);
        var parallel = await Task.WhenAll(manager.PostAsJsonAsync("/api/time-entries", work with { Minutes = 800 }), admin.PostAsJsonAsync("/api/time-entries", work with { Minutes = 800 }));
        Assert.Single(parallel, r => r.IsSuccessStatusCode);
        Assert.Single(parallel, r => r.StatusCode == HttpStatusCode.BadRequest);
        var userPage = await manager.GetFromJsonAsync<Page<UserDto>>($"/api/users?q={registration.Email}");
        var account = Assert.Single(userPage!.Items);
        await SendNoContent(manager, HttpMethod.Put, $"/api/users/{resourceId}", new UserUpdate(account.Email, account.Name, "Resource", false, account.Version));
        Assert.Equal(HttpStatusCode.Unauthorized, (await resource.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(800, Assert.Single((await manager.GetFromJsonAsync<Page<HoursDto>>($"/api/reports/hours?resourceId={resourceId}"))!.Items).Minutes);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/projects/{projectId}/assignments/{assignmentId}", assignment with { EndDate = new(2026, 1, 1), Version = 1 })).StatusCode);
        await SendNoContent(admin, HttpMethod.Put, $"/api/projects/{projectId}/assignments/{assignmentId}", assignment with { EndDate = new(2026, 1, 31), Version = 1 });
        await SendNoContent(admin, HttpMethod.Put, $"/api/projects/{projectId}", project with { EndDate = new(2026, 1, 31), Status = "Completed", Version = 1 });
        Assert.True(await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM AuditEvents WHERE EntityId=@resourceId", new { resourceId }) >= 3);
        Assert.True((await admin.GetAsync("/openapi/v1.json")).IsSuccessStatusCode);
        // Failed authentication is generic, lockout is account-scoped, and expiry resets its counter.
        for (var attempt = 0; attempt < 5; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await outsider.PostAsJsonAsync("/api/auth/login", new LoginRequest($"security-{suffix}@example.test", "incorrect-password"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await outsider.PostAsJsonAsync("/api/auth/login", new LoginRequest($"security-{suffix}@example.test", password))).StatusCode);
        await db.ExecuteAsync("UPDATE Users SET LockedUntil=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE) WHERE Id=@securityId", new { securityId });
        await Login(outsider, $"security-{suffix}@example.test", password);
        await SendNoContent(outsider, HttpMethod.Post, "/api/auth/password", new PasswordRequest(password, Tokens.Create()));
        Assert.Equal(HttpStatusCode.Unauthorized, (await outsider.GetAsync("/api/auth/me")).StatusCode);
    }
    private static HttpClient Client(TestApp factory)
    {
        var client = factory.CreateClient(new() { HandleCookies = true });
        client.DefaultRequestHeaders.Add("Origin", "http://localhost:3000");
        client.DefaultRequestHeaders.Add("X-Tenacom-Request", "1");
        return client;
    }
    private static async Task Login(HttpClient client, string email, string password) => await Send<UserDto>(client, HttpMethod.Post, "/api/auth/login", new LoginRequest(email, password));
    private static async Task<T> Send<T>(HttpClient client, HttpMethod method, string path, object body)
    {
        using var response = await client.SendAsync(new(method, path) { Content = JsonContent.Create(body) });
        Assert.True(response.IsSuccessStatusCode, $"{method} {path}: {(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
    private static async Task SendNoContent(HttpClient client, HttpMethod method, string path, object body)
    {
        using var response = await client.SendAsync(new(method, path) { Content = JsonContent.Create(body) });
        Assert.True(response.StatusCode == HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync());
    }
    private sealed class TestApp(string connection) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Database"] = connection,
                ["Security:Origin"] = "http://localhost:3000",
                ["Security:SecureCookies"] = "false"
            }));
        }
    }
}
