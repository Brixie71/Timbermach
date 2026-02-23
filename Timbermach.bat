@echo off
setlocal
title TimberMach - Dev All

set REACT_PATH=C:\Users\Jhon_Brix\Desktop\PERSONAL-PROJECT\Timbermach
set PYTHON_PATH=%REACT_PATH%\python-backend

cd /d "%REACT_PATH%"
start "TimberMach Python API" cmd /k "cd /d ""%PYTHON_PATH%"" && python app.py"
npm run dev:all:no-python
