# TimberMach

TimberMach is an Electron + React UI for wood test management, backed by a Laravel API and a Python (Flask) computer-vision service.

This README is Windows-first because the project paths and scripts assume XAMPP on Windows.

## Prerequisites

- Git
- Node.js 22.12.0 (recommended via nvm-windows)
- npm 10+
- Python 3.11+ (for the Flask service)
- XAMPP (PHP 8.x + MySQL) or a standalone PHP + MySQL setup
- Composer (Laravel dependencies)
- Tesseract OCR (required for OCR features)
- Visual C++ Build Tools (sometimes required for native modules)

## Repository Layout

- `src/`: React UI
- `electron/`: Electron main process
- `python-backend/`: Flask API for computer vision and OCR
- `server.js`: Optional serialport WebSocket bridge for hardware
- Laravel backend lives outside this repo by default:
  - `C:\xampp\htdocs\TIMBER`

## Quick Start (Dev)

1) Clone this repo

```
git clone <your-repo-url>
cd Timbermach
```

2) Use the required Node version

```
nvm install 22.12.0
nvm use 22.12.0
node -v
```

3) Install frontend/Electron dependencies

```
npm install
```

4) Set up the Python backend

```
cd python-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The Python service runs on `http://localhost:5000/` by default.

5) Set up the Laravel backend

The project expects the Laravel API at:
`C:\xampp\htdocs\TIMBER`

If you clone it elsewhere, update the `dev:laravel`, `dev:fullstack`, and `dev:all` scripts in `package.json`.

Typical Laravel setup:

```
cd C:\xampp\htdocs\TIMBER
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve --host 127.0.0.1 --port 8000
```

If you need seed data, import `timbemach.sql` into your MySQL database, then run migrations.

6) Start the full stack

```
npm run dev:fullstack
```

Or run everything including Electron:

```
npm run dev:all
```

## Running Services Individually

Frontend (Vite):
```
npm run dev
```

Laravel API:
```
npm run dev:laravel
```

Python backend:
```
npm run dev:python
```

Electron:
```
npm run dev:electron
```

## Environment Variables

Root `.env` is used by Vite:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_PYTHON_API_URL=http://localhost:5000/
VITE_MOISTURE_CAMERA_NAME="Integrated Camera"
VITE_OCR_INTERVAL_MS=0
```

If you change ports or hosts, update `.env` and restart Vite.

## Build and Package (Production)

Build the React UI:
```
npm run build
```

Build the React UI to the Deployment folder:
```
npm run build:deploy
```

Package the Electron app:
```
npm run package
```

Packaged output will be placed in:
`C:\Users\Jhon_Brix\Desktop\PERSONAL-PROJECT\Deployment`

If you want to output builds to a specific folder, configure it in `electron-builder` settings or pass custom paths in your build scripts.

## Tailwind v4 Notes

Tailwind v4 requires `@tailwindcss/postcss` and the v4 import style:

- `postcss.config.js` uses `@tailwindcss/postcss`
- `src/App.css` includes `@import "tailwindcss";`

If you see layout issues, ensure you are running with the latest dependencies and that Vite is restarted.

## Lockfiles

This repo currently contains both `package-lock.json` and `yarn.lock`. Pick one package manager:

- npm (recommended): keep `package-lock.json` and remove or ignore `yarn.lock`
- yarn: keep `yarn.lock` and remove or ignore `package-lock.json`

Do not use both at the same time.

## Troubleshooting

- Electron install fails with EBUSY: close any running Electron dev windows and re-run `npm install`.
- Tailwind errors: ensure `@tailwindcss/postcss` is installed and Vite is restarted.
- Laravel not found: confirm `C:\xampp\htdocs\TIMBER` exists and update scripts in `package.json` if you moved it.
- OCR not working: install Tesseract and ensure it is on PATH.

## Optional: Hardware Serial Bridge

`server.js` starts a WebSocket bridge for serial devices. Run it only if you are using the hardware sensors:

```
node server.js
```

Adjust COM ports and baud rates inside `server.js` if needed.
