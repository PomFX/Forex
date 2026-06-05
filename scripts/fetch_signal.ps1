param(
    [string]$ApiUrl = "https://forex-rouge-gamma.vercel.app/api/signals/mt5",
    [string]$ApiKey = "d0d52fa0d8070ec18b99375dd25baa5b46338653dd5ea7c8",
    [string]$OutDir = ""
)

if ($OutDir -eq "") {
    $OutDir = Join-Path $env:APPDATA "MetaQuotes\Terminal\Common\Files"
}

if (!(Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$OutFile = Join-Path $OutDir "signal.json"

try {
    $headers = @{
        "X-MT5-Key" = $ApiKey
        "Accept"    = "application/json"
    }
    $response = Invoke-RestMethod -Uri $ApiUrl -Headers $headers -Method Get -TimeoutSec 10

    if ($response -eq $null) {
        "null" | Set-Content -Path $OutFile -Force
    } else {
        $response | ConvertTo-Json -Compress | Set-Content -Path $OutFile -Force
    }
}
catch {
    "null" | Set-Content -Path $OutFile -Force
}
