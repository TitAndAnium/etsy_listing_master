<#
.SYNOPSIS
  One-shot E2E-rooktest: start met een random user, boekt credits via webhook trigger,
  valideert wallet én test een debit.
.USAGE
  powershell -ExecutionPolicy Bypass -File scripts/local-e2e.ps1 [-PriceId "price_…"] [-Project "…"] [-ApiHost "http://127.0.0.1:5001"]
#>
param(
  [string]$PriceId = "price_1S27IAK2qdxmyPrLL7ALKbkX",
  [string]$Project = "etsy-ai-hacker",
  [string]$ApiHost = "http://127.0.0.1:5001"
)

$ErrorActionPreference = "Stop"
$base = "$ApiHost/$Project/us-central1"

Write-Host "[1] Nieuw testaccount + ID-token ophalen..."
$email = "user$([guid]::NewGuid().ToString('N').Substring(0,8))@example.com"
$token = node scripts/dev-get-id-token.js --email $email --password DevPass123

Write-Host "[2] UID ophalen via api_getUserCredits..."
$user = Invoke-RestMethod -Method Get -Uri "$base/api_getUserCredits" -Headers @{ Authorization = "Bearer $token" }
$uid  = $user.uid
Write-Host ("   -> uid = {0}" -f $uid)

Write-Host "[3] Stripe checkout.session.completed simuleren..."
stripe trigger checkout.session.completed `
  --add ("checkout_session:metadata.uid={0}" -f $uid) `
  --add ("checkout_session:metadata.priceId={0}" -f $PriceId) `
  --add "checkout_session:metadata.testing=cli" `
  --add ("checkout_session:client_reference_id={0}" -f $uid)

if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERR] stripe trigger faalde met exitcode $LASTEXITCODE" -ForegroundColor Red
  exit 1
}

Write-Host "[4] Wallet pollen tot credits > 0..."
$wallet = $null
for ($i=0; $i -lt 12; $i++) {
  Start-Sleep -Seconds 1
  try {
    $wallet = Invoke-RestMethod -Method Get -Uri "$base/api_getWallet" -Headers @{ Authorization = "Bearer $token" }
    if ($wallet -and [int]$wallet.credits -gt 0) { break }
  } catch { }
}

Write-Host "[OK] Resultaat:"
if ($wallet) {
  $wallet | Format-List uid,credits
  $wallet.ledger | Select-Object -First 3 | Format-Table id,type,credits,priceId,createdAt
} else {
  Write-Host "Wallet niet opgehaald."
}

Write-Host ""
Write-Host "[5] 250 credits uitgeven (optioneel)..."
$spendBody = @{ amount = 250; reason = "smoke"; requestId = [guid]::NewGuid().ToString() } | ConvertTo-Json
$after = Invoke-RestMethod -Method Post -Uri "$base/api_spendCredits" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $spendBody
$after | Format-List uid,credits

Write-Host ""
Write-Host "Klaar."
