using Xunit;

public sealed class BaselineTests
{
    [Fact]
    public void SharedHtmlExistsAndContainsSupabaseAppMarkers()
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../"));
        var html = File.ReadAllText(Path.Combine(root, "web", "index.html"));
        Assert.Contains("supabase", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("loginTeacher", html);
        Assert.Contains("teacher_directory", html);
        Assert.Contains("admin-teacher", html);
    }
}
