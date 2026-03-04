@echo off
setlocal
cd /d %~dp0

set "LOG=%~dp0kill-services.log"

echo ==================================================>>"%LOG%"
echo [%date% %time%] Stopping TimberMach services...>>"%LOG%"

call :kill "php.exe" "Laravel/PHP"
call :kill "python.exe" "Python backend"

echo [%date% %time%] All stop attempts issued.>>"%LOG%"
echo ==================================================>>"%LOG%"
exit /b 0

:kill
set "PROC=%~1"
set "NAME=%~2"
echo [%date% %time%] [%NAME%] stopping...>>"%LOG%"
taskkill /IM %PROC% /F >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [%date% %time%] [%NAME%] stopped.>>"%LOG%"
) else (
  echo [%date% %time%] [%NAME%] not running or already closed.>>"%LOG%"
)
goto :eof
