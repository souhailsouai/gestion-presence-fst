namespace GestionPresenceFST.Domain;
public sealed class ClassGroup
{
    public string Id { get; init; } = "";
    public string TeacherId { get; init; } = "";
    public string Name { get; set; } = "";
    public string? Track { get; set; }
    public int? ClassNumber { get; set; }
    public int? GroupNumber { get; set; }
    public string Module { get; set; } = "Général";
    public string? Day { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? Room { get; set; }
}
