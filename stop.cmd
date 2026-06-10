@echo off
title DTR Management System - Stop
cd /d "%~dp0"

echo Stopping DTR Management System containers...
docker compose down
echo.
echo Done. Data is preserved in the postgres volume.
echo To also delete the database volume, run: docker compose down -v
echo.
pause
