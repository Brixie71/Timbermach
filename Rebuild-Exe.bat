@echo off
setlocal
title TimberMach - Rebuild EXE

REM Run from script location
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
pushd "%PROJECT_ROOT%"

echo [1/4] Removing node_modules (if present)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Recurse -Force 'node_modules' -ErrorAction SilentlyContinue"
if errorlevel 1 echo [WARN] Could not delete node_modules (may not exist).

echo [2/4] Removing package-lock.json (if present)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Force 'package-lock.json' -ErrorAction SilentlyContinue"
if errorlevel 1 echo [WARN] Could not delete package-lock.json (may not exist).

echo [3/4] Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo [4/4] Building installer (npm run dist)...
call npm run dist
if errorlevel 1 goto :fail

echo.
echo [OK] Rebuild complete. Output: Deployment folder.
goto :eof

:fail
echo.
echo [ERROR] Rebuild failed. Check messages above.
exit /b 1

