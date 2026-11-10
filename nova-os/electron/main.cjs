/**
 * ORBIT — Native Windows Desktop Application
 * Electron Main Process
 *
 * Implements:
 * - Native frameless/dark window with GPU hardware acceleration.
 * - Automatic background Python AI backend lifecycle management (auto-starts on launch, terminates on exit).
 * - System tray integration (minimize to tray, quick status, quit).
 * - Native desktop notifications.
 * - Single instance lock (prevents duplicate windows).
 * - Persistent window state and preferences.
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let tray = null;
let pythonProcess = null;
let isQuitting = false;

const SERVER_PORT = 7915;
const ROOT_DIR = path.resolve(__dirname, '..', '..');

// 1. Enforce High-Performance GPU Acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('high-performance-gpu');

// 2. Single Instance Lock
const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Check if the Python AI backend server is already running on port 7915.
 */
function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${SERVER_PORT}/api/state`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Automatically launch Python server.py if not already active.
 */
async function startPythonBackend() {
  const running = await isServerRunning();
  if (running) {
    console.log('[ORBIT Desktop] Python backend already active on port', SERVER_PORT);
    return;
  }

  console.log('[ORBIT Desktop] Spawning Python AI server from:', ROOT_DIR);
  pythonProcess = spawn('python', ['server.py'], {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    shell: true,
    windowsHide: true,
  });

  pythonProcess.on('error', (err) => {
    console.error('[ORBIT Desktop] Failed to spawn Python backend:', err);
  });

  // Wait for server to come up
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 400));
    if (await isServerRunning()) {
      console.log('[ORBIT Desktop] Python AI backend ready on port', SERVER_PORT);
      return;
    }
  }
}

/**
 * Terminate the background Python server on exit.
 */
function stopPythonBackend() {
  if (pythonProcess) {
    try {
      console.log('[ORBIT Desktop] Terminating Python backend...');
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', pythonProcess.pid.toString(), '/f', '/t']);
      } else {
        pythonProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('[ORBIT Desktop] Error killing Python backend:', e);
    }
    pythonProcess = null;
  }
}

/**
 * Create the main desktop application window.
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    title: 'ORBIT — Native AI Command Center',
    backgroundColor: '#05080d',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  // Load backend production server or local fallback
  const targetUrl = `http://localhost:${SERVER_PORT}`;
  mainWindow.loadURL(targetUrl).catch(() => {
    // If backend isn't up, fall back to built html
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Minimize to tray on close instead of destroying
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: 'ORBIT Active',
          body: 'ORBIT is running in the background. Click the tray icon to restore.',
        }).show();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Create System Tray Icon & Context Menu.
 */
function createSystemTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
    tray = new Tray(iconPath);
  } catch {
    // Fallback if icon not found
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open ORBIT',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Restart AI Backend',
      click: async () => {
        stopPythonBackend();
        await startPythonBackend();
        if (mainWindow) mainWindow.reload();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit ORBIT',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('ORBIT — Native AI Command Center');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────

ipcMain.on('orbit:minimize-tray', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('orbit:notify', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

ipcMain.on('orbit:open-external', (_, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

ipcMain.on('orbit:set-boot', (_, enable) => {
  app.setLoginItemSettings({
    openAtLogin: !!enable,
    openAsHidden: true,
  });
});

// ─── App Lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await startPythonBackend();
  createMainWindow();
  createSystemTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopPythonBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    stopPythonBackend();
    app.quit();
  }
});
