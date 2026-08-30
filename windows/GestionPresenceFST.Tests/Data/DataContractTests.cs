using System.Reflection;
using System.Text.Json.Serialization;
using Xunit;
using GestionPresenceFST.Data.Rows;

namespace GestionPresenceFST.Tests.Data;

public sealed class DataContractTests
{
    [Fact]
    public void Attendance_row_uses_exact_supabase_column_names()
    {
        var names = typeof(AttendanceRow).GetProperties()
            .Select(p => p.GetCustomAttribute<JsonPropertyNameAttribute>()?.Name)
            .Where(x => x is not null).ToHashSet();
        foreach (var expected in new[] { "id", "teacher_id", "session_id", "student_id", "status", "comment", "grade", "grade_updated_at", "updated_at" })
            Assert.Contains(expected, names);
    }
}
