using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Identity;
using Tenacom.Api.Application;
using Tenacom.Api.Domain;

namespace Tenacom.Api.Infrastructure;

public static class Tokens
{
    public const string Cookie = "tenacom_session";
    public static string Create() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
public sealed class PasswordSecurity(PasswordHasher<string> hasher)
{
    // Match real-account hashing cost to avoid a cheap unknown-account timing path.
    public string DummyHash { get; } = hasher.HashPassword("dummy", Tokens.Create());
}
public sealed class SessionAuthentication(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
    UrlEncoder encoder, Database database) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Cookies.TryGetValue(Tokens.Cookie, out var token) || token.Length != 64) return AuthenticateResult.NoResult();
        await using var db = await database.Open(Context.RequestAborted);
        var user = await db.QuerySingleOrDefaultAsync<UserDto>(Database.Sql("""
            SELECT u.Id,u.Email,u.Name,u.Role,u.Active,u.Version FROM Sessions s JOIN Users u ON u.Id=s.UserId
            WHERE s.TokenHash=@hash AND s.ExpiresAt>UTC_TIMESTAMP(6) AND u.Active=1
              AND u.Role IN ('Admin','Manager') AND u.PasswordHash IS NOT NULL
            """, new { hash = Tokens.Hash(token) }, ct: Context.RequestAborted));
        if (user == null) return AuthenticateResult.NoResult();
        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, user.Id), new Claim(ClaimTypes.Role, user.Role), new Claim(ClaimTypes.Name, user.Name)
        ], Scheme.Name));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
    }
}
public sealed class Actor(IHttpContextAccessor accessor)
{
    public string Id => accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new AppException(401, "Sign in to continue.");
    public string Role => accessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role) ?? "";
    public bool Staff => Role is "Admin" or "Manager";
    public void OwnOrStaff(string resourceId)
    {
        if (!Staff && resourceId != Id) throw new AppException(404, "The requested record was not found.");
    }
}
