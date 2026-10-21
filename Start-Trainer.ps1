# Starts ZiroBam and opens it in the default browser.
# Double-click the Desktop shortcut "ZiroBam", or run: powershell -File Start-Trainer.ps1
# Leave this window open while you practise; close it to stop the app.

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:5173/zirobam/'
$Host.UI.RawUI.WindowTitle = 'ZiroBam (close this window to stop)'
Set-Location -LiteralPath $project

function Test-Server {
    try {
        return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200
    } catch {
        return $false
    }
}

# Already running (for example from an earlier launch): just open the page.
if (Test-Server) {
    Start-Process $url
    return
}

if (-not (Test-Path -LiteralPath (Join-Path $project 'node_modules'))) {
    Write-Host 'First run: installing the dependencies (one time, needs internet)...'
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Installing failed. Check your internet connection, then run this again.'
        Read-Host 'Press Enter to close'
        return
    }
}

Write-Host 'Starting ZiroBam. Your browser opens when it is ready.'
Write-Host 'Leave this window open while you practise. Close it to stop.'
Write-Host ''
npm run dev -- --open

# If the server stops with an error, keep the window so the message can be read.
if ($LASTEXITCODE -ne 0) {
    Read-Host 'The server stopped. Press Enter to close'
}
