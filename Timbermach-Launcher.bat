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

set "WAIT_LARAVEL=0"
set "WAIT_PYTHON=0"
set "WAIT_HARDWARE=0"

set "SPLASH_PID_FILE=%TEMP%\TimberMachLauncherSplash.pid"
set "SPLASH_PID="
call :StartSplash

echo ========================================
echo Starting TimberMach services...
echo ========================================
echo Project : %PROJECT_ROOT%
echo Laravel : %LARAVEL_PATH%
echo Python  : %PYTHON_PATH%
echo App EXE : %APP_EXE%
echo ========================================

if exist "%LARAVEL_PATH%\artisan" (
  call :StartHiddenProcess "Laravel API" "%LARAVEL_PATH%" "php" "artisan serve --host 127.0.0.1 --port 8000"
  if not errorlevel 1 set "WAIT_LARAVEL=1"
) else (
  echo [WARN] Laravel project not found at: %LARAVEL_PATH%
)

if exist "%PYTHON_PATH%\app.py" (
  call :StartHiddenProcess "Python API" "%PYTHON_PATH%" "python" "app.py"
  if not errorlevel 1 set "WAIT_PYTHON=1"
) else (
  echo [WARN] Python backend not found at: %PYTHON_PATH%\app.py
)

if "%START_HARDWARE%"=="1" (
  if exist "%PROJECT_ROOT%\server.js" (
    call :StartHiddenProcess "Hardware Bridge" "%PROJECT_ROOT%" "node" "server.js"
    if not errorlevel 1 set "WAIT_HARDWARE=1"
  ) else (
    echo [WARN] server.js not found at: %PROJECT_ROOT%\server.js
  )
)

if "%WAIT_LARAVEL%"=="1" call :WaitForPort "127.0.0.1" "8000" "Laravel API"
if "%WAIT_PYTHON%"=="1" call :WaitForPort "127.0.0.1" "5000" "Python API"
if "%WAIT_HARDWARE%"=="1" call :WaitForPort "127.0.0.1" "5001" "Hardware WebSocket"

call :CloseSplash

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
exit /b 0

:StartSplash
if exist "%SPLASH_PID_FILE%" del "%SPLASH_PID_FILE%" >nul 2>nul
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; [System.Windows.Forms.Application]::EnableVisualStyles(); $form = New-Object System.Windows.Forms.Form; $form.Text = 'TimberMach'; $form.StartPosition = 'CenterScreen'; $form.Size = New-Object System.Drawing.Size(380,160); $form.FormBorderStyle = 'FixedDialog'; $form.ControlBox = $false; $form.TopMost = $true; $form.BackColor = [System.Drawing.Color]::FromArgb(18,30,58); $label = New-Object System.Windows.Forms.Label; $label.AutoSize = $true; $label.ForeColor = [System.Drawing.Color]::White; $label.Font = New-Object System.Drawing.Font('Segoe UI',14,[System.Drawing.FontStyle]::Bold); $label.Text = 'Loading TimberMach...'; $label.Location = New-Object System.Drawing.Point(55,35); $sub = New-Object System.Windows.Forms.Label; $sub.AutoSize = $true; $sub.ForeColor = [System.Drawing.Color]::LightGray; $sub.Font = New-Object System.Drawing.Font('Segoe UI',9); $sub.Text = 'Starting services. Please wait.'; $sub.Location = New-Object System.Drawing.Point(85,72); $bar = New-Object System.Windows.Forms.ProgressBar; $bar.Style = 'Marquee'; $bar.MarqueeAnimationSpeed = 25; $bar.Size = New-Object System.Drawing.Size(300,16); $bar.Location = New-Object System.Drawing.Point(35,102); $form.Controls.Add($label); $form.Controls.Add($sub); $form.Controls.Add($bar); Set-Content -Path '%SPLASH_PID_FILE%' -Value $PID -Encoding ascii; [System.Windows.Forms.Application]::Run($form)"
for /L %%i in (1,1,10) do (
  if exist "%SPLASH_PID_FILE%" (
    set /p SPLASH_PID=<"%SPLASH_PID_FILE%"
    goto :eof
  )
  timeout /t 1 /nobreak >nul
)
goto :eof

:StartHiddenProcess
setlocal
set "SERVICE=%~1"
set "WORKDIR=%~2"
set "EXE=%~3"
set "ARGS=%~4"

powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$wd='%WORKDIR%'; $exe='%EXE%'; $args='%ARGS%'; try { Start-Process -FilePath $exe -ArgumentList $args -WorkingDirectory $wd -WindowStyle Hidden | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo [WARN] Failed to start %SERVICE% in background.
  endlocal & exit /b 1
)

echo [OK] %SERVICE% started in background.
endlocal & exit /b 0

:WaitForPort
setlocal
set "HOST=%~1"
set "PORT=%~2"
set "SERVICE=%~3"
set "MAX_TRIES=45"

echo [WAIT] Waiting for %SERVICE% on %HOST%:%PORT% ...
for /L %%i in (1,1,%MAX_TRIES%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$h='%HOST%'; $p=%PORT%; $client = New-Object System.Net.Sockets.TcpClient; try { $async = $client.BeginConnect($h,$p,$null,$null); if ($async.AsyncWaitHandle.WaitOne(700) -and $client.Connected) { $client.EndConnect($async) | Out-Null; exit 0 } else { exit 1 } } catch { exit 1 } finally { $client.Close() }" >nul 2>nul
  if not errorlevel 1 (
    echo [OK] %SERVICE% is ready.
    endlocal & exit /b 0
  )
  timeout /t 1 /nobreak >nul
)
echo [WARN] %SERVICE% did not respond in time. Continuing...
endlocal & exit /b 1

:CloseSplash
if defined SPLASH_PID (
  taskkill /PID %SPLASH_PID% /T /F >nul 2>nul
)
if exist "%SPLASH_PID_FILE%" del "%SPLASH_PID_FILE%" >nul 2>nul
exit /b 0
