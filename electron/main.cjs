const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");

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

// Reduce occlusion overhead on some iGPUs; keep GPU path simple.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

async function createWindow() {
  console.log("Creating main window...");

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
    icon: path.join(__dirname, "../public/icon.png"),
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

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

  if (isDev) {
    console.log("🔧 DEVELOPMENT MODE");
    console.log("Loading from Vite dev server: http://localhost:5173");

    mainWindow
      .loadURL("http://localhost:5173")
      .then(() => console.log("✅ Loaded successfully from dev server"))
      .catch((err) => {
        console.error("❌ Failed to load from dev server:", err);
        console.log("Make sure Vite is running on port 5173");
      });

    mainWindow.webContents.openDevTools();
  } else {
    console.log("🚀 PRODUCTION MODE");
    const indexPath = path.join(__dirname, "../dist/index.html");
    console.log("Loading from:", indexPath);

    mainWindow
      .loadFile(indexPath)
      .then(() => console.log("✅ Loaded successfully from build"))
      .catch((err) => console.error("❌ Failed to load from build:", err));
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
