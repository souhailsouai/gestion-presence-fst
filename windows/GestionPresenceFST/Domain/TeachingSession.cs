namespace GestionPresenceFST.Domain;
public sealed class TeachingSession
{
    public string Id { get; init; } = "";
    public string TeacherId { get; init; } = "";
    public string ClassId { get; init; } = "";
    public DateOnly SessionDate { get; set; }
    public string StartTime { get; set; } = "";
    public string EndTime { get; set; } = "";
    public DateTimeOffset? CompletedAt { get; set; }
}
