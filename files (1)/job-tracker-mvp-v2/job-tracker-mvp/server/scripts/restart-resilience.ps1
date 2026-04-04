param(
  [string]$BaseUrl = "http://localhost:3001",
  [int]$MaxWaitSeconds = 120
)

Write-Host "Starting restart resilience drill..."

$start = Get-Date
$deadline = $start.AddSeconds($MaxWaitSeconds)

while ((Get-Date) -lt $deadline) {
  try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 5
    if ($resp.StatusCode -eq 200) {
      $elapsed = (Get-Date) - $start
      Write-Host "Service recovered in $([math]::Round($elapsed.TotalSeconds,2))s"
      exit 0
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

Write-Error "Service did not recover within $MaxWaitSeconds seconds"
exit 1
