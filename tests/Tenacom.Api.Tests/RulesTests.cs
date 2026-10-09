using Tenacom.Api.Domain;

namespace Tenacom.Api.Tests;

public sealed class RulesTests
{
    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(1441)]
    public void TimeRejectsInvalidDuration(int minutes)
        => Assert.Throws<AppException>(() => Rules.Time(new(2026, 1, 2), minutes, new(2026, 1, 1), null, 0, new(2026, 1, 3)));

    [Fact]
    public void TimeRejectsCrossProjectDailyOverflow()
        => Assert.Throws<AppException>(() => Rules.Time(new(2026, 1, 2), 120, new(2026, 1, 1), null, 1400, new(2026, 1, 3)));

    [Theory]
    [InlineData("2025-12-31")]
    [InlineData("2026-01-04")]
    public void TimeRejectsDatesOutsideAssignment(string date)
        => Assert.Throws<AppException>(() => Rules.Time(DateOnly.Parse(date), 60, new(2026, 1, 1), new(2026, 1, 3), 0, new(2026, 1, 10)));

    [Fact]
    public void TimeRejectsFutureWork()
        => Assert.Throws<AppException>(() => Rules.Time(new(2026, 1, 5), 60, new(2026, 1, 1), null, 0, new(2026, 1, 4)));

    [Fact]
    public void TimeAcceptsExactDailyLimitAndBoundaryDates()
        => Rules.Time(new(2026, 1, 1), 440, new(2026, 1, 1), new(2026, 1, 1), 1000, new(2026, 1, 1));

    [Theory]
    [InlineData("Manager", "Admin", "Admin")]
    [InlineData("Manager", "Resource", "Manager")]
    [InlineData("Manager", "Manager", "Resource")]
    [InlineData("Resource", "Resource", "Resource")]
    public void UserManagementRejectsEscalation(string actor, string target, string requested)
        => Assert.Equal(403, Assert.Throws<AppException>(() => Rules.ManageUser(actor, target, requested)).Status);

    [Theory]
    [InlineData("Admin", "Manager", "Admin")]
    [InlineData("Manager", "Resource", "Resource")]
    public void UserManagementAllowsIntendedScope(string actor, string target, string requested)
        => Rules.ManageUser(actor, target, requested);

    [Theory]
    [InlineData("bad")]
    [InlineData("Display Name <valid@example.com>")]
    [InlineData("")]
    public void EmailRejectsInvalidOrAmbiguousInput(string email)
        => Assert.Throws<AppException>(() => Rules.Email(email));

    [Fact]
    public void EmailNormalizesForUniqueness() => Assert.Equal("hello@example.com", Rules.Email(" HELLO@example.com "));

    [Theory]
    [InlineData("short")]
    [InlineData("")]
    public void PasswordRequiresPassphraseLength(string password) => Assert.Throws<AppException>(() => Rules.Password(password));
}
