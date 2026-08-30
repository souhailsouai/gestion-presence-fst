using System.Text.Json.Serialization;
namespace GestionPresenceFST.Data.Rows;
public sealed class SessionRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("teacher_id")] public string TeacherId { get; set; } = "";
    [JsonPropertyName("class_id")] public string ClassId { get; set; } = "";
    [JsonPropertyName("session_date")] public string SessionDate { get; set; } = "";
    [JsonPropertyName("start_time")] public string StartTime { get; set; } = "";
    [JsonPropertyName("end_time")] public string EndTime { get; set; } = "";
    [JsonPropertyName("completed_at")] public DateTimeOffset? CompletedAt { get; set; }
}
