@echo off
setlocal

REM Change to Laravel project directory
cd /d C:\xampp\htdocs\TIMBER

echo Running Laravel migrations...
php artisan migrate

echo.
echo Done.
pause
