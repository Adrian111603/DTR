@echo off
setlocal enabledelayedexpansion
title DTR Management System - Local Launcher
cd /d "%~dp0"

set "APP_URL=http://localhost:5173"
set "API_URL=http://localhost:3000"

echo ============================================
echo   DTR Management System - Local PostgreSQL
echo ============================================
echo.

REM ---- 1. Make sure local env files exist ----
echo [1/5] Preparing environment files...
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo       Created backend\.env
)
if not exist "frontend\.env" (
    copy "frontend\.env.example" "frontend\.env" >nul
    echo       Created frontend\.env
)
echo       Using backend DATABASE_URL from backend\.env
echo.

REM ---- 2. Stop any previous local app processes before Prisma writes files ----
echo [2/6] Stopping any previous local app processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = 3000,5173; foreach ($port in $ports) { Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { if ($_ -and $_ -ne $PID) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } }"
echo       Previous local app processes stopped if they were running.
echo.

REM ---- 3. Install dependencies if needed ----
echo [3/6] Checking dependencies...
if not exist "backend\node_modules" (
    echo       Installing backend dependencies...
    pushd backend
    call npm install
    if errorlevel 1 (
        popd
        echo       Backend npm install failed. See the output above.
        pause
        exit /b 1
    )
    popd
)
if not exist "frontend\node_modules" (
    echo       Installing frontend dependencies...
    pushd frontend
    call npm install
    if errorlevel 1 (
        popd
        echo       Frontend npm install failed. See the output above.
        pause
        exit /b 1
    )
    popd
)
echo       Dependencies are ready.
echo.

REM ---- 4. Apply Prisma migrations and seed local PostgreSQL ----
echo [4/6] Applying database migrations and seed...
pushd backend
call npx prisma generate
if errorlevel 1 (
    popd
    echo       Prisma generate failed. Check backend\.env and PostgreSQL.
    pause
    exit /b 1
)
call npx prisma migrate deploy
if errorlevel 1 (
    popd
    echo.
    echo       Prisma could not apply migrations to local PostgreSQL.
    echo       Make sure PostgreSQL is running and backend\.env has the right DATABASE_URL.
    echo       Default expected database:
    echo       postgresql://dtr:dtr_password@localhost:5432/dtr_db?schema=public
    echo.
    echo       If you have not created it yet, run setup-postgres.cmd.
    pause
    exit /b 1
)
call npx prisma db seed
if errorlevel 1 (
    popd
    echo       Seed failed. See the output above.
    pause
    exit /b 1
)
popd
echo.

REM ---- 5. Start backend and frontend in the background ----
echo [5/6] Starting backend and frontend in the background...
if not exist "logs" mkdir "logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$npm = (Get-Command npm.cmd).Source; Start-Process -FilePath $npm -ArgumentList 'run','dev' -WorkingDirectory '%~dp0backend' -WindowStyle Hidden -RedirectStandardOutput '%~dp0logs\backend.log' -RedirectStandardError '%~dp0logs\backend-error.log'"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$npm = (Get-Command npm.cmd).Source; Start-Process -FilePath $npm -ArgumentList 'run','dev' -WorkingDirectory '%~dp0frontend' -WindowStyle Hidden -RedirectStandardOutput '%~dp0logs\frontend.log' -RedirectStandardError '%~dp0logs\frontend-error.log'"
echo.

REM ---- 6. Open the app ----
echo [6/6] Opening the application...
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
echo       Opening %URL_TO_OPEN%
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
