using System.Text.Json.Serialization;
namespace GestionPresenceFST.Data.Rows;
public sealed class StudentRow
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("teacher_id")] public string TeacherId { get; set; } = "";
    [JsonPropertyName("class_id")] public string ClassId { get; set; } = "";
    [JsonPropertyName("last_name")] public string LastName { get; set; } = "";
    [JsonPropertyName("first_name")] public string FirstName { get; set; } = "";
    [JsonPropertyName("email")] public string? Email { get; set; }
}
