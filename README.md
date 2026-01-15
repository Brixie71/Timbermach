# TimberMach — Beginner’s Guide

This guide walks you through **setting up and running TimberMach from scratch**, even if you’ve never worked with Electron, React, Laravel, or Python services together before. Follow the steps in order. Don’t skip ahead.

---

## What Is TimberMach?

TimberMach is a **desktop application** used to manage and analyze wood testing data.

It is made of four parts working together:

1. **Electron + React** → the desktop user interface
2. **Laravel (PHP)** → the main API and database logic
3. **Python (Flask)** → computer vision and OCR processing
4. **Optional hardware bridge** → connects sensors via serial ports

All services run **locally on your computer** during development.

---

## Before You Start (Important)

This project is **Windows-first**. The instructions assume:

* Windows 10 or 11
* XAMPP installed in `C:\xampp`

If you are using macOS or Linux, the concepts are the same but paths and commands will differ.

---

## Step 0 — Install Required Software

Install these tools **before cloning the project**.

### Required

* Git
* Node.js **22.12.0** (use `nvm-windows` if possible)
* npm **10 or newer**
* Python **3.11 or newer**
* XAMPP (PHP 8.x + MySQL)
* Composer (PHP dependency manager)

### Optional but Recommended

* Visual C++ Build Tools (fixes native module issues on Windows)

After installing, restart your computer to avoid PATH issues.

---

## Step 1 — Clone the Repository

Open **Command Prompt** or **PowerShell** and run:

```bash
git clone <your-repo-url>
cd TimberMach
```

You should now be inside the project folder.

---

## Step 2 — Set the Correct Node.js Version

This project requires **Node.js 22.12.0**.

```bash
nvm install 22.12.0
nvm use 22.12.0
node -v
```

If `node -v` does not show `v22.12.0`, stop and fix this first.

---

## Step 3 — Install Frontend & Electron Dependencies

From the project root:

```bash
npm install
```

This may take a few minutes. Errors here usually mean:

* Wrong Node version
* Missing Visual C++ Build Tools

---

## Step 4 — Start the Python Backend (Computer Vision)

Open a **new terminal window**.

```bash
cd python-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

If successful, you should see:

```
Running on http://localhost:5000/
```

Leave this terminal open.

---

## Step 5 — Set Up the Laravel Backend (API)

The Laravel backend is expected at:

```
C:\xampp\htdocs\TIMBER
```

### If the folder does not exist

Clone or move your Laravel project there.

### Laravel setup

```bash
cd C:\xampp\htdocs\TIMBER
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve --host 127.0.0.1 --port 8000
```

If you have existing data, import `timbermach.sql` into MySQL **before** running migrations.

Leave this terminal open as well.

---

## Step 6 — Start TimberMach (Everything Together)

Return to the **main project folder** and run:

```bash
npm run dev:fullstack
```

This starts:

* React UI
* Laravel API connection
* Python service connection

### To include Electron (desktop app):

```bash
npm run dev:all
```

You should now see the application running.

---

## Running Individual Services (Advanced)

Use these only if you know what you’re debugging:

* React UI only: `npm run dev`
* Laravel only: `npm run dev:laravel`
* Python only: `npm run dev:python`
* Electron only: `npm run dev:electron`

---

## Environment Configuration

The `.env` file in the project root controls service connections:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_PYTHON_API_URL=http://localhost:5000/
VITE_MOISTURE_CAMERA_NAME="Integrated Camera"
VITE_OCR_INTERVAL_MS=0
```

After changing this file, **restart the frontend**.

---

## Building the App (Production)

### Build React UI

```bash
npm run build
```

### Build for deployment

```bash
npm run build:deploy
```

### Package Electron App

```bash
npm run package
```

Output location:

```
C:\Users\Jhon_Brix\Desktop\PERSONAL-PROJECT\Deployment
```

---

## Tailwind CSS Notes

This project uses **Tailwind v4**.

Key points:

* Uses `@tailwindcss/postcss`
* CSS imports via `@import "tailwindcss"`

If styles look broken:

1. Restart Vite
2. Re-run `npm install`

---

## Package Manager Warning

Use **only one** package manager.

Recommended:

* npm → keep `package-lock.json`

Avoid mixing with Yarn.

---

## Common Problems & Fixes

**Electron install fails (EBUSY)**

* Close all Electron windows
* Re-run `npm install`

**Laravel not found**

* Verify `C:\xampp\htdocs\TIMBER` exists
* Update scripts in `package.json` if moved

---

## Optional — Hardware Serial Bridge

Only needed if using physical sensors.

```bash
node server.js
```

Edit COM ports and baud rates inside `server.js` if required.

---

## Final Notes

This system is modular by design. Once everything runs locally, you can:

* Swap databases
* Move services to another machine
* Package it as a standalone desktop app

Take it slow. Once set up, development becomes straightforward.
