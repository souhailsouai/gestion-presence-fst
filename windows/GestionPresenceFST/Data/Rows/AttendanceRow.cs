using System.Text.Json.Serialization;
namespace GestionPresenceFST.Data.Rows;
public sealed class AttendanceRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("teacher_id")] public string TeacherId { get; set; } = "";
    [JsonPropertyName("session_id")] public string SessionId { get; set; } = "";
    [JsonPropertyName("student_id")] public string StudentId { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "present";
    [JsonPropertyName("comment")] public string? Comment { get; set; }
    [JsonPropertyName("grade")] public decimal? Grade { get; set; }
    [JsonPropertyName("grade_updated_at")] public DateTimeOffset? GradeUpdatedAt { get; set; }
    [JsonPropertyName("updated_at")] public DateTimeOffset? UpdatedAt { get; set; }
}
