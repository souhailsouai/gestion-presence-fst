using System.Text.Json.Serialization;
namespace GestionPresenceFST.Data.Rows;
public sealed class ClassRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("teacher_id")] public string TeacherId { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("track")] public string? Track { get; set; }
    [JsonPropertyName("class_number")] public int? ClassNumber { get; set; }
    [JsonPropertyName("group_number")] public int? GroupNumber { get; set; }
    [JsonPropertyName("module")] public string? Module { get; set; }
    [JsonPropertyName("day")] public string? Day { get; set; }
    [JsonPropertyName("start_time")] public string? StartTime { get; set; }
    [JsonPropertyName("end_time")] public string? EndTime { get; set; }
    [JsonPropertyName("room")] public string? Room { get; set; }
}
