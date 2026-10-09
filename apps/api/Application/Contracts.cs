namespace Tenacom.Api.Application;

public sealed record Page<T>(IReadOnlyList<T> Items, int Total, int PageNumber, int PageSize);
public sealed record UserDto(string Id, string Email, string Name, string Role, bool Active, int Version);
public sealed record LoginRequest(string Email, string Password);
public sealed record PasswordRequest(string CurrentPassword, string NewPassword);
public sealed record UserCreate(string Email, string Name, string Role, string? Password = null);
public sealed record UserUpdate(string Email, string Name, string Role, bool Active, int Version);
public sealed record TermDto(string Id, string Kind, string Name);
public sealed record TermCreate(string Kind, string Name);
public sealed record ProfileTerm(string TermId, string Proficiency, int? Years);
public sealed record ProfileTermDto(string TermId, string Kind, string Name, string Proficiency, int? Years);
public sealed record ProfileUpdate(string Name, string Headline, string Summary, string Phone, string Location, string Status, ProfileTerm[] Terms, int Version);
public sealed record ReviewRequest(string Status, string Note, int Version);
public sealed record RegisterRequest(string Token, string Email, bool Consent, ProfileUpdate Profile, string? Website);
public sealed record InvitationCreate(string Label, int Days, int MaxUses);
public sealed record ProjectWrite(string Code, string Name, string Description, string Status, DateOnly StartDate, DateOnly? EndDate, int Version);
public sealed record AssignmentWrite(string ResourceId, string RoleDescription, DateOnly StartDate, DateOnly? EndDate, int Version);
public sealed record TimeWrite(string AssignmentId, DateOnly WorkDate, int Minutes, string Notes, int Version);
public sealed class ProfileDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public bool Active { get; set; }
    public string Headline { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Location { get; set; } = "";
    public string Status { get; set; } = "";
    public string ReviewStatus { get; set; } = "";
    public string ReviewNote { get; set; } = "";
    public int Version { get; set; }
    public IReadOnlyList<ProfileTermDto> Terms { get; set; } = [];
    public int Completeness => (new[] { Name.Length > 0, Headline.Length > 0, Summary.Length > 0, Location.Length > 0, Terms.Count > 0 }).Count(x => x) * 20;
}
public sealed class ProjectDto
{
    public string Id { get; set; } = "";
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int Version { get; set; }
}
public sealed class AssignmentDto
{
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public string ResourceId { get; set; } = "";
    public string ResourceName { get; set; } = "";
    public string RoleDescription { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int Version { get; set; }
}
public sealed class TimeDto
{
    public string Id { get; set; } = "";
    public string AssignmentId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string ProjectName { get; set; } = "";
    public string ResourceId { get; set; } = "";
    public string ResourceName { get; set; } = "";
    public DateTime WorkDate { get; set; }
    public int Minutes { get; set; }
    public string Notes { get; set; } = "";
    public string CreatedBy { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public int Version { get; set; }
}
public sealed record HoursDto(string ResourceId, string ResourceName, string ProjectId, string ProjectName, decimal Minutes);
public sealed record HoursReport(IReadOnlyList<HoursDto> Items, int Total, int PageNumber, int PageSize, decimal TotalMinutes);
