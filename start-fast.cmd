@echo off
setlocal
title DTR Management System - Fast Local Launch
cd /d "%~dp0"

set "APP_URL=http://localhost:5173"
set "API_URL=http://localhost:3000"

echo ============================================
echo   DTR Management System - Fast Local Launch
echo ============================================
echo.
echo Starting backend and frontend without install, migrate, or seed steps.
echo Use start.cmd after changing dependencies or database migrations.
echo.

if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
if not exist "frontend\.env" copy "frontend\.env.example" "frontend\.env" >nul

echo Stopping any previous local app processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = 3000,5173; foreach ($port in $ports) { Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { if ($_ -and $_ -ne $PID) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } }"
echo Starting backend and frontend in the background...

if not exist "logs" mkdir "logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$npm = (Get-Command npm.cmd).Source; Start-Process -FilePath $npm -ArgumentList 'run','dev' -WorkingDirectory '%~dp0backend' -WindowStyle Hidden -RedirectStandardOutput '%~dp0logs\backend.log' -RedirectStandardError '%~dp0logs\backend-error.log'"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$npm = (Get-Command npm.cmd).Source; Start-Process -FilePath $npm -ArgumentList 'run','dev' -WorkingDirectory '%~dp0frontend' -WindowStyle Hidden -RedirectStandardOutput '%~dp0logs\frontend.log' -RedirectStandardError '%~dp0logs\frontend-error.log'"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url = '%APP_URL%'; for ($i = 0; $i -lt 30; $i++) { try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }"
call :openBrowser "%APP_URL%"

echo.
echo ============================================
echo   Website : %APP_URL%
echo   Backend : %API_URL%
echo   Login   : admin / admin123
echo ============================================
echo.
echo Local PostgreSQL is used. Docker is not required.
echo Backend/frontend are running in the background.
echo Logs:
echo   logs\backend.log
echo   logs\backend-error.log
echo   logs\frontend.log
echo   logs\frontend-error.log
echo Run stop.cmd to stop the app.
echo.
exit /b 0

:openBrowser
set "URL_TO_OPEN=%~1"
echo Opening %URL_TO_OPEN%
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%URL_TO_OPEN%"
    exit /b 0
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%URL_TO_OPEN%"
    exit /b 0
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%URL_TO_OPEN%"
    exit /b 0
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%URL_TO_OPEN%"
    exit /b 0
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%URL_TO_OPEN%"
    exit /b 0
)
if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" (
    start "" "%ProgramFiles%\Mozilla Firefox\firefox.exe" "%URL_TO_OPEN%"
    exit /b 0
)
explorer.exe "%URL_TO_OPEN%"
exit /b 0
