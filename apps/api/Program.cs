using System.Threading.RateLimiting;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using MySqlConnector;
using Tenacom.Api.Api;
using Tenacom.Api.Application;
using Tenacom.Api.Domain;
using Tenacom.Api.Infrastructure;

if (args.Contains("--health"))
{
    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
    try { Environment.ExitCode = (await client.GetAsync("http://127.0.0.1:8080/health/ready")).IsSuccessStatusCode ? 0 : 1; }
    catch (HttpRequestException) { Environment.ExitCode = 1; }
    catch (TaskCanceledException) { Environment.ExitCode = 1; }
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 64 * 1024);
builder.Services.AddSingleton<Database>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<Actor>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<ProfileService>();
builder.Services.AddScoped<ProjectService>();
builder.Services.AddScoped<InvitationService>();
builder.Services.AddScoped<TimeService>();
// Identity v3 uses PBKDF2-HMAC-SHA512; meet OWASP's 220,000-iteration work factor.
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 220000);
builder.Services.AddSingleton<PasswordHasher<string>>();
builder.Services.AddSingleton<PasswordSecurity>();
builder.Services.AddAuthentication("Session").AddScheme<AuthenticationSchemeOptions, SessionAuthentication>("Session", null);
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("Staff", p => p.RequireRole("Admin", "Manager"));
    o.AddPolicy("Admin", p => p.RequireRole("Admin"));
});
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    foreach (var (name, count) in new[] { ("auth", 20), ("public", 120) })
        o.AddPolicy(name, ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = count, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();
if (args.Contains("--migrate"))
{
    await app.Services.GetRequiredService<Database>().Migrate(CancellationToken.None);
    return;
}
if (args.Contains("--bootstrap"))
{
    using var scope = app.Services.CreateScope();
    var dbService = scope.ServiceProvider.GetRequiredService<Database>();
    await using var db = await dbService.Open(CancellationToken.None);
    await using var tx = await db.BeginTransactionAsync();
    if (await db.ExecuteScalarAsync<int>(Database.Sql("SELECT COUNT(*) FROM Users", tx: tx)) != 0) throw new InvalidOperationException("Bootstrap only supports an empty user database.");
    var email = Environment.GetEnvironmentVariable("BOOTSTRAP_EMAIL") ?? "";
    var password = Environment.GetEnvironmentVariable("BOOTSTRAP_PASSWORD") ?? "";
    var id = await scope.ServiceProvider.GetRequiredService<AccountService>().Insert(db, tx, new(email, "Tenacom administrator", "Admin", password), CancellationToken.None);
    await Database.Audit(db, tx, id, "admin.bootstrapped", id, null, CancellationToken.None);
    await tx.CommitAsync();
    return;
}
if (!builder.Environment.IsDevelopment() && !builder.Configuration.GetValue<bool>("Security:SecureCookies"))
    throw new InvalidOperationException("Secure cookies are required outside Development.");
var origin = builder.Configuration["Security:Origin"] ?? throw new InvalidOperationException("Security:Origin is required.");
if (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri) || originUri.GetLeftPart(UriPartial.Authority) != origin || (!builder.Environment.IsDevelopment() && originUri.Scheme != "https"))
    throw new InvalidOperationException("Security:Origin must be an exact origin and use HTTPS in production.");
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.CacheControl = "no-store";
    ctx.Response.Headers.XContentTypeOptions = "nosniff";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    try
    {
        if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method))
        {
            if (ctx.Request.Headers.Origin != origin || ctx.Request.Headers["X-Tenacom-Request"] != "1")
                throw new AppException(403, "This request could not be verified. Reload the page and try again.");
        }
        await next();
        if (ctx.Response.StatusCode >= 400 && !ctx.Response.HasStarted && ctx.Response.ContentType == null)
            await Results.Problem(statusCode: ctx.Response.StatusCode, title: ctx.Response.StatusCode == 401 ? "Sign in to continue." : ctx.Response.StatusCode == 429 ? "Too many requests. Please try again shortly." : "The request could not be completed.").ExecuteAsync(ctx);
    }
    catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
    {
        // The client has gone away; do not turn a cancelled request into a server failure.
        if (!ctx.Response.HasStarted) ctx.Response.StatusCode = 499;
    }
    catch (Exception ex) when (!ctx.Response.HasStarted)
    {
        var (status, message) = ex switch
        {
            AppException e => (e.Status, e.Message),
            BadHttpRequestException => (400, "The request contains invalid data."),
            MySqlException { Number: 1062 } => (409, "A record with those details already exists."),
            MySqlException { Number: 1213 or 1205 } => (409, "Another update is in progress. Please try again."),
            _ => (500, "An unexpected error occurred. Please try again.")
        };
        if (status == 500) app.Logger.LogError("Request failed. Type={ErrorType} DatabaseError={DatabaseError} TraceId={TraceId} Stack={Stack}", ex.GetType().Name, (ex as MySqlException)?.Number, ctx.TraceIdentifier, ex.StackTrace);
        await Results.Problem(statusCode: status, title: message, extensions: new Dictionary<string, object?> { ["traceId"] = ctx.TraceIdentifier }).ExecuteAsync(ctx);
    }
});
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health/live", () => Results.Ok(new { status = "ok" }));
app.MapGet("/health/ready", async (Database database, CancellationToken ct) =>
{
    try
    {
        await using var db = await database.Open(ct);
        var applied = await db.ExecuteScalarAsync<int>(Database.Sql("SELECT COUNT(*) FROM SchemaMigrations", ct: ct));
        var expected = typeof(Database).Assembly.GetManifestResourceNames().Count(x => x.EndsWith(".sql", StringComparison.Ordinal));
        return applied == expected ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503);
    }
    catch (MySqlException) { return Results.StatusCode(503); }
});
app.MapOpenApi().RequireAuthorization("Staff");
app.MapApi();
_ = app.Services.GetRequiredService<PasswordSecurity>();
app.Run();
public partial class Program;
