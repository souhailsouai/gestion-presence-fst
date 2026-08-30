namespace GestionPresenceFST.Domain;

public enum AttendanceStatus { Present, Absent, Retard, Justifie }

public static class AttendanceStatusCodec
{
    public static AttendanceStatus Parse(string value) => value switch
    {
        "present" => AttendanceStatus.Present,
        "absent" => AttendanceStatus.Absent,
        "retard" => AttendanceStatus.Retard,
        "justifie" => AttendanceStatus.Justifie,
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, "Unknown attendance status")
    };

    public static string ToStored(AttendanceStatus value) => value switch
    {
        AttendanceStatus.Present => "present",
        AttendanceStatus.Absent => "absent",
        AttendanceStatus.Retard => "retard",
        AttendanceStatus.Justifie => "justifie",
        _ => throw new ArgumentOutOfRangeException(nameof(value))
    };
}
