@echo off
setlocal enabledelayedexpansion
title DTR Management System - PostgreSQL Setup
cd /d "%~dp0"

set "DB_USER=dtr"
set "DB_PASSWORD=dtr_password"
set "DB_NAME=dtr_db"
set "PSQL_EXE=psql"

where psql >nul 2>&1
if errorlevel 1 (
    for /d %%D in ("%ProgramFiles%\PostgreSQL\*") do (
        if exist "%%~fD\bin\psql.exe" set "PSQL_EXE=%%~fD\bin\psql.exe"
    )
)

echo ============================================
echo   DTR Management System - PostgreSQL Setup
echo ============================================
echo.
echo This creates the local PostgreSQL role/database expected by backend\.env:
echo   User     : %DB_USER%
echo   Password : %DB_PASSWORD%
echo   Database : %DB_NAME%
echo.

set "PG_ADMIN=postgres"
set /p "PG_ADMIN=PostgreSQL admin user [postgres]: "
if "%PG_ADMIN%"=="" set "PG_ADMIN=postgres"

echo.
echo You may be prompted for the %PG_ADMIN% PostgreSQL password.
"%PSQL_EXE%" -U "%PG_ADMIN%" -d postgres -v ON_ERROR_STOP=1 -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '%DB_USER%') THEN CREATE ROLE %DB_USER% LOGIN CREATEDB PASSWORD '%DB_PASSWORD%'; ELSE ALTER ROLE %DB_USER% WITH LOGIN CREATEDB PASSWORD '%DB_PASSWORD%'; END IF; END $$;"
if errorlevel 1 (
    echo.
    echo Could not create/update the PostgreSQL role.
    echo Make sure PostgreSQL is installed, running, and psql is available.
    pause
    exit /b 1
)

"%PSQL_EXE%" -U "%PG_ADMIN%" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '%DB_NAME%';" | findstr /r /c:"1" >nul
if errorlevel 1 (
    "%PSQL_EXE%" -U "%PG_ADMIN%" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE %DB_NAME% OWNER %DB_USER%;"
    if errorlevel 1 (
        echo.
        echo Could not create the PostgreSQL database.
        pause
        exit /b 1
    )
)

"%PSQL_EXE%" -U "%PG_ADMIN%" -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE %DB_NAME% OWNER TO %DB_USER%;"
if errorlevel 1 (
    echo.
    echo Could not assign database ownership.
    pause
    exit /b 1
)

echo.
echo Done. You can now run start.cmd.
echo.
pause
