param(
    [string]$WebhookUrl = "https://us-central1-wb-airtelmscs.cloudfunctions.net/telegramWebhook",
    [switch]$ConfigureOnly
)
$ErrorActionPreference = "Stop"
if (-not $WebhookUrl.StartsWith("https://")) { throw "An HTTPS webhook URL is required." }
$tokenInput = Read-Host "Telegram bot token (same value stored in TELEGRAM_BOT_TOKEN)" -AsSecureString
$token = [System.Net.NetworkCredential]::new("", $tokenInput).Password
$secretInput = $null
try {
    try {
        $identity = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getMe" -Method Post
    } catch { throw "Unable to verify the bot. Check the token from BotFather." }
    if (-not $identity.ok -or -not $identity.result.is_bot -or $identity.result.username -notmatch '^[A-Za-z0-9_]{5,32}$') {
        throw "Telegram did not return a valid bot identity."
    }
    $configPath = Join-Path $PSScriptRoot "../functions/load-book/.env.wb-airtelmscs"
    $usernameLine = "TELEGRAM_BOT_USERNAME=$($identity.result.username)"
    if ($ConfigureOnly) {
        $content = if (Test-Path -LiteralPath $configPath) { [System.IO.File]::ReadAllText($configPath) } else { "" }
        if ($content -match '(?m)^TELEGRAM_BOT_USERNAME=.*$') {
            $content = [regex]::Replace($content, '(?m)^TELEGRAM_BOT_USERNAME=.*$', $usernameLine)
        } else { $content = $content.TrimEnd() + "`n$usernameLine`n" }
        [System.IO.File]::WriteAllText($configPath, $content, [System.Text.UTF8Encoding]::new($false))
        Write-Output "Verified @$($identity.result.username) and saved its public username. Now store the secrets and deploy the functions."
        return
    }
    if (-not (Test-Path -LiteralPath $configPath) -or -not ([System.IO.File]::ReadAllLines($configPath) -contains $usernameLine)) {
        throw "Run this script with -ConfigureOnly first, then deploy before registering the webhook."
    }
    $secretInput = Read-Host "Webhook secret (same value stored in TELEGRAM_WEBHOOK_SECRET)" -AsSecureString
    $secret = [System.Net.NetworkCredential]::new("", $secretInput).Password
    if ($secret -notmatch '^[A-Za-z0-9_-]{32,256}$') { throw "Choose a webhook secret with 32-256 letters, digits, underscores or hyphens." }
    $body = @{
        url = $WebhookUrl
        secret_token = $secret
        allowed_updates = @("message")
        max_connections = 5
    } | ConvertTo-Json
    # Never print the request URL, because it contains the bot token.
    try {
        $result = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook" -Method Post -ContentType "application/json" -Body $body
    } catch { throw "Telegram webhook registration failed. Check your token and deployed HTTPS endpoint." }
    if (-not $result.ok) { throw "Telegram rejected webhook registration." }
    $commands = @{
        commands = @(
            @{ command = "start"; description = "Connect using the link from the MSC app" },
            @{ command = "status"; description = "Check your notification connection" },
            @{ command = "help"; description = "Show help" },
            @{ command = "stop"; description = "Disconnect notification updates" }
        )
    } | ConvertTo-Json -Depth 4
    try {
        $commandResult = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setMyCommands" -Method Post -ContentType "application/json" -Body $commands
        if (-not $commandResult.ok) { Write-Warning "Webhook registered, but the command menu could not be updated." }
    } catch { Write-Warning "Webhook registered, but the command menu could not be updated. Commands still work when typed." }
    Write-Output "Telegram webhook registered successfully. Connect Telegram from the app's notification bell."
} finally {
    $token = $null
    $secret = $null
    $body = $null
    $tokenInput.Dispose()
    if ($secretInput) { $secretInput.Dispose() }
}
