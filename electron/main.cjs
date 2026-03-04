const { app, BrowserWindow, shell, nativeImage } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const { existsSync } = require("fs");

let mainWindow;
const isTest = process.env.NODE_ENV === "test" || process.env.ELECTRON_TEST === "1";

const defaultWindowState = { width: 1280, height: 800, useContentSize: true };

const loadWindowState = async (statePath) => {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, "utf-8"));
    return { ...defaultWindowState, ...parsed };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Unable to read window state, using defaults:", error.message);
    }
    return defaultWindowState;
  }
};

const saveWindowState = async (statePath, state) => {
  try {
    await fs.writeFile(statePath, JSON.stringify(state));
  } catch (error) {
    console.warn("Unable to persist window state:", error.message);
  }
};

const SERVICE_START_TIMEOUT_MS = Number(process.env.SERVICE_START_TIMEOUT_MS || 45000);

function getLauncherBatPath() {
  if (!app.isPackaged) {
    // DEV: project root
    return path.join(__dirname, "..", "Timbermach-Launcher.bat");
  }

  // PROD: packaged via extraResources (see package.json build.extraResources)
  return path.join(process.resourcesPath, "Timbermach-Launcher.bat");
}

function getKillBatPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, "..", "killServices.bat");
  }
  return path.join(process.resourcesPath, "killServices.bat");
}

function startBackendServices() {
  if (process.platform !== "win32") {
    console.log("Skipping launcher: Windows BAT only");
    return Promise.resolve();
  }

  const batPath = getLauncherBatPath();
  if (!existsSync(batPath)) {
    console.warn("Launcher BAT not found at:", batPath);
    return Promise.resolve();
  }

  console.log("Starting services using:", batPath);

  return new Promise((resolve, reject) => {
    const child = spawn("cmd.exe", ["/c", batPath], {
      cwd: path.dirname(batPath),
      windowsHide: false,
      detached: false,
      stdio: "inherit",
    });

    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(`Service launcher still running after ${SERVICE_START_TIMEOUT_MS}ms; continuing app startup.`);
      resolve(); // proceed even if launcher keeps running (common when it tails logs)
    }, SERVICE_START_TIMEOUT_MS);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        console.log("Service launcher exited cleanly.");
        resolve();
      } else {
        reject(new Error(`Launcher BAT exited with code ${code}`));
      }
    });
  });
}

function stopBackendServices() {
  if (process.platform !== "win32") {
    return;
  }

  const batPath = getKillBatPath();
  if (!existsSync(batPath)) {
    console.warn("Kill BAT not found at:", batPath);
    return;
  }

  console.log("Stopping services using:", batPath);
  try {
    spawn("cmd.exe", ["/c", batPath], {
      cwd: path.dirname(batPath),
      windowsHide: false,
      detached: false,
      stdio: "inherit",
    });
  } catch (err) {
    console.error("Failed to spawn kill BAT:", err);
  }
}

// Reduce occlusion overhead on some iGPUs; keep GPU path simple.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

async function createWindow() {
  console.log("Creating main window...");

  const iconPath = path.join(__dirname, "../resources/electron-icon/elec-icon.ico");
  const appIcon = nativeImage.createFromPath(iconPath);

  const windowStatePath = path.join(app.getPath("userData"), "window-state.json");
  const windowState = await loadWindowState(windowStatePath);

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 480,
    useContentSize: true,
    title: "TimberMach - Wood Testing System",
    icon: appIcon.isEmpty() ? undefined : appIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      spellcheck: false,
      autoplayPolicy: "user-gesture-required",
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: !isTest,
      experimentalFeatures: false,
    },

    frame: true,
    backgroundColor: "#1a202c",
    show: false,
    autoHideMenuBar: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
  });

  mainWindow.once("ready-to-show", () => {
    console.log("Window ready, showing now...");
    mainWindow.show();
    mainWindow.focus();
  });

  try {
    await startBackendServices();
  } catch (serviceError) {
    console.error("Service launcher failed:", serviceError);
    // Continue launching UI so the user can see the error logs.
  }

  const envTarget = (process.env.ENV_NAME || '').trim();
  const isUrlTarget = /^https?:\/\//i.test(envTarget);
  const isDevEnv = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isUrlTarget) {
    console.log('Loading renderer from ENV_NAME');

    mainWindow
      .loadURL(envTarget)
      .then(() => console.log('Loaded successfully from ENV_NAME'))
      .catch((err) => {
        console.error('Failed to load from ENV_NAME:', err);
      });
  } else {
    console.log('PRODUCTION / FILE MODE');
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading renderer from file:', indexPath);

    mainWindow
      .loadFile(indexPath)
      .then(() => console.log('Loaded successfully from build'))
      .catch((err) => console.error('Failed to load from build:', err));
  }

  if (isDevEnv) {
    mainWindow.webContents.openDevTools();
  }

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  let lastContentBounds = { width: windowState.width, height: windowState.height, x: windowState.x, y: windowState.y };

  const captureBounds = () => {
    if (!mainWindow.isMinimized() && !mainWindow.isFullScreen()) {
      lastContentBounds = mainWindow.getContentBounds();
    }
  };

  mainWindow.on("resize", captureBounds);
  mainWindow.on("move", captureBounds);

  mainWindow.on("close", async () => {
    const stateToSave = {
      ...lastContentBounds,
      isMaximized: mainWindow.isMaximized(),
    };
    await saveWindowState(windowStatePath, stateToSave);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Opening external URL:", url);
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    console.log("Main window closed");
    mainWindow = null;
  });

  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      const logLevels = ["VERBOSE", "INFO", "WARNING", "ERROR"];
      const logLevel = logLevels[level] || "LOG";
      console.log(`[Renderer ${logLevel}] ${message}`);
      if (sourceId) {
        console.log(`  Source: ${sourceId}:${line}`);
      }
    },
  );

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Page failed to load:", errorCode, errorDescription);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("✅ Page finished loading");
  });

  mainWindow.webContents.on("dom-ready", () => {
    console.log("✅ DOM ready");
  });
}

app.whenReady().then(async () => {
  console.log("========================================");
  console.log("       TIMBERMACH ELECTRON APP");
  console.log("========================================");
  console.log("App name:", app.getName());
  console.log("App version:", app.getVersion());
  console.log("Electron version:", process.versions.electron);
  console.log("Chrome version:", process.versions.chrome);
  console.log("Node version:", process.versions.node);
  console.log("Platform:", process.platform);
  console.log("Architecture:", process.arch);
  console.log("========================================");

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log("Re-creating window (macOS activate)");
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  console.log("All windows closed");
  if (process.platform !== "darwin") {
    console.log("Quitting app...");
    app.quit();
  }
});

app.on("before-quit", () => {
  console.log("App is about to quit");
  stopBackendServices();
});

app.on("will-quit", () => {
  console.log("App will quit");
});

process.on("uncaughtException", (error) => {
  console.error("========================================");
  console.error("UNCAUGHT EXCEPTION IN MAIN PROCESS:");
  console.error("========================================");
  console.error(error);
  console.error("Stack trace:", error.stack);
  console.error("========================================");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("========================================");
  console.error("UNHANDLED PROMISE REJECTION:");
  console.error("========================================");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  console.error("========================================");
});

console.log("✅ Electron main process loaded successfully");
console.log("Waiting for app.whenReady()...");
