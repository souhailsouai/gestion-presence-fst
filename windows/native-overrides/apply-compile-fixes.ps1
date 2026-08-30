$ErrorActionPreference = 'Stop'

function Replace-Once([string]$Path, [string]$Old, [string]$New) {
    $text = Get-Content $Path -Raw
    if (-not $text.Contains($Old)) { throw "Expected text not found in ${Path}: $Old" }
    Set-Content -Path $Path -Value ($text.Replace($Old, $New)) -Encoding UTF8 -NoNewline
}

$dpapi = 'windows/GestionPresenceFST/Security/DpapiSessionStore.cs'
$text = Get-Content $dpapi -Raw
if (-not $text.Contains('using System.IO;')) {
    Set-Content $dpapi ("using System.IO;`n" + $text) -Encoding UTF8 -NoNewline
}

$connectivity = 'windows/GestionPresenceFST/Services/ConnectivityService.cs'
$text = Get-Content $connectivity -Raw
if (-not $text.Contains('using System.Net.Http;')) {
    Set-Content $connectivity ($text.Replace('using System.Net.Http.Headers;', 'using System.Net.Http;using System.Net.Http.Headers;')) -Encoding UTF8 -NoNewline
}

Replace-Once 'windows/GestionPresenceFST/Data/SupabaseGateway.cs' 'new InvokeFunctionOptions' 'new Supabase.Functions.Client.InvokeFunctionOptions'
Replace-Once 'windows/GestionPresenceFST/Services/TeacherAdminService.cs' 'new InvokeFunctionOptions' 'new Supabase.Functions.Client.InvokeFunctionOptions'
