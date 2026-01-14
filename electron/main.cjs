const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

let mainWindow;

/**
 * Create the main application window
 */
function createWindow() {
  console.log("Creating main window...");

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 480,
    title: "TimberMach - Wood Testing System",
    icon: path.join(__dirname, "../public/icon.png"), // Optional: Add your app icon
    webPreferences: {
      // Security settings
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false,

      // ✅ CRITICAL: Disable web security to bypass CORS
      webSecurity: true,

      // Additional security
      allowRunningInsecureContent: true,
      experimentalFeatures: false,
    },

    // Window styling
    frame: true,
    backgroundColor: "#1a202c",
    show: false, // Don't show until ready (prevents flashing)

    // Window behavior
    autoHideMenuBar: true, // Set to true to hide menu bar
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
  });

  // Wait for window to be ready before showing (smooth startup)
  mainWindow.once("ready-to-show", () => {
    console.log("Window ready, showing now...");
    mainWindow.show();
    mainWindow.focus();
  });

  // ========================================
  // DEVELOPMENT vs PRODUCTION MODE
  // ========================================

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

  if (isDev) {
    // Development: Load from Vite dev server
    console.log("🔧 DEVELOPMENT MODE");
    console.log("Loading from Vite dev server: http://localhost:5173");

    mainWindow
      .loadURL("http://localhost:5173")
      .then(() => {
        console.log("✅ Loaded successfully from dev server");
      })
      .catch((err) => {
        console.error("❌ Failed to load from dev server:", err);
        console.log("Make sure Vite is running on port 5173");
      });

    // Open DevTools automatically in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from built files
    console.log("🚀 PRODUCTION MODE");
    const indexPath = path.join(__dirname, "../dist/index.html");
    console.log("Loading from:", indexPath);

    mainWindow
      .loadFile(indexPath)
      .then(() => {
        console.log("✅ Loaded successfully from build");
      })
      .catch((err) => {
        console.error("❌ Failed to load from build:", err);
      });
  }

  // ========================================
  // WINDOW EVENT HANDLERS
  // ========================================

  // Handle external links (open in default browser instead of Electron)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Opening external URL:", url);
    shell.openExternal(url);
    return { action: "deny" }; // Don't open in Electron
  });

  // Window closed event
  mainWindow.on("closed", () => {
    console.log("Main window closed");
    mainWindow = null;
  });

  // Log all console messages from renderer process (useful for debugging)
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

  // Handle page load errors
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      console.error("Page failed to load:", errorCode, errorDescription);
    },
  );

  // Log when navigation completes
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("✅ Page finished loading");
  });

  // Log when DOM is ready
  mainWindow.webContents.on("dom-ready", () => {
    console.log("✅ DOM ready");
  });
}

// ========================================
// APP EVENT HANDLERS
// ========================================

/**
 * App is ready - create the window
 */
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

  /**
   * macOS: Re-create window when dock icon is clicked and no windows are open
   */
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log("Re-creating window (macOS activate)");
      createWindow();
    }
  });
});

/**
 * All windows closed - quit the app (except on macOS)
 */
app.on("window-all-closed", () => {
  console.log("All windows closed");

  // On macOS, apps typically stay open until explicitly quit (Cmd+Q)
  if (process.platform !== "darwin") {
    console.log("Quitting app...");
    app.quit();
  }
});

/**
 * App is about to quit
 */
app.on("before-quit", () => {
  console.log("App is about to quit");
});

/**
 * App has quit
 */
app.on("will-quit", () => {
  console.log("App will quit");
});

// ========================================
// ERROR HANDLERS
// ========================================

/**
 * Handle uncaught exceptions in main process
 */
process.on("uncaughtException", (error) => {
  console.error("========================================");
  console.error("UNCAUGHT EXCEPTION IN MAIN PROCESS:");
  console.error("========================================");
  console.error(error);
  console.error("Stack trace:", error.stack);
  console.error("========================================");
});

/**
 * Handle unhandled promise rejections
 */
process.on("unhandledRejection", (reason, promise) => {
  console.error("========================================");
  console.error("UNHANDLED PROMISE REJECTION:");
  console.error("========================================");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  console.error("========================================");
});

// ========================================
// STARTUP LOG
// ========================================

console.log("✅ Electron main process loaded successfully");
console.log("Waiting for app.whenReady()...");
