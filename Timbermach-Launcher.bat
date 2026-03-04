@echo off
setlocal
cd /d %~dp0
title TimberMach Launcher

if "%LARAVEL_PATH%"=="" set "LARAVEL_PATH=C:\xampp\htdocs\TIMBER"
if "%PHP_EXE%"=="" set "PHP_EXE=C:\xampp\php\php.exe"

if "%PYTHON_PATH%"=="" set "PYTHON_PATH=%~dp0python-backend"
if "%PYTHON_EXE%"=="" set "PYTHON_EXE=python"

echo Starting services...
echo Laravel: %LARAVEL_PATH%
echo PHP    : %PHP_EXE%
echo Python : %PYTHON_PATH%
echo.

if exist "%LARAVEL_PATH%\artisan" (
  powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
    "Start-Process -FilePath '%PHP_EXE%' -ArgumentList 'artisan serve --host 127.0.0.1 --port 8000' -WorkingDirectory '%LARAVEL_PATH%' -WindowStyle Hidden | Out-Null"
  echo [OK] Laravel started
) else (
  echo [WARN] Laravel not found
)

if exist "%PYTHON_PATH%\app.py" (
  powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
    "Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList 'app.py' -WorkingDirectory '%PYTHON_PATH%' -WindowStyle Hidden | Out-Null"
  echo [OK] Python started
) else (
  echo [WARN] Python backend not found
)

exit /b 0