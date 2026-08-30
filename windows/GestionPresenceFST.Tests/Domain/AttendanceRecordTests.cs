using Xunit;
using GestionPresenceFST.Domain;

namespace GestionPresenceFST.Tests.Domain;

public sealed class AttendanceRecordTests
{
    [Theory]
    [InlineData("present")]
    [InlineData("absent")]
    [InlineData("retard")]
    [InlineData("justifie")]
    public void Stored_status_values_roundtrip_exactly(string stored)
    {
        var status = AttendanceStatusCodec.Parse(stored);
        Assert.Equal(stored, AttendanceStatusCodec.ToStored(status));
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(20.1)]
    public void Grade_must_be_between_zero_and_twenty(double grade)
    {
        var row = new AttendanceRecord { Id="a", TeacherId="t", SessionId="s", StudentId="st" };
        Assert.Throws<ArgumentOutOfRangeException>(() => row.SetGrade((decimal)grade, DateTimeOffset.UtcNow));
    }
}
