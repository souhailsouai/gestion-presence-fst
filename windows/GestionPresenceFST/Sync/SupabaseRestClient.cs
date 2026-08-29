using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using GestionPresenceFST.Models;

namespace GestionPresenceFST.Sync;

public sealed class SupabaseRestClient : IRemoteSyncClient
{
    private readonly HttpClient _http;
    private readonly Uri _baseUri;
    private readonly string _publishableKey;
    private string? _userId;
    private string? _accessToken;

    public SupabaseRestClient(HttpClient http, string baseUrl, string publishableKey)
    {
        _http = http ?? throw new ArgumentNullException(nameof(http));
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri) || baseUri.Scheme != Uri.UriSchemeHttps)
            throw new ArgumentException("Supabase base URL must be an absolute HTTPS URL.", nameof(baseUrl));
        if (string.IsNullOrWhiteSpace(publishableKey))
            throw new ArgumentException("A Supabase publishable key is required.", nameof(publishableKey));
        _baseUri = new Uri(baseUri.GetLeftPart(UriPartial.Authority).TrimEnd('/') + "/");
        _publishableKey = publishableKey;
    }

    public void SetSession(string userId, string accessToken)
    {
        if (string.IsNullOrWhiteSpace(userId)) throw new ArgumentException("A user id is required.", nameof(userId));
        if (string.IsNullOrWhiteSpace(accessToken)) throw new ArgumentException("An access token is required.", nameof(accessToken));
        _userId = userId;
        _accessToken = accessToken;
    }

    public async Task<JsonDocument> GetFullSnapshotAsync(string entity, CancellationToken ct = default)
    {
        SyncEntities.EnsureAllowed(entity);
        using var request = CreateRequest(HttpMethod.Get, $"rest/v1/{entity}?select=*");
        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Supabase snapshot request failed ({(int)response.StatusCode}): {body}", null, response.StatusCode);
        return JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "[]" : body);
    }

    public Task<RemoteWriteResult> InsertAsync(string entity, string payloadJson, CancellationToken ct = default)
        => SendWriteAsync(HttpMethod.Post, entity, null, null, payloadJson, ct);

    public Task<RemoteWriteResult> UpdateIfUnchangedAsync(string entity, string id, string payloadJson, string baseUpdatedAt, CancellationToken ct = default)
        => SendWriteAsync(HttpMethod.Patch, entity, id, baseUpdatedAt, payloadJson, ct);

    public Task<RemoteWriteResult> DeleteIfUnchangedAsync(string entity, string id, string baseUpdatedAt, CancellationToken ct = default)
        => SendWriteAsync(HttpMethod.Delete, entity, id, baseUpdatedAt, "{}", ct);

    private async Task<RemoteWriteResult> SendWriteAsync(HttpMethod method, string entity, string? id, string? baseUpdatedAt, string payloadJson, CancellationToken ct)
    {
        SyncEntities.EnsureAllowed(entity);
        if (method != HttpMethod.Post)
        {
            if (string.IsNullOrWhiteSpace(id)) throw new ArgumentException("A record id is required.", nameof(id));
            if (string.IsNullOrWhiteSpace(baseUpdatedAt)) throw new ArgumentException("The remote base timestamp is required.", nameof(baseUpdatedAt));
        }

        var relative = method == HttpMethod.Post
            ? $"rest/v1/{entity}"
            : $"rest/v1/{entity}?id=eq.{Uri.EscapeDataString(id!)}&updated_at=eq.{Uri.EscapeDataString(baseUpdatedAt!)}";

        using var request = CreateRequest(method, relative);
        if (method != HttpMethod.Delete)
            request.Content = new StringContent(payloadJson ?? "{}", Encoding.UTF8, "application/json");

        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            return new RemoteWriteResult(false, null, false, (int)response.StatusCode, body);

        if (method == HttpMethod.Post)
            return new RemoteWriteResult(true, body, false, (int)response.StatusCode, null);

        if (!IsEmptyArray(body))
            return new RemoteWriteResult(true, body, false, (int)response.StatusCode, null);

        var current = await GetByIdAsync(entity, id!, ct);
        if (method == HttpMethod.Delete && current is null)
            return new RemoteWriteResult(true, "[]", false, (int)response.StatusCode, null);

        return new RemoteWriteResult(false, current, true, (int)response.StatusCode,
            current is null ? "remote_deleted" : "remote_changed");
    }

    private async Task<string?> GetByIdAsync(string entity, string id, CancellationToken ct)
    {
        using var request = CreateRequest(HttpMethod.Get, $"rest/v1/{entity}?id=eq.{Uri.EscapeDataString(id)}&select=*");
        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "[]" : body);
        if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() == 0) return null;
        return doc.RootElement[0].GetRawText();
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(_userId) || string.IsNullOrWhiteSpace(_accessToken))
            throw new InvalidOperationException("An authenticated Supabase session must be set before remote access.");

        var request = new HttpRequestMessage(method, new Uri(_baseUri, relativeUrl));
        request.Headers.TryAddWithoutValidation("apikey", _publishableKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
        request.Headers.TryAddWithoutValidation("Prefer", "return=representation");
        return request;
    }

    private static bool IsEmptyArray(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return true;
        try
        {
            using var document = JsonDocument.Parse(body);
            return document.RootElement.ValueKind == JsonValueKind.Array && document.RootElement.GetArrayLength() == 0;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
