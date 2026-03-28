param(
  [int]$Port = 8083,
  [switch]$DryRun
)

$portsToClear = @(8081, $Port) | Sort-Object -Unique
$processesToStop = @{}

foreach ($portToClear in $portsToClear) {
  $listeners = netstat -ano | Select-String ":$portToClear" | Where-Object { $_.Line -match "LISTENING" }

  foreach ($listener in $listeners) {
    $parts = ($listener.Line -split "\s+") | Where-Object { $_ }
    $pidText = $parts[-1]

    if ($pidText -match "^\d+$") {
      $pidValue = [int]$pidText
      if (-not $processesToStop.ContainsKey($pidValue)) {
        $processesToStop[$pidValue] = [System.Collections.Generic.List[int]]::new()
      }

      if (-not $processesToStop[$pidValue].Contains($portToClear)) {
        $processesToStop[$pidValue].Add($portToClear)
      }
    }
  }
}

$expoArgs = @("expo", "start", "--dev-client", "--tunnel", "--clear", "--port", "$Port")

if ($DryRun) {
  foreach ($entry in $processesToStop.GetEnumerator() | Sort-Object Name) {
    $ports = ($entry.Value | Sort-Object -Unique) -join ", "
    Write-Host "Would stop process $($entry.Key) on port(s) $ports"
  }

  Write-Host "Dry run:"
  Write-Host "npx $($expoArgs -join ' ')"
  exit 0
}

foreach ($entry in $processesToStop.GetEnumerator()) {
  $ports = ($entry.Value | Sort-Object -Unique) -join ", "

  try {
    Stop-Process -Id $entry.Key -Force -ErrorAction Stop
    Write-Host "Stopped process $($entry.Key) on port(s) $ports"
  } catch {
    Write-Host "Could not stop process $($entry.Key) on port(s) $ports"
  }
}

& npx @expoArgs
