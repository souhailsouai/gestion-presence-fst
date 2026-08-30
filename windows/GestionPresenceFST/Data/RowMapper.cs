using GestionPresenceFST.Data.Rows;
using GestionPresenceFST.Domain;
namespace GestionPresenceFST.Data;
public static class RowMapper
{
    public static Profile ToDomain(ProfileRow r) => new(r.Id, r.Email, r.Username ?? "", r.FullName ?? r.Username ?? r.Email, r.Role ?? "teacher");
    public static ClassGroup ToDomain(ClassRow r) => new() { Id=r.Id, TeacherId=r.TeacherId, Name=r.Name, Track=r.Track, ClassNumber=r.ClassNumber, GroupNumber=r.GroupNumber, Module=r.Module ?? "Général", Day=r.Day, StartTime=r.StartTime, EndTime=r.EndTime, Room=r.Room };
    public static Student ToDomain(StudentRow r) => new() { Id=r.Id, TeacherId=r.TeacherId, ClassId=r.ClassId, LastName=r.LastName, FirstName=r.FirstName, Email=r.Email };
    public static TeachingSession ToDomain(SessionRow r) => new() { Id=r.Id, TeacherId=r.TeacherId, ClassId=r.ClassId, SessionDate=DateOnly.Parse(r.SessionDate), StartTime=TrimTime(r.StartTime), EndTime=TrimTime(r.EndTime), CompletedAt=r.CompletedAt };
    public static AttendanceRecord ToDomain(AttendanceRow r) => AttendanceRecord.FromStored(r.Id,r.TeacherId,r.SessionId,r.StudentId,r.Status,r.Comment,r.Grade,r.GradeUpdatedAt,r.UpdatedAt);
    public static ClassRow ToRow(ClassGroup x) => new() { Id=x.Id, TeacherId=x.TeacherId, Name=x.Name, Track=x.Track, ClassNumber=x.ClassNumber, GroupNumber=x.GroupNumber, Module=x.Module, Day=x.Day, StartTime=x.StartTime, EndTime=x.EndTime, Room=x.Room };
    public static StudentRow ToRow(Student x) => new() { Id=x.Id, TeacherId=x.TeacherId, ClassId=x.ClassId, LastName=x.LastName, FirstName=x.FirstName, Email=x.Email };
    public static SessionRow ToRow(TeachingSession x) => new() { Id=x.Id, TeacherId=x.TeacherId, ClassId=x.ClassId, SessionDate=x.SessionDate.ToString("yyyy-MM-dd"), StartTime=x.StartTime, EndTime=x.EndTime, CompletedAt=x.CompletedAt };
    public static AttendanceRow ToRow(AttendanceRecord x) => new() { Id=x.Id, TeacherId=x.TeacherId, SessionId=x.SessionId, StudentId=x.StudentId, Status=AttendanceStatusCodec.ToStored(x.Status), Comment=x.Comment, Grade=x.Grade, GradeUpdatedAt=x.GradeUpdatedAt, UpdatedAt=x.UpdatedAt };
    private static string TrimTime(string? value) => string.IsNullOrWhiteSpace(value) ? "" : value.Length >= 5 ? value[..5] : value;
}
