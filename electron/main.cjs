const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

let mainWindow;

// Reduce occlusion overhead on some iGPUs; keep GPU path simple.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

function createWindow() {
  console.log("Creating main window...");

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 480,
    title: "TimberMach - Wood Testing System",
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false,
      spellcheck: false,
      autoplayPolicy: "user-gesture-required",
      webSecurity: true,
      allowRunningInsecureContent: true,
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

app.whenReady().then(() => {
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

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log("Re-creating window (macOS activate)");
      createWindow();
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

