namespace GestionPresenceFST.Domain;
public sealed class Student
{
    public string Id { get; init; } = "";
    public string TeacherId { get; init; } = "";
    public string ClassId { get; init; } = "";
    public string LastName { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string? Email { get; set; }
    public string DisplayName => $"{LastName} {FirstName}".Trim();
}
