const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let gnugoLocal = null;

function loadGnuGoLocal() {
    if (!gnugoLocal) {
        try {
            gnugoLocal = require(path.join(__dirname, 'gnugoLocal.js'));
        } catch (e) {
            console.warn('[Electron] GnuGo local not loaded:', e.message);
        }
    }
    return gnugoLocal;
}

function createWindow() {
    const iconPath = path.join(__dirname, '..', 'public', 'images', 'Icon.png');
    const winOpts = {
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    };
    if (fs.existsSync(iconPath)) {
        winOpts.icon = iconPath;
    }
    mainWindow = new BrowserWindow(winOpts);

    const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_START_URL;
    if (process.env.ELECTRON_START_URL) {
        mainWindow.loadURL(process.env.ELECTRON_START_URL);
    } else if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    app.quit();
});

ipcMain.handle('gnugo-move', async (event, request) => {
    const local = loadGnuGoLocal();
    if (!local) return { error: 'GnuGo not available' };
    try {
        const move = await local.getGnuGoMove(request);
        return { move };
    } catch (e) {
        return { error: e.message || String(e) };
    }
});

ipcMain.handle('gnugo-available', async () => {
    const local = loadGnuGoLocal();
    return local ? local.isGnuGoAvailable() : false;
});
