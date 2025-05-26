"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs_1 = __importDefault(require("fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const child_process_1 = require("child_process");
const MAX_HISTORY = 100;
let mainWindow = null;
let lastText = '';
let lastImageDataUrl = '';
let tray = null;
let windowHideBehavior = 'hide';
let showInTaskbar = false;
let showNotifications = false;
// --- Win+V override state ---
let winVOverrideEnabled = false;
let backendShortcut = 'Control+Shift+V';
// --- AHK process management ---
let ahkProcess = null;
let currentAhkShortcut = '';
let lastAhkScriptPath = null;
// Fix AHK path to point to project root/native directory
const AHK_EXE_PATH = path.join(electron_1.app.getAppPath(), 'native', 'AutoHotkey.exe');
const WM_CLIP_SHOW = 0x8001;
// Use native clipmsg instead of ffi-napi for HWND tracking
let lastForegroundHwnd = null;
let clipmsg = null;
try {
    // Use absolute path resolution for the native module
    const clipmsgPath = path.resolve(path.join(electron_1.app.getAppPath(), 'native', 'clipmsg.node'));
    console.log(`[main] Loading clipmsg from: ${clipmsgPath}`);
    clipmsg = require(clipmsgPath);
    console.log(`[main] Loaded clipmsg module, exports: ${Object.keys(clipmsg).join(', ')}`);
}
catch (e) {
    console.error('[main] Failed to load native clipmsg addon:', e);
}
function usesWindowsKey(shortcut) {
    return /(^|\+)(Win|Windows|Super|Meta)(\+|$)/i.test(shortcut);
}
function ahkShortcutString(shortcut) {
    let s = shortcut;
    s = s.replace(/Control/gi, '^');
    s = s.replace(/Ctrl/gi, '^');
    s = s.replace(/Shift/gi, '+');
    s = s.replace(/Alt/gi, '!');
    s = s.replace(/(Win|Windows|Super|Meta)/gi, '#');
    const parts = s.split('+');
    const mainKey = parts.pop();
    return parts.join('') + (mainKey ? mainKey.toLowerCase() : '');
}
function generateAhkScript(shortcut) {
    const ahkHotkey = ahkShortcutString(shortcut);
    return `#NoTrayIcon
#SingleInstance Force

; Find the Clip window by title
DetectHiddenWindows(True)
SetTitleMatchMode(2)

; Custom message ID (must match Electron side)
WM_CLIP_SHOW := 0x8001  ; Arbitrary value, must match Electron

${ahkHotkey}::
{
    ; Find the window
    hwnd := WinExist("Clip - Clipboard Manager")
    if (hwnd) {
        PostMessage(WM_CLIP_SHOW, 0, 0,, "ahk_id " hwnd)
    }
}
`;
}
// Kill only AutoHotkey processes that use our generated script
function killOurAhkProcesses() {
    if (!lastAhkScriptPath)
        return;
    const wmicCmd = `wmic process where "Name='AutoHotkey.exe'" get ProcessId,CommandLine /FORMAT:CSV`;
    (0, child_process_1.exec)(wmicCmd, { shell: 'powershell.exe' }, (err, stdout) => {
        if (err || !stdout)
            return;
        const lines = stdout.split('\n').slice(1);
        for (const line of lines) {
            const cols = line.split(',');
            const cmd = cols[1] || '';
            const pid = cols[2]?.trim();
            if (cmd.includes(lastAhkScriptPath)) {
                (0, child_process_1.exec)(`taskkill /PID ${pid} /F`, (killErr) => {
                    if (!killErr)
                        console.log(`[main] Killed AHK process with PID ${pid}`);
                });
            }
        }
    });
}
function startAhkForShortcut(shortcut) {
    if (!usesWindowsKey(shortcut)) {
        stopAhk();
        return;
    }
    if (ahkProcess && currentAhkShortcut === shortcut)
        return; // Already running with correct shortcut
    stopAhk();
    try {
        // Check if AHK_EXE_PATH exists
        if (!fs_1.default.existsSync(AHK_EXE_PATH)) {
            console.error(`[main] AutoHotkey.exe not found at ${AHK_EXE_PATH}`);
            return;
        }
        // Write temp AHK script
        const tempScriptPath = path.join(electron_1.app.getPath('userData'), 'clip_win_keybinds.ahk');
        fs_1.default.writeFileSync(tempScriptPath, generateAhkScript(shortcut), 'utf8');
        lastAhkScriptPath = tempScriptPath;
        console.log(`[main] Generated AHK script at ${tempScriptPath}`);
        // Launch AHK process
        ahkProcess = (0, child_process_1.spawn)(AHK_EXE_PATH, [tempScriptPath], { stdio: 'ignore', detached: false });
        currentAhkShortcut = shortcut;
        if (ahkProcess) {
            console.log(`[main] Started AHK process for shortcut: ${shortcut}`);
            ahkProcess.on('exit', (code) => {
                console.log(`[main] AHK process exited with code ${code}`);
                ahkProcess = null;
                currentAhkShortcut = '';
            });
            ahkProcess.on('error', (err) => {
                console.error('[main] AHK process error:', err);
                ahkProcess = null;
                currentAhkShortcut = '';
            });
        }
    }
    catch (err) {
        console.error('[main] Error starting AHK process:', err);
        ahkProcess = null;
        currentAhkShortcut = '';
    }
}
function stopAhk() {
    // Stop our tracked process
    if (ahkProcess) {
        try {
            ahkProcess.kill();
            console.log('[main] Successfully terminated AHK process');
        }
        catch (err) {
            console.error('[main] Error terminating AHK process:', err);
        }
        ahkProcess = null;
    }
    else {
        console.log('[main] No AHK process to terminate');
    }
    // Also kill any orphaned scripts from this app
    killOurAhkProcesses();
    lastAhkScriptPath = null;
    currentAhkShortcut = '';
}
// Last-resort: terminate all AutoHotkey.exe processes
function killAllAhkProcesses() {
    (0, child_process_1.exec)('taskkill /IM AutoHotkey.exe /F', (err, stdout, stderr) => {
        if (err) {
            // no-op: no processes to kill or error occurred
            return;
        }
        console.log('[main] Killed all AutoHotkey processes');
    });
}
function handleShortcutChange(shortcut) {
    // Clean up any existing scripts from our app
    killOurAhkProcesses();
    const currentUsesWindowsKey = usesWindowsKey(currentAhkShortcut);
    const newUsesWindowsKey = usesWindowsKey(shortcut);
    if (currentAhkShortcut === shortcut) {
        console.log('[main] Shortcut unchanged, no action needed');
        return;
    }
    if (!currentUsesWindowsKey && newUsesWindowsKey) {
        // Switching from a non-Windows-key shortcut to a Windows-key shortcut
        console.log('[main] Switching from non-Windows-key shortcut to Windows-key shortcut');
        try {
            electron_1.globalShortcut.unregisterAll(); // Unregister all global shortcuts
        }
        catch (err) {
            console.error('[main] Error unregistering global shortcuts:', err);
        }
    }
    else if (currentUsesWindowsKey && !newUsesWindowsKey) {
        // Switching from a Windows-key shortcut to a non-Windows-key shortcut
        console.log('[main] Switching from Windows-key shortcut to non-Windows-key shortcut');
        stopAhk();
    }
    else if (currentUsesWindowsKey && newUsesWindowsKey && currentAhkShortcut !== shortcut) {
        // Both shortcuts use the Windows key, but the shortcut details have changed
        console.log('[main] Switching between different Windows-key shortcuts');
        stopAhk();
    }
    if (newUsesWindowsKey) {
        startAhkForShortcut(shortcut);
    }
    else {
        backendShortcut = shortcut;
        updateGlobalShortcut();
    }
    currentAhkShortcut = shortcut; // Update the current shortcut
}
// Helper to (re)register global shortcut
function updateGlobalShortcut() {
    try {
        electron_1.globalShortcut.unregisterAll();
    }
    catch { }
    electron_1.globalShortcut.register(backendShortcut, () => {
        showMainWindow();
    });
}
// Determine DB path (portable if EXE is in a writeable folder, else use appdata)
function getDatabasePath() {
    const exeDir = path.dirname(process.execPath);
    const isPortable = process.env.PORTABLE_EXECUTABLE_DIR || exeDir === process.cwd();
    if (isPortable) {
        return path.join(exeDir, 'clip.db');
    }
    else {
        const appData = electron_1.app.getPath('userData');
        return path.join(appData, 'clip.db');
    }
}
let db;
function initDatabase() {
    const dbPath = getDatabasePath();
    db = new better_sqlite3_1.default(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        content BLOB NOT NULL,
        timestamp INTEGER NOT NULL
    )`);
    const columns = db.prepare("PRAGMA table_info(history)").all();
    const hasPinned = columns.some((col) => col.name === 'pinned');
    if (!hasPinned) {
        db.exec('ALTER TABLE history ADD COLUMN pinned INTEGER DEFAULT 0');
    }
}
// Insert clipboard item into DB
function insertClipboardItem(item) {
    const last = db.prepare('SELECT content, type FROM history ORDER BY id DESC LIMIT 1').get();
    if (last && last.content === item.content && last.type === item.type)
        return;
    db.prepare('INSERT INTO history (type, content, timestamp, pinned) VALUES (?, ?, ?, ?)')
        .run(item.type, item.content, item.timestamp, item.pinned ? 1 : 0);
    const countRow = db.prepare('SELECT COUNT(*) as count FROM history').get();
    if (countRow && countRow.count > MAX_HISTORY) {
        db.prepare('DELETE FROM history WHERE id IN (SELECT id FROM history WHERE pinned = 0 ORDER BY id DESC LIMIT -1 OFFSET ?)').run(MAX_HISTORY);
    }
}
// Toggle pinned status for an item
function toggleItemPinned(id, pinned) {
    return db.prepare('UPDATE history SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id);
}
// Delete clipboard item by id
function deleteClipboardItem(id) {
    db.prepare('DELETE FROM history WHERE id = ?').run(id);
}
// Get clipboard history from DB (most recent first)
function getClipboardHistory() {
    return db.prepare('SELECT id, type, content, timestamp, pinned FROM history ORDER BY pinned DESC, id DESC LIMIT ?').all(MAX_HISTORY);
}
function ensureTray(mainWindow) {
    if (!tray) {
        let iconPath = path.join(electron_1.app.getAppPath(), 'assets', 'icon256.ico');
        tray = new electron_1.Tray(iconPath);
        tray.setToolTip('Clip - Clipboard Manager');
        tray.setContextMenu(electron_1.Menu.buildFromTemplate([
            { label: 'Show', click: () => { mainWindow.show(); } },
            { label: 'Quit', click: () => { electron_1.app.quit(); } },
        ]));
        tray.on('double-click', () => mainWindow.show());
    }
}
function removeTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 400,
        height: 600,
        frame: false,
        resizable: false,
        transparent: true,
        roundedCorners: true,
        show: false,
        skipTaskbar: !showInTaskbar,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    mainWindow.loadURL(process.env.NODE_ENV === 'development'
        ? 'http://localhost:8080'
        : `file://${path.resolve(__dirname, '../index.html')}`);
    mainWindow.on('close', (e) => {
        if (windowHideBehavior === 'hide' || windowHideBehavior === 'tray') {
            e.preventDefault();
            if (mainWindow)
                mainWindow.setSkipTaskbar(true);
            if (windowHideBehavior === 'hide') {
                mainWindow?.hide();
            }
            else if (windowHideBehavior === 'tray') {
                mainWindow?.hide();
                ensureTray(mainWindow);
            }
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    mainWindow.on('show', () => {
        if (mainWindow) {
            mainWindow.setSkipTaskbar(!showInTaskbar);
            mainWindow.webContents.send('clipboard-history', getClipboardHistory());
        }
    });
}
function pollClipboard() {
    setInterval(() => {
        const text = electron_1.clipboard.readText();
        const image = electron_1.clipboard.readImage();
        let imageDataUrl = '';
        if (!image.isEmpty()) {
            imageDataUrl = image.toDataURL();
        }
        if (text) {
            const last = db.prepare('SELECT content, type FROM history ORDER BY id DESC LIMIT 1').get();
            if (!last || last.content !== text || last.type !== 'text') {
                const item = { type: 'text', content: text, timestamp: Date.now() };
                insertClipboardItem(item);
                console.log('[main] New text detected:', text);
                if (mainWindow && mainWindow.isVisible()) {
                    mainWindow.webContents.send('clipboard-item', item);
                    console.log('[main] Sent clipboard-item (text) to renderer');
                }
                if (showNotifications) {
                    const notification = {
                        title: 'Clip - New Text Copied',
                        body: text.length > 50 ? text.substring(0, 50) + '...' : text
                    };
                    new electron_1.Notification(notification).show();
                }
            }
        }
        if (imageDataUrl) {
            const last = db.prepare('SELECT content, type FROM history ORDER BY id DESC LIMIT 1').get();
            if (!last || last.content !== imageDataUrl || last.type !== 'image') {
                const item = { type: 'image', content: imageDataUrl, timestamp: Date.now() };
                insertClipboardItem(item);
                console.log('[main] New image detected');
                if (mainWindow && mainWindow.isVisible()) {
                    mainWindow.webContents.send('clipboard-item', item);
                    console.log('[main] Sent clipboard-item (image) to renderer');
                }
                if (showNotifications) {
                    const notification = {
                        title: 'Clip - New Image Copied',
                        body: 'An image was copied to clipboard'
                    };
                    new electron_1.Notification(notification).show();
                }
            }
        }
    }, 800);
}
// --- BACKUP/RESTORE LOGIC ---
const BACKUP_DIR = path.join(path.dirname(getDatabasePath()), 'clip_backups');
let clipEnableBackups = false;
let clipBackupInterval = 15 * 60 * 1000;
let clipMaxBackups = 5;
function ensureBackupDir() {
    if (!fs_1.default.existsSync(BACKUP_DIR))
        fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
}
function getBackupFiles() {
    ensureBackupDir();
    return fs_1.default.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => ({
        file: f,
        time: fs_1.default.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
    }))
        .sort((a, b) => b.time - a.time);
}
function createBackup() {
    ensureBackupDir();
    const dbPath = getDatabasePath();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `clip-backup-${ts}.db`);
    fs_1.default.copyFileSync(dbPath, backupPath);
    const backups = getBackupFiles();
    if (backups.length > clipMaxBackups) {
        backups.slice(clipMaxBackups).forEach(b => fs_1.default.unlinkSync(path.join(BACKUP_DIR, b.file)));
    }
    return backupPath;
}
function restoreBackup(backupFile) {
    const dbPath = getDatabasePath();
    fs_1.default.copyFileSync(path.join(BACKUP_DIR, backupFile), dbPath);
}
electron_1.ipcMain.handle('create-backup', () => {
    return createBackup();
});
electron_1.ipcMain.handle('list-backups', () => {
    return getBackupFiles();
});
electron_1.ipcMain.handle('restore-backup', (_event, file) => {
    restoreBackup(file);
    return true;
});
electron_1.ipcMain.handle('export-db', () => {
    const dbPath = getDatabasePath();
    return fs_1.default.readFileSync(dbPath);
});
electron_1.ipcMain.handle('import-db', (_event, buffer) => {
    const dbPath = getDatabasePath();
    fs_1.default.writeFileSync(dbPath, Buffer.from(buffer));
    return true;
});
electron_1.ipcMain.on('set-backup-settings', (_event, { enableBackups, backupInterval, maxBackups }) => {
    clipEnableBackups = enableBackups;
    clipBackupInterval = backupInterval;
    clipMaxBackups = maxBackups;
    setupAutoBackup();
});
let backupTimer = null;
function setupAutoBackup() {
    if (backupTimer)
        clearInterval(backupTimer);
    if (clipEnableBackups) {
        backupTimer = setInterval(() => {
            createBackup();
        }, clipBackupInterval || 15 * 60 * 1000);
    }
}
setupAutoBackup();
// --- Native Windows message handler for AHK trigger ---
function registerNativeMessageHandler() {
    if (process.platform !== 'win32' || !mainWindow || !clipmsg)
        return;
    try {
        const hwndBuf = mainWindow.getNativeWindowHandle();
        clipmsg.hookWindow(hwndBuf, WM_CLIP_SHOW, () => {
            showMainWindow();
        });
        console.log('[main] Native Windows message handler registered');
    }
    catch (e) {
        console.error('[main] Failed to load native message handler:', e);
    }
}
function savePreviousHwnd() {
    try {
        // First make sure clipmsg is loaded
        if (!clipmsg) {
            const clipmsgPath = path.resolve(path.join(electron_1.app.getAppPath(), 'native', 'clipmsg.node'));
            console.log(`[main] Re-loading clipmsg from: ${clipmsgPath}`);
            clipmsg = require(clipmsgPath);
            console.log(`[main] Re-loaded clipmsg module, exports: ${Object.keys(clipmsg).join(', ')}`);
        }
        // Use the global clipmsg instance
        if (clipmsg && typeof clipmsg.getForegroundWindow === 'function') {
            let hwnd = clipmsg.getForegroundWindow();
            if (typeof hwnd === 'object' && hwnd !== null && Buffer.isBuffer(hwnd)) {
                // Handle Buffer (Node < v12 or some native modules)
                lastForegroundHwnd = hwnd.readUInt32LE(0);
            }
            else if (typeof hwnd === 'bigint') {
                lastForegroundHwnd = Number(hwnd);
            }
            else if (typeof hwnd === 'number') {
                lastForegroundHwnd = hwnd;
            }
            else {
                lastForegroundHwnd = null;
            }
            console.log('[main] Saved HWND:', lastForegroundHwnd);
        }
        else {
            lastForegroundHwnd = null;
            console.warn('[main] clipmsg.getForegroundWindow not available');
        }
    }
    catch (e) {
        lastForegroundHwnd = null;
        console.error('[main] Error in savePreviousHwnd:', e);
    }
}
function showMainWindow() {
    // Save the previous foreground window HWND before showing
    savePreviousHwnd();
    if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
    }
    if (!mainWindow)
        return;
    mainWindow.setSkipTaskbar(!showInTaskbar);
    if (windowHideBehavior === 'tray')
        ensureTray(mainWindow);
    else
        removeTray();
    if (mainWindow.isMinimized())
        mainWindow.restore();
    mainWindow.setAlwaysOnTop(true);
    electron_1.app.focus();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);
    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('force-refresh');
        }
    }, 100);
}
electron_1.app.whenReady().then(() => {
    initDatabase();
    createMainWindow();
    pollClipboard();
    updateGlobalShortcut();
    registerNativeMessageHandler();
    handleShortcutChange(backendShortcut);
    electron_1.ipcMain.on('paste-clipboard-item', (_event, item) => {
        if (item.type === 'text') {
            electron_1.clipboard.writeText(item.content);
        }
        else if (item.type === 'image') {
            const image = electron_1.nativeImage.createFromDataURL(item.content);
            electron_1.clipboard.writeImage(image);
        }
        // Pass HWND to SendPaste.exe for reliable pasting
        let hwndArg = '';
        if (lastForegroundHwnd && typeof lastForegroundHwnd === 'number' && lastForegroundHwnd !== 0) {
            hwndArg = lastForegroundHwnd.toString();
        }
        const sendPastePath = path.join(electron_1.app.getAppPath(), 'native', 'SendPaste.exe');
        require('child_process').execFile(sendPastePath, [hwndArg], (err, stdout, stderr) => {
            if (err) {
                console.error('[main] SendPaste.exe error:', err);
            }
            if (stdout) {
                console.log('[SendPaste.exe stdout]:', stdout);
            }
            if (stderr) {
                console.error('[SendPaste.exe stderr]:', stderr);
            }
        });
        // Hide/minimize window first
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.blur();
            mainWindow.minimize();
            if (windowHideBehavior === 'hide') {
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.setSkipTaskbar(true);
                        mainWindow.hide();
                        removeTray();
                    }
                }, 100);
            }
            else if (windowHideBehavior === 'tray') {
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.setSkipTaskbar(true);
                        mainWindow.hide();
                        ensureTray(mainWindow);
                    }
                }, 100);
            }
        }
    });
    electron_1.ipcMain.on('set-window-hide-behavior', (_event, behavior) => {
        windowHideBehavior = behavior;
        if (windowHideBehavior === 'tray' && mainWindow) {
            ensureTray(mainWindow);
        }
        else {
            removeTray();
        }
    });
    electron_1.ipcMain.on('set-show-in-taskbar', (_event, show) => {
        showInTaskbar = !!show;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setSkipTaskbar(!showInTaskbar);
        }
    });
    electron_1.ipcMain.on('set-notifications', (_event, enabled) => {
        showNotifications = enabled;
    });
    electron_1.ipcMain.on('set-start-with-system', (_event, enabled) => {
        electron_1.app.setLoginItemSettings({
            openAtLogin: enabled,
            openAsHidden: true
        });
    });
    electron_1.ipcMain.on('hide-window', () => {
        mainWindow?.hide();
    });
    electron_1.ipcMain.on('request-clipboard-history', (event) => {
        event.reply('clipboard-history', getClipboardHistory());
    });
    electron_1.ipcMain.on('clear-clipboard-history', (event) => {
        db.prepare('DELETE FROM history').run();
        electron_1.clipboard.clear();
        lastText = '';
        lastImageDataUrl = '';
        event.reply('clipboard-history', getClipboardHistory());
    });
    electron_1.ipcMain.on('toggle-item-pinned', (event, { id, pinned }) => {
        toggleItemPinned(id, pinned);
        event.reply('clipboard-history', getClipboardHistory());
    });
    electron_1.ipcMain.on('delete-clipboard-item', (event, id) => {
        const row = db.prepare('SELECT type, content FROM history WHERE id = ?').get(id);
        deleteClipboardItem(id);
        if (row) {
            if (row.type === 'text') {
                try {
                    if (electron_1.clipboard.readText() === row.content) {
                        electron_1.clipboard.clear();
                        lastText = '';
                    }
                }
                catch { }
            }
            else if (row.type === 'image') {
                try {
                    const img = electron_1.clipboard.readImage();
                    if (!img.isEmpty() && img.toDataURL() === row.content) {
                        electron_1.clipboard.clear();
                        lastImageDataUrl = '';
                    }
                }
                catch { }
            }
        }
        event.reply('clipboard-history', getClipboardHistory());
    });
    electron_1.ipcMain.on('set-global-shortcut', (_event, shortcut) => {
        handleShortcutChange(shortcut);
    });
    electron_1.ipcMain.on('set-win-v-override', (_event, enabled) => {
        winVOverrideEnabled = !!enabled;
        updateGlobalShortcut();
    });
    electron_1.ipcMain.on('set-backend-shortcut', (_event, shortcut) => {
        backendShortcut = shortcut;
        updateGlobalShortcut();
    });
    electron_1.ipcMain.on('quit-app', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('save-settings-before-quit');
        }
        setTimeout(() => {
            try {
                electron_1.globalShortcut.unregisterAll();
            }
            catch { }
            try {
                if (tray) {
                    tray.destroy();
                    tray = null;
                }
            }
            catch { }
            stopAhk();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.removeAllListeners();
                mainWindow.close();
            }
            electron_1.app.quit();
        }, 200);
    });
    electron_1.ipcMain.on('restart-app', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('save-settings-before-quit');
        }
        setTimeout(() => {
            try {
                electron_1.globalShortcut.unregisterAll();
            }
            catch { }
            try {
                if (tray) {
                    tray.destroy();
                    tray = null;
                }
            }
            catch { }
            stopAhk();
            // No need to close the main window explicitly, app.relaunch will handle it.
            electron_1.app.relaunch();
            electron_1.app.exit(0); // Exit cleanly
        }, 200); // Same delay as quit-app for consistency
    });
});
electron_1.app.on('window-all-closed', () => {
});
electron_1.app.on('activate', () => {
    if (!mainWindow)
        createMainWindow();
});
electron_1.app.on('before-quit', () => {
    stopAhk(); // Ensure AHK process is terminated when quitting the app
});
