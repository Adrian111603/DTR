@echo off
setlocal enabledelayedexpansion
title DTR Management System - Launcher
cd /d "%~dp0"

echo ============================================
echo   DTR Management System - Launcher
echo ============================================
echo.

REM ---- 1. Make sure Docker engine is reachable, start Docker Desktop if not ----
echo [1/4] Checking Docker engine...
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
echo [2/4] Building and starting containers ^(first run may take several minutes^)...
docker compose up -d --build
if %errorlevel% neq 0 (
    echo       docker compose failed. See the output above.
    pause
    exit /b 1
)
echo.

REM ---- 3. Wait for the backend to respond on its health endpoint ----
echo [3/4] Waiting for backend at http://localhost:3000 ...
set /a btries=0
:waitbackend
timeout /t 3 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000/api/health 2>nul | findstr "200" >nul
if %errorlevel% equ 0 goto backendready
set /a btries+=1
if !btries! geq 40 (
    echo       Backend not responding yet. Opening anyway - it may still be migrating/seeding.
    goto openweb
)
goto waitbackend
:backendready
echo       Backend is up.
echo.

:openweb
REM ---- 4. Open the app in the default browser ----
echo [4/4] Opening the application...
start "" http://localhost:5173
echo.
echo ============================================
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3000
echo   Login    : admin / admin123
echo ============================================
echo.
echo Containers are running in the background.
echo   View logs : docker compose logs -f
echo   Stop all  : stop.cmd  ^(or: docker compose down^)
echo.
pause
