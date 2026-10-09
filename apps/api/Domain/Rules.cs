using System.Net.Mail;

namespace Tenacom.Api.Domain;

public sealed class AppException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public static class Rules
{
    public static readonly string[] Roles = ["Admin", "Manager", "Resource"];
    public static readonly string[] TermKinds = ["Field", "Industry", "Skill", "Expertise"];
    public static readonly string[] ResourceStatuses = ["Available", "Limited", "Unavailable"];
    public static readonly string[] ProjectStatuses = ["Planned", "Active", "Completed", "Archived"];
    public static string Text(string? value, string name, int max, bool required = true)
    {
        var text = value?.Trim() ?? "";
        Require((!required || text.Length > 0) && text.Length <= max, $"{name} must be {(required ? "1" : "0")}–{max} characters.");
        return text;
    }
    public static string Email(string? value)
    {
        var email = Text(value, "Email", 254).ToLowerInvariant();
        Require(MailAddress.TryCreate(email, out var address) && address.Address == email, "Enter a valid email address.");
        return email;
    }
    public static void Password(string? value) => Require(value is { Length: >= 12 and <= 128 }, "Use a password between 12 and 128 characters.");
    public static string OneOf(string? value, string[] choices, string name)
    {
        Require(value != null && choices.Contains(value), $"Choose a valid {name}.");
        return value!;
    }
    public static void Dates(DateOnly start, DateOnly? end)
    {
        Require(start.Year >= 1900 && (end == null || end.Value.Year >= 1900), "Enter dates from 1900 onwards.");
        Require(end == null || end >= start, "End date must be on or after start date.");
    }
    public static void Time(DateOnly date, int minutes, DateOnly start, DateOnly? end, int otherMinutes, DateOnly today)
    {
        Require(minutes is > 0 and <= 1440, "Time must be between 1 minute and 24 hours.");
        Require(date <= today && date >= start && (end == null || date <= end), "Date must be within the assignment and cannot be in the future.");
        Require(minutes + otherMinutes <= 1440, "Total time across all projects cannot exceed 24 hours in a day.");
    }
    public static void ManageUser(string actorRole, string targetRole, string requestedRole)
    {
        if (actorRole != "Admin" && !(actorRole == "Manager" && targetRole == "Resource" && requestedRole == "Resource"))
            throw new AppException(403, "You cannot manage this account or role.");
    }
    public static void Require(bool condition, string message)
    {
        if (!condition) throw new AppException(400, message);
    }
    public static void Found(bool condition)
    {
        if (!condition) throw new AppException(404, "The requested record was not found.");
    }
}
