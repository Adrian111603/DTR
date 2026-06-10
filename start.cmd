@echo off
setlocal enabledelayedexpansion
title DTR Management System - Launcher
cd /d "%~dp0"
set "APP_URL=http://localhost:5173"
set "API_URL=http://localhost:3000"

echo ============================================
echo   DTR Management System - Launcher
echo ============================================
echo.

REM ---- 1. Make sure Docker engine is reachable, start Docker Desktop if not ----
echo [1/5] Checking Docker engine...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo       Docker engine not running. Starting Docker Desktop...
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else (
        echo       Could not find Docker Desktop.exe automatically.
        echo       Please start Docker Desktop manually, then re-run this script.
        pause
        exit /b 1
    )

    echo       Waiting for Docker engine to be ready ^(up to 3 minutes^)...
    set /a tries=0
    :waitdocker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if !errorlevel! equ 0 goto dockerready
    set /a tries+=1
    if !tries! geq 60 (
        echo       Docker did not become ready in time. Check Docker Desktop and retry.
        pause
        exit /b 1
    )
    echo       ...still starting ^(attempt !tries!/60^)
    goto waitdocker
)
:dockerready
echo       Docker engine is ready.
echo.

REM ---- 2. Build and start the stack ----
echo [2/5] Building and starting containers ^(first run may take several minutes^)...
docker compose up -d --build
if %errorlevel% neq 0 (
    echo       docker compose failed. See the output above.
    echo       Checking if the website is already running...
    curl -s -o nul -w "%%{http_code}" %APP_URL% 2>nul | findstr "200" >nul
    if !errorlevel! equ 0 (
        echo       Website is already available. Opening it now...
        call :openBrowser "%APP_URL%"
    )
    pause
    exit /b 1
)
echo.

REM ---- 3. Wait for the backend to respond on its health endpoint ----
echo [3/5] Waiting for backend at %API_URL% ...
set /a btries=0
:waitbackend
timeout /t 3 /nobreak >nul
curl -s -o nul -w "%%{http_code}" %API_URL%/api/health 2>nul | findstr "200" >nul
if %errorlevel% equ 0 goto backendready
set /a btries+=1
if !btries! geq 40 (
    echo       Backend not responding yet. The website may still be starting.
    goto waitfrontend
)
goto waitbackend
:backendready
echo       Backend is up.
echo.

REM ---- 4. Wait for the frontend website before opening the browser ----
:waitfrontend
echo [4/5] Waiting for website at %APP_URL% ...
set /a ftries=0
:checkfrontend
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" %APP_URL% 2>nul | findstr "200" >nul
if %errorlevel% equ 0 goto frontendready
set /a ftries+=1
if !ftries! geq 30 (
    echo       Website not responding yet. Opening anyway...
    goto openweb
)
goto checkfrontend
:frontendready
echo       Website is ready.
echo.

:openweb
REM ---- 5. Open the app in the default browser ----
echo [5/5] Opening the application...
call :openBrowser "%APP_URL%"
echo.
echo ============================================
echo   Website : %APP_URL%
echo   Backend : %API_URL%
echo   Login    : admin / admin123
echo ============================================
echo.
echo Containers are running in the background.
echo   View logs : docker compose logs -f
echo   Stop all  : stop.cmd  ^(or: docker compose down^)
echo.
pause

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
timeout /t 1 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%URL_TO_OPEN%'" >nul 2>&1
timeout /t 1 /nobreak >nul
rundll32 url.dll,FileProtocolHandler "%URL_TO_OPEN%" >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%URL_TO_OPEN%"
exit /b 0
