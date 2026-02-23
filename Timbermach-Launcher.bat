@echo off
setlocal
title TimberMach Launcher

REM Resolve project root from this script location.
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

REM Paths (override with env vars if needed).
if "%LARAVEL_PATH%"=="" set "LARAVEL_PATH=C:\xampp\htdocs\TIMBER"
if "%PYTHON_PATH%"=="" set "PYTHON_PATH=%PROJECT_ROOT%\python-backend"
if "%APP_EXE%"=="" set "APP_EXE=%PROJECT_ROOT%\..\Deployment\win-unpacked\Timbermach.exe"

set "START_HARDWARE=0"
if /I "%~1"=="--hardware" set "START_HARDWARE=1"

echo ========================================
echo Starting TimberMach services...
echo ========================================
echo Project : %PROJECT_ROOT%
echo Laravel : %LARAVEL_PATH%
echo Python  : %PYTHON_PATH%
echo App EXE : %APP_EXE%
echo ========================================

if exist "%LARAVEL_PATH%\artisan" (
  start "TimberMach Laravel API" cmd /k "cd /d ""%LARAVEL_PATH%"" && php artisan serve --host 127.0.0.1 --port 8000"
) else (
  echo [WARN] Laravel project not found at: %LARAVEL_PATH%
)

if exist "%PYTHON_PATH%\app.py" (
  start "TimberMach Python API" cmd /k "cd /d ""%PYTHON_PATH%"" && python app.py"
) else (
  echo [WARN] Python backend not found at: %PYTHON_PATH%\app.py
)

if "%START_HARDWARE%"=="1" (
  if exist "%PROJECT_ROOT%\server.js" (
    start "TimberMach Hardware Bridge" cmd /k "cd /d ""%PROJECT_ROOT%"" && node server.js"
  ) else (
    echo [WARN] server.js not found at: %PROJECT_ROOT%\server.js
  )
)

timeout /t 2 /nobreak >nul

if exist "%APP_EXE%" (
  start "TimberMach App" "%APP_EXE%"
  echo [OK] TimberMach started.
) else (
  echo [WARN] Packaged app not found: %APP_EXE%
  echo Build it first with: npm run dist
)

echo.
echo Tip:
echo - Use --hardware to also start node server.js
echo   Example: Timbermach-Launcher.bat --hardware
echo.

endlocal
