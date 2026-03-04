Installation Manual — TimberMach (Single Installer with MySQL)
==============================================================

Goal
----
Ship TimberMach as one Windows installer that bundles:
- Electron desktop app
- Portable MySQL/MariaDB + PHP + Laravel API (TIMBER)
- First-run bootstrap that brings up DB, runs migrations, and starts the API

High-level flow
---------------
1) Prepare a portable backend bundle (PHP + MySQL + TIMBER code + .env).
2) Configure Electron Builder to ship that bundle via `extraResources`.
3) Add an Electron bootstrap script to unpack backend on first run, start MySQL, run `php artisan migrate --force`, then start the Laravel API.
4) Build the installer with Electron Builder (NSIS).

Directory layout (recommended)
------------------------------
project-root/
├─ electron/               # your main.cjs, preload, etc.
├─ dist/                   # Vite build output (frontend)
├─ resources/
│  └─ backend/             # portable backend bundle (added below)
│     ├─ php/              # portable PHP
│     ├─ mysql/            # portable MySQL/MariaDB binaries + data dir
│     ├─ TIMBER/           # Laravel app (C:/xampp/htdocs/TIMBER contents)
│     └─ bootstrap/        # helper scripts (start DB, migrate, start API)
├─ package.json
└─ Installation Manual.md

Step 1: Build the frontend
--------------------------
```
npm install
npm run build
```
This populates `dist/` for Electron to load in production.

Step 2: Prepare portable backend
--------------------------------
1) Copy TIMBER into `resources/backend/TIMBER`.
2) Copy a portable PHP (matching your TIMBER PHP version) into `resources/backend/php`.
3) Copy a portable MySQL/MariaDB into `resources/backend/mysql`.
   - Configure `my.ini` for a local port (e.g., 3307) and a data directory inside `resources/backend/mysql/data`.
   - Create a DB and user; dump an empty schema if you like, but migrations will create tables.
4) Create `resources/backend/TIMBER/.env` pointing to the portable MySQL:
   ```
   APP_ENV=production
   APP_KEY=base64:GENERATE_ONE
   APP_DEBUG=false
   APP_URL=http://127.0.0.1:8080

   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3307
   DB_DATABASE=timbermach
   DB_USERNAME=timberuser
   DB_PASSWORD=timberpass
   ```
5) Add bootstrap scripts under `resources/backend/bootstrap/`:
   - `start-mysql.bat` / `start-mysql.ps1` (starts mysqld with the local my.ini).
   - `migrate.bat` (runs `php artisan migrate --force` using the bundled PHP).
   - `start-api.bat` (runs `php artisan serve --host 127.0.0.1 --port 8080` or starts Apache if you prefer).

Step 3: Wire Electron to the backend (first-run bootstrap)
----------------------------------------------------------
In `electron/main.cjs` (production branch):
1) On first launch:
   - Copy `resources/backend` to `%LOCALAPPDATA%/Timbermach/backend` (use `app.getPath("userData")` parent).
   - Run `start-mysql` and wait for port 3307 to open.
   - Run `migrate.bat` (or a Node `spawn` of bundled PHP) once; set a flag file `bootstrap.done`.
2) On every launch:
   - Ensure MySQL is running; if not, start it.
   - Start/ensure the API is running on 127.0.0.1:8080.
3) Point the renderer base URL (LARAVEL_BASE_URL) to `http://127.0.0.1:8080`.

Step 4: Electron Builder config
-------------------------------
In `package.json` → `build`:
```
"extraResources": [
  { "from": "resources/backend", "to": "backend" }
],
"files": [
  "dist/**",
  "electron/**",
  "package.json"
],
"asar": true,
"win": { "target": ["nsis"] },
"nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
```
The backend lives outside ASAR and is copied to `resources/app/backend` inside the installer, then unpacked to `%LOCALAPPDATA%/Timbermach/backend` on first run.

Step 5: Build the installer
---------------------------
```
npm run dist
```
Outputs: `Timbermach Setup <version>.exe` in `dist/`.

Step 6: First-run behavior (what users see)
-------------------------------------------
1) Install Timbermach from the generated NSIS installer.
2) On first launch, the app:
   - Unpacks backend to `%LOCALAPPDATA%/Timbermach/backend`.
   - Starts MySQL (local port 3307).
   - Runs Laravel migrations.
   - Starts the API on `http://127.0.0.1:8080`.
3) Subsequent launches reuse the running/auto-started services.

Operational notes
-----------------
- Installer size: expect several hundred MB because MySQL + PHP are included.
- Updates: ship a new installer; on first launch of the new version, re-run migrations (idempotent).
- Services lifetime: simplest is to start MySQL/API per app launch; more advanced is to install them as Windows services (NSSM) during first run.
- Logs: write backend/stdout logs to `%LOCALAPPDATA%/Timbermach/logs`.

If you want service-based startup (background MySQL/API even when the app isn’t open), we can add NSSM service install commands to the bootstrap. Let me know and I’ll script that. 

Required software (for building & bundling)
-------------------------------------------
For the developer machine (to produce the installer):
- **Node.js 18+** (npm included) — build React/Vite and run Electron Builder.
- **Python 3** (optional) — only if your scripts/tools need it.
- **Git** (optional) — to manage source.
- **Windows 10/11** — Electron target platform.
- **PHP** (matching TIMBER, e.g., 8.2.x) — to run artisan locally during backend prep.
- **Composer** — to install Laravel dependencies in TIMBER.
- **MySQL/MariaDB** — to create the portable data dir and test migrations (same major version as the portable bundle).
- **NSIS** — installed automatically by Electron Builder on first run; ensure build tools can download it (or preinstall).

Runtime stack included in the installer (bundled)
-------------------------------------------------
- **Electron app** (frontend built with React/Vite).
- **PHP runtime** (portable).
- **MySQL/MariaDB portable** (configured to listen on 127.0.0.1:3307).
- **Laravel API (TIMBER)** with `.env` pre-set to the bundled DB.
- **Bootstrap scripts** to start MySQL, run migrations, and start the API on port 8080.

Setup checklist (developer side)
--------------------------------
1) Install Node.js; run `npm install`.
2) Install PHP + Composer; run `composer install` inside TIMBER.
3) Prepare portable MySQL (or MariaDB) and initialize:
   - Create data directory.
   - Set root or dedicated user (`timberuser` / `timberpass`).
   - Create DB `timbermach`.
4) Set TIMBER `.env` to point to 127.0.0.1:3307 with the above creds.
5) Run `php artisan migrate` locally to validate schema.
6) Build frontend: `npm run build`.
7) Stage backend bundle into `resources/backend` (php/, mysql/, TIMBER/, bootstrap/).
8) Configure `extraResources` in `package.json`.
9) Build installer: `npm run dist`.

Setup checklist (end user / deployed machine)
---------------------------------------------
All dependencies are bundled. User actions:
1) Run the NSIS installer (`Timbermach Setup ... .exe`).
2) First app launch performs one-time unpack, starts MySQL, runs migrations, and starts the API.
3) App connects to `http://127.0.0.1:8080` automatically.

Ports and paths
---------------
- MySQL: 127.0.0.1:3307 (adjust in `.env` and MySQL config if needed).
- API: 127.0.0.1:8080 (set in `.env` APP_URL and frontend config).
- Backend install path after unpack: `%LOCALAPPDATA%/Timbermach/backend`.
- Logs: `%LOCALAPPDATA%/Timbermach/logs`.

Notes on XAMPP
--------------
Instead of full XAMPP, this plan uses portable PHP + MySQL to reduce weight and complexity. If you insist on XAMPP, replace the portable stack with the XAMPP folder and update bootstrap scripts to start Apache/MySQL from XAMPP instead of the slimmer binaries.
