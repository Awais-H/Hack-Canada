param(
  [string]$BaseUrl = "http://127.0.0.1:8000",
  [string]$ImagePath = "D:\Repositories\Hackathons\Hack-Canada\test\test_sweater.jpg",
  [string]$UserId = "dwell-test-user",
  [int]$DwellMs = 2400
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$fallbackImage = Join-Path $repoRoot "image.png"

if (!(Test-Path $ImagePath)) {
  Write-Warning "Image not found at '$ImagePath'. Falling back to '$fallbackImage'."
  $ImagePath = $fallbackImage
}

if (!(Test-Path $ImagePath)) {
  throw "No test image available. Checked '$ImagePath' and '$fallbackImage'."
}

$env:DWELL_BASE_URL = $BaseUrl
$env:DWELL_TEST_IMAGE = $ImagePath
$env:DWELL_TEST_USER = $UserId
$env:DWELL_TEST_DURATION_MS = "$DwellMs"

Write-Host "Running dwell smoke test..." -ForegroundColor Cyan
Write-Host "  base url: $BaseUrl"
Write-Host "  image:    $ImagePath"
Write-Host "  user id:  $UserId"
Write-Host "  dwell ms: $DwellMs"

node (Join-Path $PSScriptRoot "test-dwell-workflow.mjs")
