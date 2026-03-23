param(
  [int]$Port = 8082,
  [switch]$DryRun
)

$portsToClear = @(8081, $Port) | Sort-Object -Unique

foreach ($portToClear in $portsToClear) {
  $listeners = netstat -ano | Select-String ":$portToClear" | Where-Object { $_.Line -match "LISTENING" }

  foreach ($listener in $listeners) {
    $parts = ($listener.Line -split "\s+") | Where-Object { $_ }
    $pidText = $parts[-1]

    if ($pidText -match "^\d+$") {
      $pidValue = [int]$pidText

      try {
        Stop-Process -Id $pidValue -Force -ErrorAction Stop
        Write-Host "Stopped process $pidValue on port $portToClear"
      } catch {
        Write-Host "Could not stop process $pidValue on port $portToClear"
      }
    }
  }
}

$expoArgs = @("expo", "start", "--tunnel", "--clear", "--port", "$Port")

if ($DryRun) {
  Write-Host "Dry run:"
  Write-Host "npx $($expoArgs -join ' ')"
  exit 0
}

& npx @expoArgs
