@echo off
title DTR Management System - Stop Local App
cd /d "%~dp0"

echo Stopping DTR backend/frontend processes on ports 3000 and 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = 3000,5173; foreach ($port in $ports) { Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { if ($_ -and $_ -ne $PID) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped process {0} on port {1}' -f $_, $port) } } }"
echo.
echo Done. PostgreSQL is still running and your database data is preserved.
echo.
pause
