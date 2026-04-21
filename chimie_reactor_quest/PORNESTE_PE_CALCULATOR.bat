@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>&1
if not errorlevel 1 (
  py -3 launch_local.py
  goto :eof
)

where python >nul 2>&1
if not errorlevel 1 (
  python launch_local.py
  goto :eof
)

where python3 >nul 2>&1
if not errorlevel 1 (
  python3 launch_local.py
  goto :eof
)

echo Nu am gasit Python 3 pe calculator.
echo Instaleaza doar Python 3 si apoi deschide din nou acest fisier.
pause
