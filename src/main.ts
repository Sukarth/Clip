// @ts-nocheck
import { app, BrowserWindow, globalShortcut, clipboard, nativeImage, ipcMain, Tray, Menu, Notification, screen } from 'electron';
import * as path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile, spawn, ChildProcess, exec } from 'child_process';
import {
    WINDOW_SIZE_LIMITS,
    createDefaultThemeConfig,
    getThemeSchema,
    normalizeThemeProfileKey,
    sanitizeThemeConfig,
} from './theme-config';

// --- Robust error logging for debugging startup crashes ---
const logPath = path.join(
    process.env.LOCALAPPDATA || os.homedir(),
    'clip-main-error.log'
);
function logError(msg: string) {
    try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch { }
}
process.on('uncaughtException', (err) => {
    logError('Uncaught Exception: ' + (err && err.stack ? err.stack : err));
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason: any) => {
    logError('Unhandled Rejection: ' + (reason && reason.stack ? reason.stack : reason));
    console.error('Unhandled Rejection:', reason);
});
logError('--- Clip main process started ---');

// Set app name for Windows (affects process name and window titles)
if (process.platform === 'win32') {
    app.setAppUserModelId('com.sukarth.clip');
    app.setName('Clip');
}

const MAX_HISTORY = 100;
let mainWindow: BrowserWindow | null = null;
let lastText = '';
let lastImageDataUrl = '';
let lastImageSizeKey = '';
let tray: Tray | null = null;
let windowHideBehavior: 'hide' | 'tray' = 'hide';
let showInTaskbar: boolean = false;
let showNotifications: boolean = false;
let maxHistoryItems: number = MAX_HISTORY;
let windowWidth = WINDOW_SIZE_LIMITS.width.default;
let windowHeight = WINDOW_SIZE_LIMITS.height.default;
let cachedAppDataPath: string | null = null;
let activeThemeConfig = createDefaultThemeConfig();

// --- PERFORMANCE OPTIMIZATIONS: Data Caching ---
let cachedClipboardHistory: any[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 3000; // 3 seconds cache
let isHistoryLoading = false;
let pendingHistoryRequests: Array<(data: any[]) => void> = [];

// --- Win+V override state ---
let winVOverrideEnabled = false;
let backendShortcut = 'Control+Shift+V';
const SAFE_SHORTCUT_FALLBACK = 'Control+Shift+V';

// --- AHK process management ---
let ahkProcess: ChildProcess | null = null;
let currentAhkShortcut = '';
let lastAhkScriptPath: string | null = null;
let ahkProcessPid: number | null = null;
let isAhkShuttingDown = false;
// Fix AHK path - extract from asar if packaged, otherwise use direct path
function getAhkExePath(): string {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        const devPath = path.join(app.getAppPath(), 'native', 'AutoHotkey.exe');
        console.log(`[main] Development mode - using AutoHotkey.exe at: ${devPath}`);
        return devPath;
    }

    // For both installer and portable versions, try to use resources first
    const execDir = path.dirname(process.execPath);
    const resourcesAhkPath = path.join(execDir, 'resources', 'AutoHotkey.exe');

    // Check if resources folder exists (built with extraResources)
    if (fs.existsSync(resourcesAhkPath)) {
        console.log(`[main] Using AutoHotkey.exe from resources: ${resourcesAhkPath}`);
        return resourcesAhkPath;
    }

    // Fallback: extract from app resources to portable data directory
    const tempDir = path.join(getAppDataPath(), 'native-extracted');
    const tempAhkPath = path.join(tempDir, 'AutoHotkey.exe');

    console.log(`[main] Extracting AutoHotkey.exe to: ${tempAhkPath}`);

    try {
        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log(`[main] Created extraction directory: ${tempDir}`);
        }

        // Try to extract from app resources
        const appPath = app.getAppPath();
        const asarAhkPath = path.join(appPath, 'native', 'AutoHotkey.exe');
        console.log(`[main] Looking for AutoHotkey.exe in package at: ${asarAhkPath}`);

        if (fs.existsSync(asarAhkPath)) {
            fs.copyFileSync(asarAhkPath, tempAhkPath);
            console.log(`[main] Successfully extracted AutoHotkey.exe to: ${tempAhkPath}`);
            return tempAhkPath;
        }

        // If extraction failed but temp file exists from previous run, use it
        if (fs.existsSync(tempAhkPath)) {
            console.log(`[main] Using existing extracted file: ${tempAhkPath}`);
            return tempAhkPath;
        }

        console.error(`[main] AutoHotkey.exe not found in package`);
        return path.join(app.getAppPath(), 'native', 'AutoHotkey.exe'); // Fallback

    } catch (error) {
        console.error('[main] Error during AutoHotkey.exe extraction:', error);
        return path.join(app.getAppPath(), 'native', 'AutoHotkey.exe'); // Fallback
    }
}

// Remove the static AHK_EXE_PATH constant - we'll use getAhkExePath() dynamically

const WM_CLIP_SHOW = 0x8001;

let lastForegroundHwnd: number | null = null;

function usesWindowsKey(shortcut: string) {
    return /(^|\+)(Win|Windows|Super|Meta)(\+|$)/i.test(shortcut);
}

function sanitizeShortcut(shortcut: string) {
    if (typeof shortcut !== 'string') return SAFE_SHORTCUT_FALLBACK;
    const normalized = shortcut.trim();
    return normalized.length > 0 ? normalized : SAFE_SHORTCUT_FALLBACK;
}

function ahkShortcutString(shortcut: string) {
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

function generateAhkScript(shortcut: string) {
    const ahkHotkey = ahkShortcutString(shortcut);
    return `#NoTrayIcon
#SingleInstance Force

${ahkHotkey}:: {
    ; Always route through WM_CLIP_SHOW so the app runs its normal show logic.
    ; (WinActivate alone can focus a transparent window without making the UI visible.)
    DetectHiddenWindows(true)
    hwnd := WinExist("Clip - Clipboard Manager")
    if (hwnd) {
        PostMessage(0x8001, 0, 0, , "ahk_id " . hwnd)
        Sleep(30)
        WinActivate("ahk_id " . hwnd)
        WinWaitActive("ahk_id " . hwnd, , 2)
    }
}
`;
}

// Clean shutdown of AHK processes (only clean up processes that are not our current one)
async function cleanupAhkProcesses() {
    if (!lastAhkScriptPath) return;

    return new Promise<void>((resolve) => {
        const wmicCmd = `wmic process where "Name='AutoHotkey.exe'" get ProcessId,CommandLine /FORMAT:CSV`;
        exec(wmicCmd, { shell: 'powershell.exe' }, (err, stdout) => {
            if (err || !stdout) {
                resolve();
                return;
            }

            const lines = stdout.split('\n').slice(1);
            let processesToKill = 0;
            let processesKilled = 0;

            for (const line of lines) {
                const cols = line.split(',');
                const cmd = cols[1] || '';
                const pid = cols[2]?.trim();

                // Only kill processes using our script path that are NOT our current process
                if (cmd.includes(lastAhkScriptPath!) && pid && parseInt(pid) !== ahkProcessPid) {
                    processesToKill++;
                    exec(`taskkill /PID ${pid} /F`, (killErr) => {
                        processesKilled++;
                        if (!killErr) {
                            console.log(`[main] Cleaned up orphaned AHK process with PID ${pid}`);
                        }
                        if (processesKilled >= processesToKill) {
                            resolve();
                        }
                    });
                }
            }

            if (processesToKill === 0) {
                resolve();
            }
        });
    });
}

function startAhkForShortcut(shortcut: string) {
    if (!usesWindowsKey(shortcut)) {
        stopAhk();
        return;
    }

    // If already running the same shortcut, don't restart
    if (ahkProcess && !ahkProcess.killed && currentAhkShortcut === shortcut && !isAhkShuttingDown) {
        console.log(`[main] AHK already running for shortcut: ${shortcut}`);
        return;
    }

    // Stop existing process if different shortcut
    if (currentAhkShortcut !== shortcut) {
        stopAhk();
        // Wait a bit for cleanup
        setTimeout(() => startAhkProcess(shortcut), 200);
    } else {
        startAhkProcess(shortcut);
    }
}

function startAhkProcess(shortcut: string) {
    if (isAhkShuttingDown) {
        console.log('[main] AHK is shutting down, skipping start');
        return;
    }

    try {
        // Get current AHK path (handles extraction if needed)
        const currentAhkPath = getAhkExePath();

        // Check if AHK exe exists
        if (!fs.existsSync(currentAhkPath)) {
            console.error(`[main] AutoHotkey.exe not found at ${currentAhkPath}`);
            return;
        }

        // Write temp AHK script to portable-aware data directory
        const tempScriptPath = path.join(getAppDataPath(), 'clip_win_keybinds.ahk');
        fs.writeFileSync(tempScriptPath, generateAhkScript(shortcut), 'utf8');
        lastAhkScriptPath = tempScriptPath;
        console.log(`[main] Generated AHK script at ${tempScriptPath}`);

        // Launch AHK process
        ahkProcess = spawn(currentAhkPath, [tempScriptPath], {
            stdio: 'ignore',
            detached: false,
            windowsHide: true
        });

        if (ahkProcess && ahkProcess.pid) {
            ahkProcessPid = ahkProcess.pid;
            currentAhkShortcut = shortcut;
            isAhkShuttingDown = false;

            console.log(`[main] Started AHK process (PID: ${ahkProcessPid}) for shortcut: ${shortcut}`);

            // Handle process exit
            ahkProcess.on('exit', (code, signal) => {
                console.log(`[main] AHK process (PID: ${ahkProcessPid}) exited with code ${code}, signal: ${signal}`);

                // Don't restart if we're intentionally shutting down
                if (isAhkShuttingDown) {
                    console.log('[main] AHK process exited during shutdown - this is expected');
                } else if (code === 1 || code === 0) {
                    // Normal exit codes for AHK - don't treat as error
                    console.log('[main] AHK process exited normally');
                } else {
                    console.warn(`[main] AHK process exited with unexpected code ${code}`);
                }

                // Clean up references
                ahkProcess = null;
                ahkProcessPid = null;
                if (isAhkShuttingDown) {
                    currentAhkShortcut = '';
                    isAhkShuttingDown = false;
                }
            });

            ahkProcess.on('error', (err) => {
                console.error('[main] AHK process error:', err);
                ahkProcess = null;
                ahkProcessPid = null;
                if (!isAhkShuttingDown) {
                    currentAhkShortcut = '';
                }
            });
        } else {
            console.error('[main] Failed to start AHK process');
        }
    } catch (err) {
        console.error('[main] Error starting AHK process:', err);
        ahkProcess = null;
        ahkProcessPid = null;
        currentAhkShortcut = '';
    }
}

async function stopAhk() {
    if (!ahkProcess && !ahkProcessPid) {
        console.log('[main] No AHK process to terminate');
        return;
    }

    isAhkShuttingDown = true;
    console.log(`[main] Stopping AHK process (PID: ${ahkProcessPid})`);

    // First try graceful termination
    if (ahkProcess && !ahkProcess.killed) {
        try {
            ahkProcess.kill('SIGTERM');
            console.log('[main] Sent SIGTERM to AHK process');
        } catch (err) {
            console.error('[main] Error sending SIGTERM to AHK process:', err);
        }
    }

    // Wait a moment for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 300));

    // Force kill if still running
    if (ahkProcess && !ahkProcess.killed) {
        try {
            ahkProcess.kill('SIGKILL');
            console.log('[main] Force killed AHK process');
        } catch (err) {
            console.error('[main] Error force killing AHK process:', err);
        }
    }

    // Clean up any remaining processes
    await cleanupAhkProcesses();

    // Reset state
    ahkProcess = null;
    ahkProcessPid = null;
    lastAhkScriptPath = null;
    currentAhkShortcut = '';
    isAhkShuttingDown = false;

    console.log('[main] AHK cleanup completed');
}

// Last-resort: terminate all AutoHotkey.exe processes
function killAllAhkProcesses() {
    exec('taskkill /IM AutoHotkey.exe /F', (err, stdout, stderr) => {
        if (err) {
            // no-op: no processes to kill or error occurred
            return;
        }
        console.log('[main] Killed all AutoHotkey processes');
    });
}

async function handleShortcutChange(shortcut: string) {
    const currentUsesWindowsKey = usesWindowsKey(currentAhkShortcut);
    const newUsesWindowsKey = usesWindowsKey(shortcut);

    if (currentAhkShortcut === shortcut) {
        console.log('[main] Shortcut unchanged, no action needed');
        return;
    }

    // Only cleanup if we're actually changing from one Windows key shortcut to another
    if (currentUsesWindowsKey && newUsesWindowsKey && currentAhkShortcut !== shortcut) {
        console.log('[main] Cleaning up existing AHK processes before switching shortcuts');
        await cleanupAhkProcesses();
    }

    if (!currentUsesWindowsKey && newUsesWindowsKey) {
        // Switching from a non-Windows-key shortcut to a Windows-key shortcut
        console.log('[main] Switching from non-Windows-key shortcut to Windows-key shortcut');
        try {
            globalShortcut.unregisterAll(); // Unregister all global shortcuts
        } catch (err) {
            console.error('[main] Error unregistering global shortcuts:', err);
        }
    } else if (currentUsesWindowsKey && !newUsesWindowsKey) {
        // Switching from a Windows-key shortcut to a non-Windows-key shortcut
        console.log('[main] Switching from Windows-key shortcut to non-Windows-key shortcut');
        await stopAhk();
    } else if (currentUsesWindowsKey && newUsesWindowsKey && currentAhkShortcut !== shortcut) {
        // Both shortcuts use the Windows key, but the shortcut details have changed
        console.log('[main] Switching between different Windows-key shortcuts');
        await stopAhk();
    }

    if (newUsesWindowsKey) {
        startAhkForShortcut(shortcut);
    } else {
        backendShortcut = shortcut;
        updateGlobalShortcut();
    }

    currentAhkShortcut = shortcut; // Update the current shortcut
}

// Helper to (re)register global shortcut
function updateGlobalShortcut() {
    try {
        globalShortcut.unregisterAll();
    } catch { }
    globalShortcut.register(backendShortcut, () => {
        showMainWindow();
    });
}

// Determine if running in portable mode and get appropriate data directory
function getAppDataPath() {
    if (cachedAppDataPath) {
        return cachedAppDataPath;
    }

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        cachedAppDataPath = app.getPath('userData');
        return cachedAppDataPath;
    }

    // Check if running from portable zip (no installation)
    const execDir = path.dirname(process.execPath);
    const portableDataDir = path.join(execDir, 'AppData');

    // If AppData folder exists next to exe, use portable mode
    if (fs.existsSync(portableDataDir)) {
        cachedAppDataPath = portableDataDir;
        return cachedAppDataPath;
    }

    // Create portable data directory if we can write to the exe directory
    try {
        // Test if we can write to the exe directory
        const testFile = path.join(execDir, 'write-test.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);

        // If we can write, create AppData directory for portable mode
        if (!fs.existsSync(portableDataDir)) {
            fs.mkdirSync(portableDataDir, { recursive: true });
            console.log(`[main] Created portable AppData directory: ${portableDataDir}`);
        }
        cachedAppDataPath = portableDataDir;
        return cachedAppDataPath;
    } catch (err) {
        // Can't write to exe directory, use standard user data (for installed version)
        console.log('[main] Cannot write to exe directory, using standard user data path');
        cachedAppDataPath = app.getPath('userData');
        return cachedAppDataPath;
    }
}

// Determine DB path using the portable-aware data path
function getDatabasePath() {
    const dataPath = getAppDataPath();
    return path.join(dataPath, 'clip.db');
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function getThemeConfigPath() {
    return path.join(getAppDataPath(), 'clip-theme.json');
}

function getThemeSchemaPath() {
    return path.join(getAppDataPath(), 'clip-theme.schema.json');
}

function applyWindowSize(width: unknown, height: unknown) {
    windowWidth = clampInt(width, WINDOW_SIZE_LIMITS.width.min, WINDOW_SIZE_LIMITS.width.max, WINDOW_SIZE_LIMITS.width.default);
    windowHeight = clampInt(height, WINDOW_SIZE_LIMITS.height.min, WINDOW_SIZE_LIMITS.height.max, WINDOW_SIZE_LIMITS.height.default);

    if (!mainWindow || mainWindow.isDestroyed()) return;

    const currentBounds = mainWindow.getBounds();
    const target = {
        x: currentBounds.x,
        y: currentBounds.y,
        width: windowWidth,
        height: windowHeight,
    };
    const display = screen.getDisplayMatching(target);
    const workArea = display.workArea;

    const boundedWidth = Math.min(windowWidth, workArea.width);
    const boundedHeight = Math.min(windowHeight, workArea.height);
    const maxX = Math.max(workArea.x, workArea.x + workArea.width - boundedWidth);
    const maxY = Math.max(workArea.y, workArea.y + workArea.height - boundedHeight);
    const clampedX = Math.min(Math.max(target.x, workArea.x), maxX);
    const clampedY = Math.min(Math.max(target.y, workArea.y), maxY);

    mainWindow.setBounds({ x: clampedX, y: clampedY, width: boundedWidth, height: boundedHeight }, false);
}

function writeThemeSchemaFile() {
    try {
        fs.writeFileSync(getThemeSchemaPath(), JSON.stringify(getThemeSchema(), null, 2), 'utf8');
    } catch (error) {
        console.error('[main] Failed to write theme schema file:', error);
    }
}

function readThemeConfigFromFile() {
    const themePath = getThemeConfigPath();
    if (!fs.existsSync(themePath)) return null;

    try {
        const parsed = JSON.parse(fs.readFileSync(themePath, 'utf8'));
        return sanitizeThemeConfig(parsed);
    } catch (error) {
        console.error('[main] Failed to parse theme file; trying DB restore.', error);
        try {
            const backupName = `clip-theme.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            fs.renameSync(themePath, path.join(getAppDataPath(), backupName));
        } catch (renameError) {
            console.error('[main] Failed to quarantine corrupt theme file:', renameError);
        }
        return null;
    }
}

function readThemeConfigFromDb() {
    try {
        const row = db
            .prepare('SELECT value FROM app_state WHERE key = ? LIMIT 1')
            .get('theme_config') as { value?: string } | undefined;

        if (!row?.value) return null;
        const parsed = JSON.parse(row.value);
        return sanitizeThemeConfig(parsed);
    } catch (error) {
        console.error('[main] Failed to parse theme config from DB backup:', error);
        return null;
    }
}

function persistThemeConfig(config: unknown) {
    const sanitized = sanitizeThemeConfig(config);
    activeThemeConfig = sanitized;

    try {
        fs.writeFileSync(getThemeConfigPath(), JSON.stringify(sanitized, null, 2), 'utf8');
    } catch (error) {
        console.error('[main] Failed to persist theme config to file:', error);
    }

    try {
        db.prepare(
            `INSERT INTO app_state (key, value, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(key)
             DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        ).run('theme_config', JSON.stringify(sanitized), Date.now());
    } catch (error) {
        console.error('[main] Failed to persist theme config to DB backup:', error);
    }

    return sanitized;
}

function initializeThemeConfig() {
    writeThemeSchemaFile();

    const fromFile = readThemeConfigFromFile();
    if (fromFile) {
        return persistThemeConfig(fromFile);
    }

    const fromDb = readThemeConfigFromDb();
    if (fromDb) {
        console.log('[main] Restored theme file from DB backup.');
        return persistThemeConfig(fromDb);
    }

    return persistThemeConfig(createDefaultThemeConfig());
}

// Load settings from local storage (for startup behavior)
function loadStartupSettings() {
    try {
        const settingsPath = path.join(getAppDataPath(), 'clip-settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            windowHideBehavior = settings.windowHideBehavior || 'hide';
            showInTaskbar = settings.showInTaskbar || false;
            showNotifications = settings.showNotifications || false;
            backendShortcut = sanitizeShortcut(settings.globalShortcut || SAFE_SHORTCUT_FALLBACK);
            const parsedMaxItems = Number(settings.maxItems);
            if (Number.isFinite(parsedMaxItems)) {
                maxHistoryItems = Math.min(500, Math.max(10, Math.floor(parsedMaxItems)));
            }

            applyWindowSize(settings.windowWidth, settings.windowHeight);
        }
    } catch (error) {
        console.log('[main] Could not load startup settings, using defaults');
    }
}

let Database: any = null;
let db: any;
function initDatabase() {
    if (!Database) {
        Database = require('better-sqlite3');
    }
    const dbPath = getDatabasePath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        content BLOB NOT NULL,
        timestamp INTEGER NOT NULL
    )`);
    const columns = db.prepare("PRAGMA table_info(history)").all();
    const hasPinned = columns.some((col: any) => col.name === 'pinned');
    if (!hasPinned) {
        db.exec('ALTER TABLE history ADD COLUMN pinned INTEGER DEFAULT 0');
    }

    db.exec(`CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )`);

}

// Insert clipboard item into DB
function insertClipboardItem(item: { type: 'text' | 'image'; content: string; timestamp: number; pinned?: boolean }, maxItems: number = maxHistoryItems) {
    const last = db.prepare('SELECT content, type FROM history ORDER BY id DESC LIMIT 1').get() as { content?: string, type?: string } | undefined;
    if (last && last.content === item.content && last.type === item.type) return;
    db.prepare('INSERT INTO history (type, content, timestamp, pinned) VALUES (?, ?, ?, ?)')
        .run(item.type, item.content, item.timestamp, item.pinned ? 1 : 0);
    const countRow = db.prepare('SELECT COUNT(*) as count FROM history').get() as { count: number };
    if (countRow && countRow.count > maxItems) {
        db.prepare('DELETE FROM history WHERE id IN (SELECT id FROM history WHERE pinned = 0 ORDER BY id DESC LIMIT -1 OFFSET ?)').run(maxItems);
    }

    // Invalidate cache when new items are added
    invalidateHistoryCache();
}

// Toggle pinned status for an item
function toggleItemPinned(id: number, pinned: boolean) {
    const result = db.prepare('UPDATE history SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id);
    invalidateHistoryCache();
    return result;
}

// Delete clipboard item by id
function deleteClipboardItem(id: number) {
    db.prepare('DELETE FROM history WHERE id = ?').run(id);
    invalidateHistoryCache();
}

// Get clipboard history from DB (most recent first) with caching
function getClipboardHistory() {
    const now = Date.now();

    // Return cached data if still valid
    if (now - cacheTimestamp < CACHE_DURATION && cachedClipboardHistory.length > 0) {
        console.log('[main] Returning cached clipboard history');
        return cachedClipboardHistory;
    }

    // Fetch fresh data and cache it
    const history = db.prepare('SELECT id, type, content, timestamp, pinned FROM history ORDER BY pinned DESC, id DESC LIMIT ?').all(maxHistoryItems);
    cachedClipboardHistory = history;
    cacheTimestamp = now;
    console.log(`[main] Cached ${history.length} clipboard items`);

    return history;
}

// Async version for non-blocking operations
let lastHistoryLength: number | null = null;

function getClipboardHistoryAsync(): Promise<any[]> {
    return new Promise((resolve) => {
        const now = Date.now();

        // Return cached data if still valid
        if (now - cacheTimestamp < CACHE_DURATION && cachedClipboardHistory.length > 0) {
            // Only log if cache is non-empty or this is the first time
            if (cachedClipboardHistory.length > 0 || cacheTimestamp === 0) {
                console.log('[main] Returning cached clipboard history (async)');
            }
            resolve(cachedClipboardHistory);
            return;
        }

        // If already loading, queue the request
        if (isHistoryLoading) {
            pendingHistoryRequests.push(resolve);
            return;
        }

        isHistoryLoading = true;

        // Use setImmediate to avoid blocking the event loop
        setImmediate(() => {
            try {
                const history = db.prepare('SELECT id, type, content, timestamp, pinned FROM history ORDER BY pinned DESC, id DESC LIMIT ?').all(maxHistoryItems);

                // Only log and update if the length has changed
                if (lastHistoryLength !== history.length) {
                    console.log(`[main] Async cached ${history.length} clipboard items`);
                    lastHistoryLength = history.length;
                }

                cachedClipboardHistory = history;
                cacheTimestamp = Date.now();

                // Resolve current request
                resolve(history);

                // Resolve any pending requests
                pendingHistoryRequests.forEach(callback => callback(history));
                pendingHistoryRequests = [];
            } catch (error) {
                console.error('[main] Error in async clipboard history fetch:', error);
                resolve([]);
                pendingHistoryRequests.forEach(callback => callback([]));
                pendingHistoryRequests = [];
            } finally {
                isHistoryLoading = false;
            }
        });
    });
}

// Invalidate cache when history changes
function invalidateHistoryCache() {
    cachedClipboardHistory = [];
    cacheTimestamp = 0;
}

function ensureTray(mainWindow: BrowserWindow) {
    if (!tray) {
        const distIconPath = path.join(__dirname, '../assets/icon.ico');
        const appIconPath = path.join(app.getAppPath(), 'assets', 'icon.ico');
        const iconPath = fs.existsSync(distIconPath) ? distIconPath : appIconPath;
        tray = new Tray(iconPath);
        // tray = new Tray(''); // No icon provided
        tray.setToolTip('Clip - Clipboard Manager');
        tray.setContextMenu(Menu.buildFromTemplate([
            {
                label: 'Show Clip',
                click: () => showMainWindow(),
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('save-settings-before-quit');
                    }
                    setTimeout(() => {
                        try { globalShortcut.unregisterAll(); } catch { }
                        try { if (tray) { tray.destroy(); tray = null; } } catch { }
                        stopAhk();
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.removeAllListeners();
                            mainWindow.close();
                        }
                        app.quit();
                        setTimeout(() => {
                            try { process.exit(0); } catch { }
                        }, 1000);
                    }, 200);
                }
            },
        ]));
        tray.on('click', () => showMainWindow());
        tray.on('double-click', () => showMainWindow());
    }
}

function removeTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}

function createMainWindow() {
    const windowOptions = {
        width: windowWidth,
        height: windowHeight,
        resizable: false,
        minWidth: WINDOW_SIZE_LIMITS.width.min,
        minHeight: WINDOW_SIZE_LIMITS.height.min,
        transparent: true,
        roundedCorners: false,
        show: false,
        skipTaskbar: !showInTaskbar,
        icon: fs.existsSync(path.join(__dirname, '../assets/icon.ico'))
            ? path.join(__dirname, '../assets/icon.ico')
            : path.join(app.getAppPath(), 'assets', 'icon.ico'),
        backgroundColor: 'rgba(0,0,0,0)',
        titleBarStyle: 'hidden' as const,
        frame: false, // Key setting
        autoHideMenuBar: true,
        title: 'Clip - Clipboard Manager',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
    };
    console.log('[main] Creating main window with options:', JSON.stringify(windowOptions, null, 2)); // Log the options
    mainWindow = new BrowserWindow(windowOptions);

    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(
        process.env.NODE_ENV === 'development'
            ? devServerUrl
            : `file://${path.resolve(__dirname, '../index.html')}`
    );

    mainWindow.on('close', (e) => {
        e.preventDefault(); // Always prevent actual close

        if (windowHideBehavior === 'hide') {
            // Hide mode: Hide window and remove from taskbar (even if showInTaskbar is true)
            if (mainWindow) {
                mainWindow.setSkipTaskbar(true);
                mainWindow.hide();
                removeTray(); // Ensure no tray icon in hide mode
            }
        } else if (windowHideBehavior === 'tray') {
            // Tray mode: Actually close the window and show only tray icon
            if (mainWindow) {
                mainWindow.hide();
                mainWindow.setSkipTaskbar(true);
                ensureTray(mainWindow);
                // In tray mode, we keep the window object but it's hidden
                // The window will be recreated when needed via showMainWindow()
            }
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('show', () => {
        if (mainWindow) {
            mainWindow.setSkipTaskbar(!showInTaskbar);
            // Do NOT send clipboard history immediately - let the animation start first
            // The renderer will request it after a delay
        }
    });

    // Hide window when it loses focus (same behavior as pressing ESC)
    mainWindow.on('blur', () => {
        if (mainWindow && mainWindow.isVisible()) {
            // Don't hide if triggered by AHK (give AHK time to focus)
            if (isAhkTriggered) {
                console.log('[main] Window lost focus but AHK is active, not hiding...');
                return;
            }

            console.log('[main] Window lost focus, hiding...');

            // Restore focus to the previous window before hiding
            restorePreviousWindow();

            if (windowHideBehavior === 'hide') {
                mainWindow.setSkipTaskbar(true);
                mainWindow.hide();
                removeTray();
            } else if (windowHideBehavior === 'tray') {
                mainWindow.hide();
                mainWindow.setSkipTaskbar(true);
                ensureTray(mainWindow);
            }
        }
    });
}

function ensureWindowBoundsVisible(win: BrowserWindow) {
    const desiredWidth = windowWidth;
    const desiredHeight = windowHeight;
    const current = win.getBounds();
    const target = {
        x: current.x,
        y: current.y,
        width: desiredWidth,
        height: desiredHeight,
    };

    const display = screen.getDisplayMatching(target);
    const area = display.workArea;

    const boundedWidth = Math.min(desiredWidth, area.width);
    const boundedHeight = Math.min(desiredHeight, area.height);

    const maxX = Math.max(area.x, area.x + area.width - boundedWidth);
    const maxY = Math.max(area.y, area.y + area.height - boundedHeight);

    const clampedX = Math.min(Math.max(target.x, area.x), maxX);
    const clampedY = Math.min(Math.max(target.y, area.y), maxY);

    win.setBounds({ x: clampedX, y: clampedY, width: boundedWidth, height: boundedHeight }, false);
}

function pollClipboard() {
    // Preload initial clipboard history in cache
    getClipboardHistoryAsync();

    setInterval(() => {
        const text = clipboard.readText();
        const image = clipboard.readImage();
        let imageDataUrl = '';
        if (!image.isEmpty()) {
            // Fast bailout: avoid expensive toDataURL unless image size changed.
            const size = image.getSize();
            const sizeKey = `${size.width}x${size.height}`;
            if (sizeKey !== lastImageSizeKey) {
                imageDataUrl = image.toDataURL();
                lastImageSizeKey = sizeKey;
            } else {
                imageDataUrl = lastImageDataUrl;
            }
        }

        // Track last seen clipboard content to avoid unnecessary DB/cache/log updates
        let shouldUpdate = false;

        // Only insert if text is non-empty and different from last
        if (text && text !== lastText) {
            lastText = text;
            shouldUpdate = true;
            const item = { type: 'text' as const, content: text, timestamp: Date.now() };
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
                new Notification(notification).show();
            }
        } else if (!text) {
            lastText = '';
        }

        // Only insert if image is non-empty and different from last
        if (imageDataUrl && imageDataUrl !== lastImageDataUrl) {
            lastImageDataUrl = imageDataUrl;
            shouldUpdate = true;
            const item = { type: 'image' as const, content: imageDataUrl, timestamp: Date.now() };
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
                new Notification(notification).show();
            }
        } else if (!imageDataUrl) {
            lastImageDataUrl = '';
            lastImageSizeKey = '';
        }

        // If clipboard is empty and last seen was also empty, do nothing (prevents log spam)
        // No need to update DB/cache/logs in this case

    }, 800);
}

// --- BACKUP/RESTORE LOGIC ---
const getBackupDir = () => path.join(getAppDataPath(), 'clip_backups');
let clipEnableBackups = false;
let clipBackupInterval = 15 * 60 * 1000;
let clipMaxBackups = 5;
function ensureBackupDir() {
    const BACKUP_DIR = getBackupDir();
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
function getBackupFiles() {
    const BACKUP_DIR = getBackupDir();
    ensureBackupDir();
    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => {
            // Extract timestamp from filename format: clip-backup-YYYY-MM-DDTHH-MM-SS-SSSZ.db
            const match = f.match(/clip-backup-(.+)\.db$/);
            let time: number;

            if (match) {
                // Convert ISO string back (replace hyphens with colons/periods for time parts)
                const isoString = match[1].replace(/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)/, '$1:$2:$3.$4');
                const parsedDate = new Date(isoString);
                time = parsedDate.getTime();

                // Fallback to file mtime if parsing fails
                if (isNaN(time)) {
                    time = fs.statSync(path.join(getBackupDir(), f)).mtime.getTime();
                }
            } else {
                // Fallback to file mtime for files that don't match expected format
                time = fs.statSync(path.join(getBackupDir(), f)).mtime.getTime();
            }

            return {
                file: f,
                time: time
            };
        })
        .sort((a, b) => b.time - a.time);
}
function createBackup() {
    ensureBackupDir();
    const dbPath = getDatabasePath();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(getBackupDir(), `clip-backup-${ts}.db`);

    try {
        // Force WAL checkpoint to ensure all data is written to main DB file
        if (db) {
            db.pragma('wal_checkpoint(TRUNCATE)');
            console.log('[main] WAL checkpoint completed before backup');
        }

        // Copy the database file
        fs.copyFileSync(dbPath, backupPath);
        console.log(`[main] Database copied to backup: ${backupPath}`);

        // Verify backup was created and has content
        if (fs.existsSync(backupPath)) {
            const backupStats = fs.statSync(backupPath);
            console.log(`[main] Backup created successfully, size: ${backupStats.size} bytes`);

            // Quick verification: try to open the backup and count records
            try {
                const backupDb = new Database(backupPath, { readonly: true });
                const count = backupDb.prepare('SELECT COUNT(*) as count FROM history').get() as { count: number };
                backupDb.close();
                console.log(`[main] Backup verification: ${count.count} items in backup database`);
            } catch (verifyError) {
                console.error('[main] Backup verification failed:', verifyError);
            }
        }

        // Clean up old backups
        const backups = getBackupFiles();
        if (backups.length > clipMaxBackups) {
            backups.slice(clipMaxBackups).forEach(b => fs.unlinkSync(path.join(getBackupDir(), b.file)));
        }

        return backupPath;
    } catch (error) {
        console.error('[main] Error creating backup:', error);
        throw error;
    }
}
function restoreBackup(backupFile: string) {
    const dbPath = getDatabasePath();
    const backupPath = resolveBackupPath(backupFile);

    console.log(`[main] Starting restore from: ${backupPath}`);

    // Verify backup file exists and has content
    if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
    }

    const backupStats = fs.statSync(backupPath);
    console.log(`[main] Backup file size: ${backupStats.size} bytes`);

    if (backupStats.size === 0) {
        throw new Error('Backup file is empty');
    }

    // Close the current database connection
    if (db) {
        console.log('[main] Closing current database connection');
        db.close();
    }

    // Copy the backup file to replace the current database
    console.log(`[main] Copying backup to: ${dbPath}`);
    fs.copyFileSync(backupPath, dbPath);

    // Verify the copied file
    const restoredStats = fs.statSync(dbPath);
    console.log(`[main] Restored database size: ${restoredStats.size} bytes`);

    // Reinitialize the database connection with the restored data
    console.log('[main] Reinitializing database connection');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Ensure the restored database has the correct schema
    db.exec(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        content BLOB NOT NULL,
        timestamp INTEGER NOT NULL
    )`);
    const columns = db.prepare("PRAGMA table_info(history)").all();
    const hasPinned = columns.some((col: any) => col.name === 'pinned');
    if (!hasPinned) {
        db.exec('ALTER TABLE history ADD COLUMN pinned INTEGER DEFAULT 0');
    }

    db.exec(`CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )`);

    // Verify the restore worked by counting records
    const count = db.prepare('SELECT COUNT(*) as count FROM history').get() as { count: number };
    console.log(`[main] Restored database contains ${count.count} items`);

    console.log('[main] Database connection reinitialized after restore');
}

function resolveBackupPath(file: string): string {
    const safeName = path.basename(String(file));
    if (safeName !== file || !/^clip-backup-[A-Za-z0-9_.-]+\.db$/.test(safeName)) {
        throw new Error('Invalid backup filename');
    }
    return path.join(getBackupDir(), safeName);
}

ipcMain.handle('create-backup', () => {
    return createBackup();
});
ipcMain.handle('list-backups', () => {
    return getBackupFiles();
});
ipcMain.handle('restore-backup', async (event, file) => {
    try {
        resolveBackupPath(file);
        restoreBackup(file);

        // Small delay to ensure database operations are complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send updated clipboard history to renderer after successful restore
        if (mainWindow && !mainWindow.isDestroyed()) {
            const updatedHistory = getClipboardHistory();
            console.log(`[main] Sending ${updatedHistory.length} items after restore`);
            mainWindow.webContents.send('clipboard-history', updatedHistory);
            console.log('[main] Sent updated clipboard history after restore');
        }

        return true;
    } catch (error) {
        console.error('[main] Error during backup restore:', error);
        return false;
    }
});
ipcMain.handle('delete-backup', (event, file) => {
    try {
        const backupPath = resolveBackupPath(file);
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            console.log(`[main] Deleted backup: ${file}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`[main] Error deleting backup ${file}:`, error);
        return false;
    }
});
ipcMain.handle('delete-multiple-backups', (event, files) => {
    try {
        let deletedCount = 0;
        for (const file of files) {
            const backupPath = resolveBackupPath(file);
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
                deletedCount++;
            }
        }
        console.log(`[main] Deleted ${deletedCount} backups`);
        return deletedCount;
    } catch (error) {
        console.error('[main] Error deleting multiple backups:', error);
        return 0;
    }
});
ipcMain.handle('export-db', () => {
    const dbPath = getDatabasePath();
    return fs.readFileSync(dbPath);
});
ipcMain.handle('import-db', async (event, buffer) => {
    try {
        const dbPath = getDatabasePath();

        // Close the current database connection
        if (db) {
            db.close();
        }

        // Write the imported database file
        fs.writeFileSync(dbPath, Buffer.from(buffer));

        // Reinitialize the database connection with the imported data
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');

        // Ensure the imported database has the correct schema
        db.exec(`CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            content BLOB NOT NULL,
            timestamp INTEGER NOT NULL
        )`);
        const columns = db.prepare("PRAGMA table_info(history)").all();
        const hasPinned = columns.some((col: any) => col.name === 'pinned');
        if (!hasPinned) {
            db.exec('ALTER TABLE history ADD COLUMN pinned INTEGER DEFAULT 0');
        }

        db.exec(`CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )`);

        // Small delay to ensure database operations are complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send updated clipboard history to renderer after successful import
        if (mainWindow && !mainWindow.isDestroyed()) {
            const updatedHistory = getClipboardHistory();
            console.log(`[main] Sending ${updatedHistory.length} items after import`);
            mainWindow.webContents.send('clipboard-history', updatedHistory);
            console.log('[main] Sent updated clipboard history after import');
        }

        console.log('[main] Database connection reinitialized after import');
        return true;
    } catch (error) {
        console.error('[main] Error during database import:', error);
        return false;
    }
});
ipcMain.on('set-backup-settings', (_event, { enableBackups, backupInterval, maxBackups }) => {
    clipEnableBackups = enableBackups;
    clipBackupInterval = backupInterval;
    clipMaxBackups = maxBackups;
    setupAutoBackup();
});
let backupTimer: NodeJS.Timeout | null = null;
function setupAutoBackup() {
    if (backupTimer) clearInterval(backupTimer);
    if (clipEnableBackups) {
        backupTimer = setInterval(() => {
            createBackup();
        }, clipBackupInterval || 15 * 60 * 1000);
    }
}
setupAutoBackup();

// Flag to temporarily disable blur hiding when triggered by AHK
let isAhkTriggered = false;

let wmClipShowHookedForWindowId: number | null = null;

// Native Windows message handler for AHK trigger
function registerNativeMessageHandler() {
    if (process.platform !== 'win32' || !mainWindow) return;

    // Important: use Electron's built-in hookWindowMessage (no native addon).
    // This lets AHK trigger the *same* show path as tray click, ensuring the
    // renderer receives 'window-will-show' and the window isn't invisible.
    if (wmClipShowHookedForWindowId === mainWindow.id) return;

    try {
        mainWindow.hookWindowMessage(WM_CLIP_SHOW, () => {
            // Run on next tick to avoid re-entrancy surprises.
            setImmediate(() => {
                try {
                    showMainWindow();
                } catch (e) {
                    console.error('[main] Error handling WM_CLIP_SHOW:', e);
                }
            });
        });

        wmClipShowHookedForWindowId = mainWindow.id;
        console.log('[main] Hooked WM_CLIP_SHOW via hookWindowMessage');
    } catch (e) {
        console.error('[main] Failed to hook WM_CLIP_SHOW:', e);
    }
}


function savePreviousHwnd() {
    // Disabled intentionally: native focus tracking via clipmsg.node causes
    // async hook corruption in Electron on some environments.
    lastForegroundHwnd = null;
}

function restorePreviousWindow() {
    // Disabled intentionally: native focus restore path relies on clipmsg.node.
}

function showMainWindow() {
    // Save the previous foreground window HWND before showing
    savePreviousHwnd();

    // Recreate window if it doesn't exist or is destroyed
    let windowWasRecreated = false;
    if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
        windowWasRecreated = true;
    }
    if (!mainWindow) return;

    ensureWindowBoundsVisible(mainWindow);
    mainWindow.webContents.send('window-will-show');

    // Show and focus the window immediately for smoother animation
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.show();
    mainWindow.webContents.invalidate();
    app.focus({ steal: true });
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);

    // Configure taskbar behavior (non-blocking)
    setImmediate(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setSkipTaskbar(!showInTaskbar);
        }
    });

    // Handle tray behavior (non-blocking)
    setImmediate(() => {
        if (windowHideBehavior === 'tray') {
            ensureTray(mainWindow!);
        } else {
            removeTray();
        }
    });

    // Re-register native message handler if window was recreated (deferred)
    if (windowWasRecreated) {
        setTimeout(() => {
            registerNativeMessageHandler();
        }, 150);
    }

    // Send refresh after a minimal delay to allow animation to start
    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('force-refresh');
        }
    }, 50);
}

// Add single instance lock at the top of app.whenReady()
app.whenReady().then(() => {
    // Ensure single instance
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
        // Another instance is already running, quit this one
        app.quit();
        return;
    }

    // When a second instance is attempted, focus the existing window
    app.on('second-instance', () => {
        if (mainWindow) {
            showMainWindow();
        }
    });

    // Load settings first to determine startup behavior
    loadStartupSettings();

    initDatabase();
    initializeThemeConfig();
    createMainWindow();

    // Handle startup behavior based on command line arguments and settings
    const isStartHidden = process.argv.includes('--start-hidden') || process.argv.includes('--hidden');

    if (!isStartHidden) {
        // Normal startup - show the window
        showMainWindow();
    } else {
        // Started with system - handle based on window hide behavior
        if (windowHideBehavior === 'tray') {
            // For tray mode, ensure tray is created but don't show window
            if (mainWindow) {
                ensureTray(mainWindow);
                mainWindow.hide();
                mainWindow.setSkipTaskbar(true);
            }
        } else {
            // For hide mode, just keep window hidden and ready for shortcut
            if (mainWindow) {
                mainWindow.hide();
                mainWindow.setSkipTaskbar(true);
                removeTray(); // Ensure no tray in hide mode
            }
        }
    }

    pollClipboard();
    updateGlobalShortcut();
    registerNativeMessageHandler();
    handleShortcutChange(backendShortcut).catch(err => {
        console.error('[main] Error handling initial shortcut setup:', err);
    });

    ipcMain.on('paste-clipboard-item', (_event, item) => {
        if (item.type === 'text') {
            clipboard.writeText(item.content);
        } else if (item.type === 'image') {
            const image = nativeImage.createFromDataURL(item.content);
            clipboard.writeImage(image);
        }

        // Keep native fast paste, but let SendPaste resolve current focus itself.
        const hwndArg = '';
        const sendPastePath = path.join(app.getAppPath(), 'native', 'SendPaste.exe');
        execFile(sendPastePath, [hwndArg], (err: any, stdout: string, stderr: string) => {
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

        // Hide window instead of minimize to fix fully transparent bug
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.blur();
            if (windowHideBehavior === 'hide') {
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.setSkipTaskbar(true);
                        mainWindow.hide();
                        removeTray();
                    }
                }, 100);
            } else if (windowHideBehavior === 'tray') {
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

    ipcMain.on('set-window-hide-behavior', (_event, behavior) => {
        windowHideBehavior = behavior;
        if (windowHideBehavior === 'tray' && mainWindow) {
            ensureTray(mainWindow);
        } else {
            removeTray();
        }
    });
    ipcMain.on('set-show-in-taskbar', (_event, show) => {
        showInTaskbar = !!show;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setSkipTaskbar(!showInTaskbar);
        }
    });

    ipcMain.on('drag-window', (_event, { cursorX, cursorY, offsetX, offsetY }) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (!Number.isFinite(cursorX) || !Number.isFinite(cursorY)) return;

        const bounds = mainWindow.getBounds();
        const safeOffsetX = Number.isFinite(offsetX) ? Number(offsetX) : Math.floor(bounds.width / 2);
        const safeOffsetY = Number.isFinite(offsetY) ? Number(offsetY) : 18;
        const target = {
            x: Math.round(Number(cursorX) - safeOffsetX),
            y: Math.round(Number(cursorY) - safeOffsetY),
            width: bounds.width,
            height: bounds.height,
        };
        const display = screen.getDisplayMatching(target);
        const area = display.workArea;
        const maxX = Math.max(area.x, area.x + area.width - target.width);
        const maxY = Math.max(area.y, area.y + area.height - target.height);
        const clampedX = Math.min(Math.max(target.x, area.x), maxX);
        const clampedY = Math.min(Math.max(target.y, area.y), maxY);
        mainWindow.setBounds({ ...target, x: clampedX, y: clampedY }, false);
    });

    ipcMain.handle('get-theme-config', () => {
        return activeThemeConfig;
    });

    ipcMain.handle('get-theme-schema', () => {
        return getThemeSchema();
    });

    ipcMain.handle('save-theme-config', (_event, config) => {
        const next = persistThemeConfig(config);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('theme-config-updated', next);
        }
        return next;
    });

    ipcMain.handle('reload-theme-config', () => {
        const fromFile = readThemeConfigFromFile();
        const restored = fromFile || readThemeConfigFromDb() || createDefaultThemeConfig();
        const next = persistThemeConfig(restored);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('theme-config-updated', next);
        }
        return next;
    });

    ipcMain.handle('export-theme-config', () => {
        return JSON.stringify(activeThemeConfig, null, 2);
    });

    ipcMain.handle('create-theme-profile', (_event, profileName) => {
        const cleanName = String(profileName || '').trim();
        if (!cleanName) {
            throw new Error('Profile name is required');
        }

        const keyBase = normalizeThemeProfileKey(cleanName);
        let key = keyBase;
        let index = 2;
        while (activeThemeConfig.profiles[key]) {
            key = `${keyBase}-${index}`;
            index += 1;
        }

        const source = activeThemeConfig.profiles[activeThemeConfig.activeProfile] || createDefaultThemeConfig().profiles.default;
        const next = {
            ...activeThemeConfig,
            activeProfile: key,
            profiles: {
                ...activeThemeConfig.profiles,
                [key]: {
                    ...JSON.parse(JSON.stringify(source)),
                    name: cleanName,
                },
            },
        };

        const saved = persistThemeConfig(next);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('theme-config-updated', saved);
        }
        return saved;
    });

    ipcMain.handle('delete-theme-profile', (_event, profileKey) => {
        const key = normalizeThemeProfileKey(String(profileKey || ''));
        const existingKeys = Object.keys(activeThemeConfig.profiles);
        if (!activeThemeConfig.profiles[key]) {
            return activeThemeConfig;
        }
        if (existingKeys.length <= 1) {
            throw new Error('At least one profile must remain');
        }

        const { [key]: _removed, ...rest } = activeThemeConfig.profiles;
        const fallbackKey = rest[activeThemeConfig.activeProfile] ? activeThemeConfig.activeProfile : Object.keys(rest)[0];
        const next = {
            ...activeThemeConfig,
            activeProfile: fallbackKey,
            profiles: rest,
        };

        const saved = persistThemeConfig(next);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('theme-config-updated', saved);
        }
        return saved;
    });

    ipcMain.handle('set-active-theme-profile', (_event, profileKey) => {
        const key = normalizeThemeProfileKey(String(profileKey || ''));
        if (!activeThemeConfig.profiles[key]) {
            throw new Error('Profile not found');
        }

        const next = {
            ...activeThemeConfig,
            activeProfile: key,
        };

        const saved = persistThemeConfig(next);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('theme-config-updated', saved);
        }
        return saved;
    });
    ipcMain.on('set-notifications', (_event, enabled) => {
        showNotifications = enabled;
    });

    ipcMain.on('set-start-with-system', (_event, enabled) => {
        app.setLoginItemSettings({
            openAtLogin: enabled,
            openAsHidden: true,
            args: enabled ? ['--start-hidden'] : []
        });
    });

    ipcMain.on('hide-window', () => {
        if (mainWindow && mainWindow.isVisible()) {
            console.log('[main] Hide window requested, restoring previous window...');

            // Restore focus to the previous window before hiding
            restorePreviousWindow();

            if (windowHideBehavior === 'hide') {
                mainWindow.setSkipTaskbar(true);
                mainWindow.hide();
                removeTray();
            } else if (windowHideBehavior === 'tray') {
                mainWindow.hide();
                mainWindow.setSkipTaskbar(true);
                ensureTray(mainWindow);
            }
        }
    });

    ipcMain.on('restore-previous-window', () => {
        console.log('[main] Restore previous window requested from renderer...');
        restorePreviousWindow();
    });

    // Optimized clipboard history request with async caching
    ipcMain.on('request-clipboard-history', (event) => {
        // Use async version to avoid blocking
        getClipboardHistoryAsync().then(history => {
            event.reply('clipboard-history', history);
        });
    });

    // Alternative handle-based version for even better performance
    ipcMain.handle('get-clipboard-history-async', async () => {
        return await getClipboardHistoryAsync();
    });

    ipcMain.on('clear-clipboard-history', (event) => {
        db.prepare('DELETE FROM history').run();
        clipboard.clear();
        lastText = '';
        lastImageDataUrl = '';
        invalidateHistoryCache();
        event.reply('clipboard-history', getClipboardHistory());
    });

    ipcMain.on('toggle-item-pinned', (event, { id, pinned }) => {
        toggleItemPinned(id, pinned);
        // Use async to avoid blocking
        getClipboardHistoryAsync().then(history => {
            event.reply('clipboard-history', history);
        });
    });

    ipcMain.on('delete-clipboard-item', (event, id) => {
        const row = db.prepare('SELECT type, content FROM history WHERE id = ?').get(id) as { type: string; content: string } | undefined;
        deleteClipboardItem(id);
        if (row) {
            if (row.type === 'text') {
                try {
                    if (clipboard.readText() === row.content) {
                        clipboard.clear();
                        lastText = '';
                    }
                } catch { }
            } else if (row.type === 'image') {
                try {
                    const img = clipboard.readImage();
                    if (!img.isEmpty() && img.toDataURL() === row.content) {
                        clipboard.clear();
                        lastImageDataUrl = '';
                    }
                } catch { }
            }
        }
        // Use async to avoid blocking
        getClipboardHistoryAsync().then(history => {
            event.reply('clipboard-history', history);
        });
    });

    ipcMain.handle('trim-clipboard-items', async (event, maxItems) => {
        try {
            console.log(`[main] Trimming clipboard to ${maxItems} items`);

            // Get current count
            const countRow = db.prepare('SELECT COUNT(*) as count FROM history').get() as { count: number };
            const currentCount = countRow.count;

            if (currentCount <= maxItems) {
                console.log(`[main] No trimming needed, current count ${currentCount} <= ${maxItems}`);
                return true;
            }

            // Delete oldest items (excluding pinned items) to reach the limit
            const deleteCount = currentCount - maxItems;
            console.log(`[main] Will delete ${deleteCount} oldest items`);

            // Delete the oldest unpinned items
            const result = db.prepare(`
                DELETE FROM history
                WHERE id IN (
                    SELECT id FROM history
                    WHERE pinned = 0
                    ORDER BY id ASC
                    LIMIT ?
                )
            `).run(deleteCount);

            console.log(`[main] Deleted ${result.changes} items from database`);

            // Send updated clipboard history to renderer (async)
            if (mainWindow && !mainWindow.isDestroyed()) {
                getClipboardHistoryAsync().then(updatedHistory => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('clipboard-history', updatedHistory);
                        console.log('[main] Sent updated clipboard history after trim');
                    }
                });
            }

            return true;
        } catch (error) {
            console.error('[main] Error trimming clipboard items:', error);
            return false;
        }
    });

    ipcMain.on('set-global-shortcut', (_event, shortcut) => {
        handleShortcutChange(sanitizeShortcut(shortcut)).catch(err => {
            console.error('[main] Error handling shortcut change:', err);
        });
    });

    ipcMain.on('set-win-v-override', (_event, enabled) => {
        winVOverrideEnabled = !!enabled;
        updateGlobalShortcut();
    });
    ipcMain.on('set-backend-shortcut', (_event, shortcut) => {
        backendShortcut = sanitizeShortcut(shortcut);
        updateGlobalShortcut();
    });

    ipcMain.on('quit-app', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('save-settings-before-quit');
        }
        setTimeout(() => {
            try { globalShortcut.unregisterAll(); } catch { }
            try { if (tray) { tray.destroy(); tray = null; } } catch { }
            stopAhk();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.removeAllListeners();
                mainWindow.close();
            }
            app.quit();
        }, 200);
    });

    ipcMain.on('restart-app', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('save-settings-before-quit');
        }
        setTimeout(() => {
            try { globalShortcut.unregisterAll(); } catch { }
            try { if (tray) { tray.destroy(); tray = null; } } catch { }
            stopAhk();
            // No need to close the main window explicitly, app.relaunch will handle it.
            app.relaunch();
            app.exit(0); // Exit cleanly
        }, 200); // Same delay as quit-app for consistency
    });

    ipcMain.on('save-settings-to-file', (_event, settings) => {
        try {
            if (settings && Number.isFinite(Number(settings.maxItems))) {
                maxHistoryItems = Math.min(500, Math.max(10, Math.floor(Number(settings.maxItems))));
                invalidateHistoryCache();
            }
            applyWindowSize(settings?.windowWidth, settings?.windowHeight);
            const settingsPath = path.join(getAppDataPath(), 'clip-settings.json');
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        } catch (error) {
            console.error('[main] Failed to save settings to file:', error);
        }
    });
});

app.on('window-all-closed', () => {
});

app.on('activate', () => {
    if (!mainWindow) createMainWindow();
});

app.on('before-quit', () => {
    stopAhk(); // Ensure AHK process is terminated when quitting the app
});
