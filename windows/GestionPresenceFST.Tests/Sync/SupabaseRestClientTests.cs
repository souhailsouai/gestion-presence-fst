using System.Net;
using System.Net.Http.Headers;
using System.Text;
using GestionPresenceFST.Sync;
using Xunit;

public sealed class SupabaseRestClientTests
{
    [Fact]
    public async Task ConditionalUpdateFiltersByIdAndUpdatedAtAndUsesUserJwt()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK, "[{\"id\":\"a1\",\"updated_at\":\"2026-08-29T11:00:00Z\"}]");
        var client = new SupabaseRestClient(new HttpClient(handler), "https://example.supabase.co", "publishable-key");
        client.SetSession("u1", "jwt-token");

        var result = await client.UpdateIfUnchangedAsync(
            "attendance",
            "a1",
            "{\"id\":\"a1\",\"grade\":14}",
            "2026-08-29T10:00:00Z");

        Assert.True(result.Applied);
        Assert.NotNull(handler.LastUri);
        Assert.Equal("/rest/v1/attendance", handler.LastUri!.AbsolutePath);
        Assert.Contains("id=eq.a1", handler.LastUri.Query);
        Assert.Contains("updated_at=eq.2026-08-29T10%3A00%3A00Z", handler.LastUri.Query, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Bearer", handler.Authorization?.Scheme);
        Assert.Equal("jwt-token", handler.Authorization?.Parameter);
        Assert.Equal("publishable-key", handler.ApiKey);
        Assert.Contains("return=representation", handler.Prefer ?? string.Empty);
        Assert.Equal(HttpMethod.Patch, handler.Method);
    }

    [Fact]
    public async Task RejectsEntityOutsideOfflineAllowlistBeforeHttpRequest()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK, "[]");
        var client = new SupabaseRestClient(new HttpClient(handler), "https://example.supabase.co", "publishable-key");
        client.SetSession("u1", "jwt-token");

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            client.GetFullSnapshotAsync("profiles"));

        Assert.Null(handler.LastUri);
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _body;

        public RecordingHandler(HttpStatusCode status, string body)
        {
            _status = status;
            _body = body;
        }

        public Uri? LastUri { get; private set; }
        public HttpMethod? Method { get; private set; }
        public AuthenticationHeaderValue? Authorization { get; private set; }
        public string? ApiKey { get; private set; }
        public string? Prefer { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastUri = request.RequestUri;
            Method = request.Method;
            Authorization = request.Headers.Authorization;
            ApiKey = request.Headers.TryGetValues("apikey", out var apiValues) ? apiValues.SingleOrDefault() : null;
            Prefer = request.Headers.TryGetValues("Prefer", out var preferValues) ? string.Join(",", preferValues) : null;

            return Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent(_body, Encoding.UTF8, "application/json")
            });
        }
    }
}
