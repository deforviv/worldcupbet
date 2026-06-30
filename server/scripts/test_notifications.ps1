$headers = @{ Authorization = 'Bearer local-admin-token' }
try {
  $c = Invoke-RestMethod -Uri 'http://localhost:3001/api/notifications/count' -Headers $headers -Method GET -TimeoutSec 10
  Write-Output 'COUNT:'
  $c | ConvertTo-Json -Compress
  $l = Invoke-RestMethod -Uri 'http://localhost:3001/api/notifications?page=1' -Headers $headers -Method GET -TimeoutSec 10
  Write-Output 'LIST:'
  $l | ConvertTo-Json -Compress
  $m = Invoke-RestMethod -Uri 'http://localhost:3001/api/notifications/mark-read' -Headers $headers -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 10
  Write-Output 'MARKED:'
  $m | ConvertTo-Json -Compress
} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
}
