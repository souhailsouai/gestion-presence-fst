namespace GestionPresenceFST.Domain;
public sealed class AttendanceRecord
{
    public string Id { get; init; } = "";
    public string TeacherId { get; init; } = "";
    public string SessionId { get; init; } = "";
    public string StudentId { get; init; } = "";
    public AttendanceStatus Status { get; set; } = AttendanceStatus.Present;
    public string Comment { get; set; } = "";
    public decimal? Grade { get; private set; }
    public DateTimeOffset? GradeUpdatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    public void SetGrade(decimal? grade, DateTimeOffset now)
    {
        if (grade is < 0 or > 20) throw new ArgumentOutOfRangeException(nameof(grade));
        if (Grade != grade)
        {
            Grade = grade;
            GradeUpdatedAt = now;
        }
    }

    public static AttendanceRecord FromStored(string id, string teacherId, string sessionId, string studentId,
        string status, string? comment, decimal? grade, DateTimeOffset? gradeUpdatedAt, DateTimeOffset? updatedAt = null)
    {
        var result = new AttendanceRecord
        {
            Id = id, TeacherId = teacherId, SessionId = sessionId, StudentId = studentId,
            Status = AttendanceStatusCodec.Parse(status), Comment = comment ?? "", UpdatedAt = updatedAt
        };
        result.Grade = grade;
        result.GradeUpdatedAt = gradeUpdatedAt;
        return result;
    }
}
