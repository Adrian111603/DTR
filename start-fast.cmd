@echo off
setlocal enabledelayedexpansion
title LGU DTR Management System - Fast Launch
cd /d "%~dp0"

echo ============================================
echo   LGU DTR - Fast Launch ^(no rebuild^)
echo ============================================
echo.

REM ---- 1. Make sure Docker engine is reachable, start Docker Desktop if not ----
echo [1/3] Checking Docker engine...
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
    goto waitdocker
)
:dockerready
echo       Docker engine is ready.
echo.

REM ---- 2. Start existing containers (no build) ----
echo [2/3] Starting containers...
docker compose up -d
if %errorlevel% neq 0 (
    echo       Start failed. If this is the first run or you changed code,
    echo       use start.cmd instead ^(it rebuilds the images^).
    pause
    exit /b 1
)
echo.

REM ---- 3. Quick health check, then open the browser ----
echo [3/3] Waiting for backend ^(quick check^)...
set /a btries=0
:waitbackend
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000/api/health 2>nul | findstr "200" >nul
if %errorlevel% equ 0 goto backendready
set /a btries+=1
if !btries! geq 15 (
    echo       Backend slow to respond. Opening anyway...
    goto openweb
)
goto waitbackend
:backendready
echo       Backend is up.
echo.

:openweb
start "" http://localhost:5173
echo ============================================
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3000
echo   Login    : admin / admin123
echo ============================================
echo.
echo   View logs : docker compose logs -f
echo   Stop all  : stop.cmd
echo.
echo   Tip: use start.cmd ^(with rebuild^) after changing code.
echo.
pause
