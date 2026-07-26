import { app, BrowserWindow, globalShortcut, clipboard, nativeImage, ipcMain, Tray, Menu, Notification, screen, shell, safeStorage } from 'electron';
import * as path from 'path';
import fs from 'fs';
import os from 'os';
import { pathToFileURL } from 'url';
import { execFile, spawn, ChildProcess, exec } from 'child_process';
import {
    WINDOW_SIZE_LIMITS,
    createDefaultThemeConfig,
    getThemeSchema,
    normalizeThemeProfileKey,
    sanitizeThemeConfig,
} from './theme-config';
import { initTokenStore } from './cloud/tokenStore';
import * as cloudAuth from './cloud/auth';
import * as cloudSync from './cloud/sync';

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
    // Use a stable app id so Windows groups the taskbar button under Clip and
    // uses the window's icon. With process.execPath here, dev runs grouped
    // under electron.exe and showed the default Electron taskbar icon.
    app.setAppUserModelId('com.sukarth.clip');
    app.setName('Clip');
}

const MAX_HISTORY = 100;
let mainWindow: BrowserWindow | null = null;
let lastText = '';
let lastImageDataUrl = '';
// Raw bitmap of the last polled clipboard image, used to skip re-encoding an
// unchanged image to a data URL on every poll tick (see pollClipboard).
let lastImageBitmap: Buffer | null = null;
let tray: Tray | null = null;
let windowHideBehavior: 'hide' | 'tray' = 'hide';
let showInTaskbar: boolean = false;
let showNotifications: boolean = false;
let storeImagesInClipboard: boolean = true;
let maxHistoryItems: number = MAX_HISTORY;
let windowWidth: number = WINDOW_SIZE_LIMITS.width.default;
let windowHeight: number = WINDOW_SIZE_LIMITS.height.default;
let cachedAppDataPath: string | null = null;
let activeThemeConfig = createDefaultThemeConfig();
let suppressBlurHideUntil = 0;

// --- PERFORMANCE OPTIMIZATIONS: Data Caching ---
let cachedClipboardHistory: any[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 3000; // 3 seconds cache
let isHistoryLoading = false;
let pendingHistoryRequests: Array<(data: any[]) => void> = [];
let clipboardPollTimer: NodeJS.Timeout | null = null;
type ClipboardHistoryItem = {
    id: string;
    type: 'text' | 'image';
    content: string;
    timestamp: number;
    pinned?: boolean;
    isTemporary?: boolean;
};
let temporaryClipboardItem: ClipboardHistoryItem | null = null;

// --- Win+V override state ---
// NOTE: This flag is not currently wired up — nothing reads it (updateGlobalShortcut
// ignores it) and the renderer has no UI bound to `set-win-v-override`. Implementing
// a real Win+V override (intercepting the OS clipboard shortcut) is a deliberate
// follow-up; the flag is retained so that work has a home.
let winVOverrideEnabled = false;
let backendShortcut = 'Control+Shift+V';
const SAFE_SHORTCUT_FALLBACK = 'Control+Shift+V';

// --- AHK process management ---
let ahkProcess: ChildProcess | null = null;
let currentAhkShortcut = '';
let lastAhkScriptPath: string | null = null;
let ahkProcessPid: number | null = null;
let isAhkShuttingDown = false;
let pendingAhkStartTimer: NodeJS.Timeout | null = null;

function getAppIconPath(): string {
    if (app.isPackaged) {
        const resourceIconPath = path.join(process.resourcesPath, 'icon.ico');

        if (fs.existsSync(resourceIconPath)) {
            return resourceIconPath;
        }
    }

    return path.join(app.getAppPath(), 'assets', 'icon.ico');
}

function getAppIconImage() {
    try {
        const image = nativeImage.createFromPath(getAppIconPath());
        return image;
    } catch (e) {
        console.error('Failed to load icon:', e);
        return nativeImage.createEmpty();
    }
}

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

// Strict accelerator validation. Previously any non-empty string was accepted
// verbatim, so a typo like "Conreereretrol+Shift+V" silently became "Shift+V"
// downstream (unknown tokens dropped), and pure garbage could register an
// unusable hotkey and leave the app unopenable. Now: every token must be a
// known modifier or exactly one known main key, else the WHOLE accelerator is
// rejected and the default is used instead.
const SHORTCUT_MODIFIERS: Record<string, string> = {
    control: 'Control', ctrl: 'Control',
    commandorcontrol: 'CommandOrControl', cmdorctrl: 'CommandOrControl',
    alt: 'Alt', altgr: 'AltGr', option: 'Alt', shift: 'Shift',
    super: 'Super', meta: 'Super', command: 'Super', cmd: 'Super',
    win: 'Win', windows: 'Windows',
};
const SHORTCUT_NAMED_KEYS: Record<string, string> = {
    space: 'Space', tab: 'Tab', backspace: 'Backspace',
    delete: 'Delete', del: 'Delete', insert: 'Insert',
    return: 'Return', enter: 'Enter', escape: 'Escape', esc: 'Esc',
    up: 'Up', down: 'Down', left: 'Left', right: 'Right',
    home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
    plus: 'Plus',
};

/** Returns the canonical accelerator string, or null if anything is invalid. */
function validateAccelerator(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const tokens = raw.split('+').map((t) => t.trim()).filter(Boolean);
    if (tokens.length < 2 || tokens.length > 5) return null;

    const mods: string[] = [];
    let mainKey: string | null = null;
    for (const token of tokens) {
        const lower = token.toLowerCase();
        const mod = SHORTCUT_MODIFIERS[lower];
        if (mod) {
            if (!mods.includes(mod)) mods.push(mod);
            continue;
        }
        if (mainKey) return null; // more than one main key
        if (/^[a-z0-9]$/i.test(token)) { mainKey = token.toUpperCase(); continue; }
        if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(token)) { mainKey = token.toUpperCase(); continue; }
        const named = SHORTCUT_NAMED_KEYS[lower];
        if (named) { mainKey = named; continue; }
        if (token.length === 1 && /^[`~!@#$%^&*()\-_=[\]{};':",./<>?\\|]$/.test(token)) { mainKey = token; continue; }
        return null; // unknown token invalidates the whole accelerator
    }
    if (!mainKey || mods.length === 0) return null;
    return [...mods, mainKey].join('+');
}

function sanitizeShortcut(shortcut: string) {
    return validateAccelerator(shortcut) ?? SAFE_SHORTCUT_FALLBACK;
}

function setTemporaryClipboardItem(item: ClipboardHistoryItem | null) {
    const nextItem = item ? { ...item, isTemporary: true } : null;
    const changed =
        temporaryClipboardItem?.id !== nextItem?.id ||
        temporaryClipboardItem?.type !== nextItem?.type ||
        temporaryClipboardItem?.content !== nextItem?.content ||
        temporaryClipboardItem?.timestamp !== nextItem?.timestamp ||
        !!temporaryClipboardItem !== !!nextItem;

    if (!changed) {
        return;
    }

    temporaryClipboardItem = nextItem;
    invalidateHistoryCache();
}

function ahkShortcutString(shortcut: string): string | null {
    const toAhkMainKey = (mainKey: string) => {
        const key = mainKey.trim();
        const lower = key.toLowerCase();

        if (/^[a-z]$/i.test(key)) return key.toLowerCase();
        if (/^[0-9]$/.test(key)) return key;

        switch (lower) {
            case 'escape':
            case 'esc':
                return 'Esc';
            case 'space':
                return 'Space';
            case 'tab':
                return 'Tab';
            case 'insert':
                return 'Insert';
            case 'delete':
                return 'Delete';
            case 'home':
                return 'Home';
            case 'end':
                return 'End';
            case 'pageup':
                return 'PgUp';
            case 'pagedown':
                return 'PgDn';
            case 'arrowup':
                return 'Up';
            case 'arrowdown':
                return 'Down';
            case 'arrowleft':
                return 'Left';
            case 'arrowright':
                return 'Right';
            default:
                return key;
        }
    };

    const tokens = shortcut
        .split('+')
        .map((t) => t.trim())
        .filter(Boolean);

    if (tokens.length === 0) {
        return null;
    }

    const mainKeyToken = tokens[tokens.length - 1] ?? '';
    if (!mainKeyToken) {
        return null;
    }

    const modifierTokens = tokens.slice(0, -1);

    const modifierSymbols: string[] = [];
    for (const token of modifierTokens) {
        const lower = token.toLowerCase();
        if (lower === 'control' || lower === 'ctrl') {
            modifierSymbols.push('^');
        } else if (lower === 'shift') {
            modifierSymbols.push('+');
        } else if (lower === 'alt') {
            modifierSymbols.push('!');
        } else if (lower === 'win' || lower === 'windows' || lower === 'super' || lower === 'meta') {
            modifierSymbols.push('#');
        }
    }

    const mainKey = toAhkMainKey(mainKeyToken);
    if (!mainKey) {
        return null;
    }

    return modifierSymbols.join('') + mainKey;
}

function generateAhkScript(shortcut: string): string | null {
    const ahkHotkey = ahkShortcutString(shortcut);
    if (!ahkHotkey) {
        return null;
    }

    return `#NoTrayIcon
#SingleInstance Force

${ahkHotkey}:: {
    ; Always route through WM_CLIP_SHOW so the app runs its normal show logic.
    ; (WinActivate alone can focus a transparent window without making the UI visible.)
    DetectHiddenWindows(true)
    target := WinExist("A")
    hwnd := WinExist("Clip - Clipboard Manager")
    if (hwnd) {
        PostMessage(0x8001, target, 0, , "ahk_id " . hwnd)
        Sleep(30)
        WinActivate("ahk_id " . hwnd)
        WinWaitActive("ahk_id " . hwnd, , 2)
    }
}
`;
}

function composeClipboardHistory(history: ClipboardHistoryItem[]) {
    return temporaryClipboardItem ? [temporaryClipboardItem, ...history] : history;
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

                // Only kill processes using our script path that are NOT our current process.
                // Validate the PID is purely numeric before use — the wmic CSV columns can
                // shift, and interpolating an unvalidated value into a shell command would be
                // a command-injection risk. Use execFile (no shell) with an argv array too.
                if (cmd.includes(lastAhkScriptPath!) && pid && /^[0-9]+$/.test(pid) && parseInt(pid) !== ahkProcessPid) {
                    processesToKill++;
                    execFile('taskkill', ['/PID', pid, '/F'], (killErr) => {
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
        // Wait a bit for cleanup. Track the timer so a newer shortcut change
        // can cancel this pending start (prevents stale AHK launches).
        if (pendingAhkStartTimer) {
            clearTimeout(pendingAhkStartTimer);
            pendingAhkStartTimer = null;
        }
        pendingAhkStartTimer = setTimeout(() => {
            pendingAhkStartTimer = null;
            // Only start if this shortcut is still the one we want.
            if (currentAhkShortcut === shortcut && !isAhkShuttingDown) {
                startAhkProcess(shortcut);
            }
        }, 200);
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
        const script = generateAhkScript(shortcut);
        if (!script) {
            console.error(`[main] Invalid shortcut for AHK script generation: ${shortcut}`);
            return;
        }

        fs.writeFileSync(tempScriptPath, script, 'utf8');
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
    if (pendingAhkStartTimer) {
        clearTimeout(pendingAhkStartTimer);
        pendingAhkStartTimer = null;
    }

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

// Serialize shortcut changes so rapid UI updates don't race.
// Only the latest shortcut in the queue actually takes effect.
let shortcutChangeChain: Promise<void> = Promise.resolve();

function handleShortcutChangeQueued(shortcut: string) {
    shortcutChangeChain = shortcutChangeChain.then(() => handleShortcutChange(shortcut));
}

// Surface a hotkey-registration failure to the user. A hotkey silently failing
// to register (because another app owns it) leaves Clip with no way to open, so
// we always notify here regardless of the general notification preference.
function notifyShortcutRegistrationFailed(shortcut: string) {
    logError(`Global shortcut registration failed: ${shortcut}`);
    try {
        new Notification({
            title: 'Clip - Shortcut unavailable',
            body: `The shortcut "${shortcut}" is already in use by another app. Pick a different one in Settings.`,
        }).show();
    } catch { }
}

// Helper to (re)register global shortcut
function updateGlobalShortcut() {
    try {
        globalShortcut.unregisterAll();
    } catch { }
    try {
        const registered = globalShortcut.register(backendShortcut, () => {
            showMainWindow();
        });
        // register() returns false when the accelerator is already taken by
        // another application; it doesn't throw in that case.
        if (!registered) {
            console.error(`[main] Failed to register global shortcut "${backendShortcut}" (already in use)`);
            notifyShortcutRegistrationFailed(backendShortcut);
        }
    } catch (error) {
        console.error(`[main] Error registering global shortcut "${backendShortcut}":`, error);
        notifyShortcutRegistrationFailed(backendShortcut);
    }
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

function getSettingsPath() {
    return path.join(getAppDataPath(), 'clip-settings.json');
}

function getSettingsSchemaPath() {
    return path.join(getAppDataPath(), 'clip-settings.schema.json');
}

function getThemeSchemaUri() {
    return pathToFileURL(getThemeSchemaPath()).href;
}

function getSettingsSchemaUri() {
    return pathToFileURL(getSettingsSchemaPath()).href;
}

function serializeThemeConfigForFile(config: unknown) {
    return {
        $schema: getThemeSchemaUri(),
        ...sanitizeThemeConfig(config),
    };
}

function createDefaultSettingsDocument() {
    return {
        maxItems: MAX_HISTORY,
        windowHideBehavior: 'hide',
        showInTaskbar: false,
        enableBackups: false,
        backupInterval: 900000,
        maxBackups: 5,
        borderRadius: 18,
        transparency: 0.95,
        accentColor: '#4682b4',
        theme: 'dark',
        showNotifications: false,
        startWithSystem: true,
        storeImagesInClipboard: true,
        pinFavoriteItems: true,
        deleteConfirm: true,
        globalShortcut: 'Control+Shift+V',
        windowWidth: WINDOW_SIZE_LIMITS.width.default,
        windowHeight: WINDOW_SIZE_LIMITS.height.default,
    };
}

function getSettingsSchema() {
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'https://clip.local/schemas/clip-settings.schema.json',
        title: 'Clip settings',
        description: 'General application settings for Clip.',
        type: 'object',
        additionalProperties: false,
        required: [
            'maxItems',
            'windowHideBehavior',
            'showInTaskbar',
            'enableBackups',
            'backupInterval',
            'maxBackups',
            'borderRadius',
            'transparency',
            'accentColor',
            'theme',
            'showNotifications',
            'startWithSystem',
            'storeImagesInClipboard',
            'pinFavoriteItems',
            'deleteConfirm',
            'globalShortcut',
            'windowWidth',
            'windowHeight',
        ],
        properties: {
            $schema: {
                type: 'string',
                description: 'Schema location used by IDEs for IntelliSense.',
            },
            maxItems: {
                type: 'integer',
                minimum: 10,
                maximum: 500,
                description: 'Maximum number of clipboard history items to keep.',
                default: MAX_HISTORY,
            },
            windowHideBehavior: {
                type: 'string',
                enum: ['hide', 'tray'],
                description: 'How the window hides when closed.',
                default: 'hide',
            },
            showInTaskbar: {
                type: 'boolean',
                description: 'Keep the app visible in the taskbar.',
                default: false,
            },
            enableBackups: {
                type: 'boolean',
                description: 'Enable periodic backups of app data.',
                default: false,
            },
            backupInterval: {
                type: 'integer',
                minimum: 60000,
                maximum: 86400000,
                description: 'Backup interval in milliseconds.',
                default: 900000,
            },
            maxBackups: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                description: 'Maximum number of backup files to keep.',
                default: 5,
            },
            borderRadius: {
                type: 'integer',
                minimum: 0,
                maximum: 40,
                description: 'Window corner radius.',
                default: 18,
            },
            transparency: {
                type: 'number',
                minimum: 0.35,
                maximum: 1,
                description: 'Window transparency value. 1 is fully opaque.',
                default: 0.95,
            },
            accentColor: {
                type: 'string',
                description: 'Accent color used by the app UI.',
                default: '#4682b4',
            },
            theme: {
                type: 'string',
                enum: ['light', 'dark', 'system'],
                description: 'UI theme mode.',
                default: 'dark',
            },
            showNotifications: {
                type: 'boolean',
                description: 'Show desktop notifications.',
                default: false,
            },
            startWithSystem: {
                type: 'boolean',
                description: 'Launch Clip when Windows starts.',
                default: true,
            },
            storeImagesInClipboard: {
                type: 'boolean',
                description: 'Store images from the clipboard.',
                default: true,
            },
            pinFavoriteItems: {
                type: 'boolean',
                description: 'Allow pinning favorite clipboard items.',
                default: true,
            },
            deleteConfirm: {
                type: 'boolean',
                description: 'Ask before deleting clipboard items.',
                default: true,
            },
            globalShortcut: {
                type: 'string',
                minLength: 1,
                maxLength: 64,
                description: 'Global shortcut used to open Clip.',
                default: 'Control+Shift+V',
            },
            windowWidth: {
                type: 'integer',
                minimum: WINDOW_SIZE_LIMITS.width.min,
                maximum: WINDOW_SIZE_LIMITS.width.max,
                description: 'Saved window width.',
                default: WINDOW_SIZE_LIMITS.width.default,
            },
            windowHeight: {
                type: 'integer',
                minimum: WINDOW_SIZE_LIMITS.height.min,
                maximum: WINDOW_SIZE_LIMITS.height.max,
                description: 'Saved window height.',
                default: WINDOW_SIZE_LIMITS.height.default,
            },
        },
    };
}

function writeSettingsSchemaFile() {
    try {
        fs.writeFileSync(getSettingsSchemaPath(), JSON.stringify(getSettingsSchema(), null, 2), 'utf8');
    } catch (error) {
        console.error('[main] Failed to write settings schema file:', error);
    }
}

// --- Corrupt-file quarantine + startup notices ------------------------------
// Messages queued here are fetched once by the renderer after it mounts and
// shown as toasts, so file recovery is never silent.
const startupNotices: { type: 'info' | 'error'; message: string }[] = [];
function pushStartupNotice(type: 'info' | 'error', message: string) {
    startupNotices.push({ type, message });
    console.log(`[main] startup notice (${type}): ${message}`);
}

const MAX_QUARANTINED_FILES = 10;
function getQuarantineDir() {
    return path.join(getAppDataPath(), 'corrupted');
}
/**
 * Move a broken config file into <appData>/corrupted/, keeping at most
 * MAX_QUARANTINED_FILES (oldest are deleted). Returns the new path or null.
 */
function quarantineCorruptFile(filePath: string): string | null {
    try {
        const dir = getQuarantineDir();
        fs.mkdirSync(dir, { recursive: true });
        const base = path.basename(filePath).replace(/\.json$/i, '');
        const target = path.join(dir, `${base}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.renameSync(filePath, target);
        // Prune oldest beyond the cap.
        const entries = fs.readdirSync(dir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtime.getTime() }))
            .sort((a, b) => b.mtime - a.mtime);
        entries.slice(MAX_QUARANTINED_FILES).forEach((e) => {
            try { fs.unlinkSync(path.join(dir, e.f)); } catch { /* best-effort */ }
        });
        return target;
    } catch (error) {
        console.error('[main] Failed to quarantine corrupt file:', error);
        return null;
    }
}

function getSettingsLastGoodPath() {
    return path.join(getAppDataPath(), 'clip-settings.last-good.json');
}

// Bounds mirror the JSON schema (getSettingsSchema). Numbers/booleans are
// coerced or clamped ("soft" fixes); an invalid enum or non-object document
// means the file wasn't produced by the app and is treated as corrupt.
function normalizeSettingsDocument(raw: any): { settings: any; changed: boolean; corrupt: boolean; notes: string[] } {
    const notes: string[] = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { settings: null, changed: false, corrupt: true, notes: ['Settings file is not a settings object.'] };
    }
    const defaults = createDefaultSettingsDocument() as Record<string, any>;
    const out: Record<string, any> = {};
    let changed = false;
    let corrupt = false;

    const num = (key: string, min: number, max: number, integer = true) => {
        const parsed = Number(raw[key]);
        if (!Number.isFinite(parsed)) {
            out[key] = defaults[key];
            if (raw[key] !== undefined) { changed = true; notes.push(`"${key}" was not a number; reset to ${defaults[key]}.`); }
            return;
        }
        const clamped = Math.min(max, Math.max(min, integer ? Math.floor(parsed) : parsed));
        out[key] = clamped;
        if (clamped !== parsed) { changed = true; notes.push(`"${key}" was out of range; corrected to ${clamped}.`); }
    };
    const bool = (key: string) => {
        const v = raw[key];
        out[key] = v === undefined ? defaults[key] : !!v;
        if (v !== undefined && typeof v !== 'boolean') changed = true;
    };
    const oneOf = (key: string, allowed: string[]) => {
        const v = raw[key];
        if (v === undefined) { out[key] = defaults[key]; return; }
        if (typeof v === 'string' && allowed.includes(v)) { out[key] = v; return; }
        corrupt = true;
        notes.push(`"${key}" has an invalid value (${JSON.stringify(v)}).`);
        out[key] = defaults[key];
    };

    num('maxItems', 10, 500);
    oneOf('windowHideBehavior', ['hide', 'tray']);
    bool('showInTaskbar');
    bool('enableBackups');
    num('backupInterval', 60 * 1000, 24 * 60 * 60 * 1000);
    num('maxBackups', 1, 50);
    num('borderRadius', 0, 40);
    num('transparency', 0.35, 1, false);
    oneOf('theme', ['dark', 'light', 'system']);
    bool('showNotifications');
    bool('startWithSystem');
    bool('storeImagesInClipboard');
    bool('pinFavoriteItems');
    bool('deleteConfirm');
    num('windowWidth', WINDOW_SIZE_LIMITS.width.min, WINDOW_SIZE_LIMITS.width.max);
    num('windowHeight', WINDOW_SIZE_LIMITS.height.min, WINDOW_SIZE_LIMITS.height.max);

    // accentColor: keep only plausible CSS color strings.
    const accent = raw.accentColor;
    if (typeof accent === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]{3,30})$/i.test(accent.trim())) {
        out.accentColor = accent.trim();
    } else {
        out.accentColor = defaults.accentColor;
        if (accent !== undefined) { changed = true; notes.push('"accentColor" was not a valid color; reset to default.'); }
    }

    // globalShortcut: reject the whole accelerator if any token is unknown.
    const validShortcut = validateAccelerator(raw.globalShortcut);
    if (validShortcut) {
        out.globalShortcut = validShortcut;
        if (validShortcut !== raw.globalShortcut) changed = true;
    } else {
        out.globalShortcut = defaults.globalShortcut ?? SAFE_SHORTCUT_FALLBACK;
        if (raw.globalShortcut !== undefined) {
            changed = true;
            notes.push(`"globalShortcut" (${JSON.stringify(raw.globalShortcut)}) is not a valid shortcut; reset to ${out.globalShortcut}.`);
        }
    }

    // Drop unknown keys (schema is additionalProperties: false). $schema is re-added on write.
    for (const key of Object.keys(raw)) {
        if (key !== '$schema' && !(key in out)) { changed = true; notes.push(`Unknown setting "${key}" removed.`); }
    }

    return { settings: out, changed, corrupt, notes };
}

function readSettingsFromFile() {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) return null;

    try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (error) {
        console.error('[main] Failed to parse settings file; quarantining corrupt file.', error);
        // Quarantine the corrupt file before the caller writes fresh defaults so
        // the user's (recoverable) data isn't silently overwritten.
        quarantineCorruptFile(settingsPath);
        return null;
    }
}

function applySettingsRuntime(settings: any) {
    if (!settings || typeof settings !== 'object') return;

    windowHideBehavior = settings.windowHideBehavior === 'tray' ? 'tray' : 'hide';
    showInTaskbar = !!settings.showInTaskbar;
    showNotifications = !!settings.showNotifications;
    storeImagesInClipboard = settings.storeImagesInClipboard !== false;
    backendShortcut = sanitizeShortcut(settings.globalShortcut || SAFE_SHORTCUT_FALLBACK);

    const parsedMaxItems = Number(settings.maxItems);
    if (Number.isFinite(parsedMaxItems)) {
        maxHistoryItems = Math.min(500, Math.max(10, Math.floor(parsedMaxItems)));
    }

    applyWindowSize(settings.windowWidth, settings.windowHeight);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSkipTaskbar(!showInTaskbar);
    }
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
            quarantineCorruptFile(themePath);
            pushStartupNotice('error', 'Your theme file was invalid and was moved to the "corrupted" folder; the last saved theme was restored.');
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
        fs.writeFileSync(getThemeConfigPath(), JSON.stringify(serializeThemeConfigForFile(sanitized), null, 2), 'utf8');
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

// Re-read the freshest persisted theme config (on-disk file → DB backup →
// in-memory copy) so profile mutations build on the last SAVED state rather
// than a possibly-stale `activeThemeConfig`.
function getFreshThemeConfig() {
    return readThemeConfigFromFile() || readThemeConfigFromDb() || activeThemeConfig;
}

function suppressBlurHide(ms: number) {
    suppressBlurHideUntil = Math.max(suppressBlurHideUntil, Date.now() + ms);
}

function isBlurHideSuppressed() {
    return Date.now() < suppressBlurHideUntil;
}

function hideMainWindowImmediate() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    suppressBlurHide(300);

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

function parseHwndParam(value: any): number | null {
    try {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            return Math.trunc(value);
        }
        if (typeof value === 'bigint' && value > 0n) {
            const n = Number(value);
            return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
        }
        if (Buffer.isBuffer(value)) {
            if (value.length >= 8) {
                const n = Number(value.readBigUInt64LE(0));
                return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
            }
            if (value.length >= 4) {
                const n = value.readUInt32LE(0);
                return n > 0 ? n : null;
            }
        }
        if (value && typeof value === 'object') {
            const asString = String(value);
            const parsed = Number(asString);
            if (Number.isFinite(parsed) && parsed > 0) {
                return Math.trunc(parsed);
            }
        }
    } catch {
    }
    return null;
}

function getMainWindowHwnd(): number | null {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    try {
        const hwndBuffer = mainWindow.getNativeWindowHandle();
        return parseHwndParam(hwndBuffer);
    } catch {
        return null;
    }
}

function getPreferredPasteTargetHwnd() {
    const mainHwnd = getMainWindowHwnd();
    if (lastForegroundHwnd && lastForegroundHwnd > 0) {
        if (!mainHwnd || lastForegroundHwnd !== mainHwnd) {
            return lastForegroundHwnd;
        }
    }
    return null;
}

function sendPasteWithRetries(preferredHwnd: number | null, attempt = 1) {
    const sendPastePath = path.join(app.getAppPath(), 'native', 'SendPaste.exe');
    const hwndArg = preferredHwnd && preferredHwnd > 0 ? String(preferredHwnd) : '';

    execFile(sendPastePath, [hwndArg], (err: any, stdout: string, stderr: string) => {
        if (stdout) {
            console.log('[SendPaste.exe stdout]:', stdout);
        }
        if (stderr) {
            console.error('[SendPaste.exe stderr]:', stderr);
        }

        const stdoutText = String(stdout || '');
        const hwndIsNull = /ERROR:\s*hwnd\s*is\s*NULL/i.test(stdoutText);
        const sendInputZero = /SendInput sent:\s*0/i.test(stdoutText);
        const shouldRetry = (hwndIsNull || sendInputZero || !!err) && attempt < 4;

        if (shouldRetry) {
            const delay = 70 * attempt;
            console.warn(`[main] SendPaste retry ${attempt} after ${delay}ms`);
            const nextPreferred = attempt >= 2 ? null : preferredHwnd;
            setTimeout(() => sendPasteWithRetries(nextPreferred, attempt + 1), delay);
            return;
        }

        if (err) {
            console.error('[main] SendPaste.exe error:', err);
        }
    });
}

function writeSettingsDocument(settings: any) {
    const serialized = JSON.stringify({ $schema: getSettingsSchemaUri(), ...settings }, null, 2);
    const settingsPath = getSettingsPath();
    const tmpPath = `${settingsPath}.tmp`;
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, settingsPath);
    // Keep a last-known-good copy so a corrupt file can be recovered from the
    // user's own settings instead of factory defaults.
    try { fs.writeFileSync(getSettingsLastGoodPath(), serialized, 'utf8'); } catch { /* best-effort */ }
}

/** Read + validate settings, recovering via last-good -> defaults. */
function loadValidatedSettings(): any {
    const fileExisted = fs.existsSync(getSettingsPath());
    const raw = readSettingsFromFile(); // parse failure quarantines + returns null
    let recoveredFromParseFailure = fileExisted && raw === null;

    if (raw !== null) {
        const { settings, changed, corrupt, notes } = normalizeSettingsDocument(raw);
        if (!corrupt) {
            if (changed) {
                pushStartupNotice('info', `Some settings were invalid and have been corrected: ${notes.join(' ')}`);
            }
            return settings;
        }
        // Semantically corrupt (bad enums / not an object): quarantine and recover.
        quarantineCorruptFile(getSettingsPath());
        recoveredFromParseFailure = true;
        pushStartupNotice('error', `Your settings file was invalid (${notes.join(' ')}) and was moved to the "corrupted" folder.`);
    }

    if (recoveredFromParseFailure) {
        // Try the last-known-good copy before falling back to defaults.
        try {
            if (fs.existsSync(getSettingsLastGoodPath())) {
                const lastGood = JSON.parse(fs.readFileSync(getSettingsLastGoodPath(), 'utf8'));
                const { settings, corrupt } = normalizeSettingsDocument(lastGood);
                if (!corrupt) {
                    pushStartupNotice('info', 'Settings were restored from the last good version.');
                    return settings;
                }
            }
        } catch (error) {
            console.error('[main] Failed to read last-good settings:', error);
        }
        pushStartupNotice('error', 'Settings could not be recovered; defaults were restored.');
    }

    return createDefaultSettingsDocument();
}

// Load settings from the settings file (validated) for startup behavior
function loadStartupSettings() {
    try {
        writeSettingsSchemaFile();
        const settings = loadValidatedSettings();
        applySettingsRuntime(settings);
        // Write the normalized document back so the file always matches what
        // the app actually uses (e.g. maxItems -33333 becomes 10 on disk too).
        writeSettingsDocument(settings);
    } catch (error) {
        console.log('[main] Could not load startup settings, using defaults', error);
    }
}

let Database: any = null;
let db: any;
const SQLITE_MAGIC_HEADER = Buffer.from('SQLite format 3\u0000', 'utf8');

function isSqliteBuffer(value: Buffer) {
    if (!Buffer.isBuffer(value)) {
        return false;
    }

    if (value.length < SQLITE_MAGIC_HEADER.length) {
        return false;
    }

    return value.subarray(0, SQLITE_MAGIC_HEADER.length).equals(SQLITE_MAGIC_HEADER);
}

function ensureDatabaseSchema(database: any) {
    database.exec(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        content BLOB NOT NULL,
        timestamp INTEGER NOT NULL
    )`);
    const columns = database.prepare("PRAGMA table_info(history)").all();
    const hasPinned = columns.some((col: any) => col.name === 'pinned');
    if (!hasPinned) {
        database.exec('ALTER TABLE history ADD COLUMN pinned INTEGER DEFAULT 0');
    }

    database.exec(`CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )`);
}

function initDatabase() {
    if (!Database) {
        Database = require('better-sqlite3');
    }
    const dbPath = getDatabasePath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    ensureDatabaseSchema(db);
}

// Insert clipboard item into DB
function insertClipboardItem(item: { type: 'text' | 'image'; content: string; timestamp: number; pinned?: boolean }, maxItems: number = maxHistoryItems) {
    const last = db.prepare('SELECT content, type FROM history ORDER BY id DESC LIMIT 1').get() as { content?: string, type?: string } | undefined;
    if (last && last.content === item.content && last.type === item.type) return;

    const existing = db.prepare('SELECT COUNT(*) as count, MAX(pinned) as pinned FROM history WHERE type = ? AND content = ?')
        .get(item.type, item.content) as { count: number; pinned: number | null } | undefined;

    if (existing && existing.count > 0) {
        const pinnedValue = item.pinned ? 1 : Number(existing.pinned || 0);
        db.prepare('DELETE FROM history WHERE type = ? AND content = ?').run(item.type, item.content);
        db.prepare('INSERT INTO history (type, content, timestamp, pinned) VALUES (?, ?, ?, ?)')
            .run(item.type, item.content, item.timestamp, pinnedValue);
    } else {
        db.prepare('INSERT INTO history (type, content, timestamp, pinned) VALUES (?, ?, ?, ?)')
            .run(item.type, item.content, item.timestamp, item.pinned ? 1 : 0);
    }

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

// Unpin every item (used when the pinning feature is turned off)
function unpinAllItems(): number {
    const result = db.prepare('UPDATE history SET pinned = 0 WHERE pinned = 1').run();
    invalidateHistoryCache();
    return Number(result.changes) || 0;
}

// Delete clipboard item by id
function deleteClipboardItem(id: number) {
    db.prepare('DELETE FROM history WHERE id = ?').run(id);
    invalidateHistoryCache();
}

// --- Cloud sync: DB helpers + OS-encrypted key cache -----------------------
function ensureSyncMapTable() {
    db.prepare(`CREATE TABLE IF NOT EXISTS sync_map (
        client_id TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        type TEXT NOT NULL,
        version INTEGER NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
    )`).run();
    db.prepare('CREATE INDEX IF NOT EXISTS sync_map_hash ON sync_map (content_hash)').run();
}

function getAppState(key: string): string | null {
    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key) as { value?: string } | undefined;
    return row?.value ?? null;
}

function setAppState(key: string, value: string): void {
    db.prepare('INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        .run(key, value, Date.now());
}

function getSyncKeyPath(): string {
    return path.join(getAppDataPath(), 'clip-synckey.dat');
}

function saveSyncKey(keyB64: string | null): void {
    const p = getSyncKeyPath();
    try {
        if (keyB64 === null) {
            if (fs.existsSync(p)) fs.unlinkSync(p);
            return;
        }
        if (!safeStorage.isEncryptionAvailable()) return;
        fs.writeFileSync(p, safeStorage.encryptString(keyB64), { mode: 0o600 });
    } catch (e) {
        logError('saveSyncKey failed: ' + e);
    }
}

function loadSyncKey(): string | null {
    const p = getSyncKeyPath();
    try {
        if (!fs.existsSync(p) || !safeStorage.isEncryptionAvailable()) return null;
        return safeStorage.decryptString(fs.readFileSync(p));
    } catch {
        return null;
    }
}

function buildSyncHost(): cloudSync.SyncHost {
    return {
        getState: (k) => getAppState(k),
        setState: (k, v) => setAppState(k, v),
        readClips: () =>
            (db.prepare('SELECT id, type, content, pinned FROM history').all() as Array<{ id: number; type: 'text' | 'image'; content: string; pinned: number }>)
                .map((r) => ({ id: r.id, type: r.type, content: r.content, pinned: r.pinned ? 1 : 0 })),
        findClipByContent: (type, content) => {
            const r = db.prepare('SELECT id, pinned FROM history WHERE type = ? AND content = ? LIMIT 1').get(type, content) as { id: number; pinned: number } | undefined;
            return r ? { id: r.id, pinned: r.pinned ? 1 : 0 } : null;
        },
        insertClip: (type, content, timestamp, pinned) => insertClipboardItem({ type, content, timestamp, pinned }),
        deleteClip: (id) => { deleteClipboardItem(id); },
        setPinned: (id, pinned) => { toggleItemPinned(id, pinned); },
        readSyncMap: () =>
            (db.prepare('SELECT client_id, content_hash, type, version, pinned, deleted, updated_at FROM sync_map').all() as Array<{ client_id: string; content_hash: string; type: string; version: number; pinned: number; deleted: number; updated_at: number }>)
                .map((r) => ({ clientId: r.client_id, contentHash: r.content_hash, type: r.type, version: r.version, pinned: r.pinned, deleted: r.deleted, updatedAt: r.updated_at })),
        upsertSyncMap: (row) => {
            db.prepare('INSERT INTO sync_map (client_id, content_hash, type, version, pinned, deleted, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(client_id) DO UPDATE SET content_hash = excluded.content_hash, type = excluded.type, version = excluded.version, pinned = excluded.pinned, deleted = excluded.deleted, updated_at = excluded.updated_at')
                .run(row.clientId, row.contentHash, row.type, row.version, row.pinned, row.deleted, row.updatedAt);
        },
        clearSyncMap: () => { db.prepare('DELETE FROM sync_map').run(); },
        markDeletedByContent: (type, contentHash) => {
            db.prepare('UPDATE sync_map SET deleted = 2, updated_at = ? WHERE type = ? AND content_hash = ? AND deleted = 0')
                .run(Date.now(), type, contentHash);
        },
        markAllDeleted: () => {
            db.prepare('UPDATE sync_map SET deleted = 2, updated_at = ? WHERE deleted = 0').run(Date.now());
        },
        refreshUi: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('clipboard-history', getClipboardHistory());
            }
        },
        onRemoteSignout: () => {
            cloudSync.stopAutoSync();
            cloudSync.stopDeviceHeartbeat();
            cloudSync.lock();
            cloudSync.resetLocalSyncState();
            void cloudAuth.logout();
        },
        saveKey: (b64) => saveSyncKey(b64),
        loadKey: () => loadSyncKey(),
    };
}

// Get clipboard history from DB (most recent first) with caching
function getClipboardHistory() {
    const now = Date.now();

    // Return cached data if still valid
    if (now - cacheTimestamp < CACHE_DURATION && cachedClipboardHistory.length > 0) {
        console.log('[main] Returning cached clipboard history');
        return cachedClipboardHistory;
    }

    // Fetch fresh data and cache it. Pinned rows are fetched separately and
    // placed first, then the newest unpinned rows. A single
    // `ORDER BY pinned DESC, id DESC LIMIT ?` would return only pinned rows
    // once the number of pinned items reaches maxHistoryItems, hiding newly
    // copied (unpinned) clips even though they are stored.
    const pinned = db.prepare('SELECT id, type, content, timestamp, pinned FROM history WHERE pinned = 1 ORDER BY id DESC').all() as ClipboardHistoryItem[];
    const unpinned = db.prepare('SELECT id, type, content, timestamp, pinned FROM history WHERE pinned = 0 ORDER BY id DESC LIMIT ?').all(maxHistoryItems) as ClipboardHistoryItem[];
    const history = [...pinned, ...unpinned];
    cachedClipboardHistory = composeClipboardHistory(history);
    cacheTimestamp = now;
    console.log(`[main] Cached ${cachedClipboardHistory.length} clipboard items`);

    return cachedClipboardHistory;
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
                // Fetch pinned rows separately and place them first, then the
                // newest unpinned rows, so newly copied clips always show even
                // when there are maxHistoryItems or more pinned items. (See the
                // synchronous getClipboardHistory for the reasoning.)
                const pinned = db.prepare('SELECT id, type, content, timestamp, pinned FROM history WHERE pinned = 1 ORDER BY id DESC').all() as ClipboardHistoryItem[];
                const unpinned = db.prepare('SELECT id, type, content, timestamp, pinned FROM history WHERE pinned = 0 ORDER BY id DESC LIMIT ?').all(maxHistoryItems) as ClipboardHistoryItem[];
                const history = [...pinned, ...unpinned];
                const combinedHistory = composeClipboardHistory(history);

                // Only log and update if the length has changed
                if (lastHistoryLength !== combinedHistory.length) {
                    console.log(`[main] Async cached ${combinedHistory.length} clipboard items`);
                    lastHistoryLength = combinedHistory.length;
                }

                cachedClipboardHistory = combinedHistory;
                cacheTimestamp = Date.now();

                // Resolve current request
                resolve(combinedHistory);

                // Resolve any pending requests
                pendingHistoryRequests.forEach(callback => callback(combinedHistory));
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
        tray = new Tray(getAppIconImage());
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
        icon: getAppIconPath(),
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
    mainWindow.setIcon(getAppIconPath());

    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(
        process.env.NODE_ENV === 'development'
            ? devServerUrl
            : `file://${path.resolve(__dirname, '../renderer/index.html')}`
    );

    // In dev, a dead Vite server must not leave a blank zombie process holding
    // the database and single-instance lock: bail out instead.
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
            if (url && url.startsWith(devServerUrl)) {
                console.error(`[main] Dev server unreachable (${code} ${desc}); quitting instead of lingering.`);
                app.exit(1);
            }
        });
    }

    // Security: route window.open / target=_blank and any in-app navigation away
    // from arbitrary origins. External http(s) links open in the user's browser;
    // navigation is only permitted to the app's own content (the dev server URL
    // in development and the packaged file:// bundle in production).
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const isAppContent = url.startsWith(devServerUrl) || url.startsWith('file://');
        if (!isAppContent) {
            event.preventDefault();
            if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        }
    });

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
            if (isBlurHideSuppressed()) {
                console.log('[main] Window blur hide suppressed briefly');
                return;
            }

            console.log('[main] Window lost focus, hiding...');

            // Restore focus to the previous window before hiding.
            // NOTE (known limitation): this always re-foregrounds the window that
            // was active before Clip opened, even when the blur happened because
            // the user clicked a *different* app. Distinguishing "user clicked
            // elsewhere" from "focus should return to the origin window" needs the
            // new foreground HWND at blur time; left as a follow-up to avoid
            // regressing the normal open→pick→paste-back flow.
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

    if (clipboardPollTimer) {
        clearInterval(clipboardPollTimer);
    }

    // NOTE: This is interval-based polling (Electron exposes no clipboard-change
    // event on Windows). Two rapid copies within one interval collapse into a
    // single detection — inherent to polling; not changed here to avoid the cost
    // of a tighter interval / native clipboard listener.
    clipboardPollTimer = setInterval(() => {
        const text = clipboard.readText();
        const image = clipboard.readImage();
        let imageDataUrl = '';
        if (!image.isEmpty()) {
            // Compare image content, not dimensions, so same-size updates are detected.
            // Encoding to a data URL (PNG + base64) is expensive, so first compare the
            // raw bitmap buffer (a cheap memcmp): only re-encode when the pixels have
            // actually changed and reuse the previous data URL otherwise.
            const bitmap = image.toBitmap();
            if (lastImageBitmap && lastImageDataUrl && bitmap.equals(lastImageBitmap)) {
                imageDataUrl = lastImageDataUrl;
            } else {
                imageDataUrl = image.toDataURL();
                lastImageBitmap = bitmap;
            }
        } else {
            lastImageBitmap = null;
        }

        // Track last seen clipboard content to avoid unnecessary DB/cache/log updates
        let shouldUpdate = false;

        // Only insert if text is non-empty and different from last
        if (text && text !== lastText) {
            lastText = text;
            shouldUpdate = true;
            // NOTE: When image storage is disabled, the temporary image preview
            // (below) is cleared here on any text copy and only reappears when a
            // new image is copied. Accepted as-is; re-surfacing it would require
            // retaining the last temp image across text copies.
            setTemporaryClipboardItem(null);
            const item = { type: 'text' as const, content: text, timestamp: Date.now() };
            insertClipboardItem(item);
            console.log('[main] New text detected:', text);
            if (mainWindow && mainWindow.isVisible()) {
                mainWindow.webContents.send('clipboard-item', item);
                console.log('[main] Sent clipboard-item (text) to renderer');
            }
            if (showNotifications) {
                // Never echo the copied content into the OS notification / Action
                // Center — it can leak secrets (passwords, tokens) to a persistent,
                // shoulder-surfable surface. Use a generic body instead.
                const notification = {
                    title: 'Clip - New Text Copied',
                    body: 'Copied to Clip history'
                };
                new Notification(notification).show();
            }
        } else if (!text) {
            lastText = '';
        }

        if (storeImagesInClipboard) {
            if (imageDataUrl && imageDataUrl !== lastImageDataUrl) {
                lastImageDataUrl = imageDataUrl;
                shouldUpdate = true;
                setTemporaryClipboardItem(null);
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
                setTemporaryClipboardItem(null);
            }
        } else {
            if (imageDataUrl && imageDataUrl !== lastImageDataUrl) {
                lastImageDataUrl = imageDataUrl;
                shouldUpdate = true;
                const tempItem = {
                    id: `temp-image-${Date.now()}`,
                    type: 'image' as const,
                    content: imageDataUrl,
                    timestamp: Date.now(),
                    isTemporary: true,
                };
                setTemporaryClipboardItem(tempItem);
                console.log('[main] New temporary image detected');
                if (mainWindow && mainWindow.isVisible()) {
                    mainWindow.webContents.send('clipboard-item', tempItem);
                    console.log('[main] Sent clipboard-item (temporary image) to renderer');
                }
                if (showNotifications) {
                    const notification = {
                        title: 'Clip - Temporary Image Copied',
                        body: 'An image was copied to clipboard'
                    };
                    new Notification(notification).show();
                }
            } else if (!imageDataUrl) {
                lastImageDataUrl = '';
                setTemporaryClipboardItem(null);
            }
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
// Auto-created backups keep their ISO-timestamp filename; a user rename breaks
// this pattern, which is what exempts the file from max-backups pruning.
const AUTO_BACKUP_FILE_RE = /^clip-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db$/;
function getBackupFiles() {
    const BACKUP_DIR = getBackupDir();
    ensureBackupDir();
    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const stat = fs.statSync(path.join(BACKUP_DIR, f));
            // Extract timestamp from filename format: clip-backup-YYYY-MM-DDTHH-MM-SS-SSSZ.db
            const match = f.match(/clip-backup-(.+)\.db$/);
            let time = NaN;

            if (match) {
                // Convert ISO string back (replace hyphens with colons/periods for time parts)
                const isoString = match[1].replace(/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)/, '$1:$2:$3.$4');
                time = new Date(isoString).getTime();
            }
            // Renamed/foreign files (or a failed parse) fall back to file mtime,
            // which rename preserves, so the original backup time survives.
            if (isNaN(time)) {
                time = stat.mtime.getTime();
            }

            return {
                file: f,
                time,
                size: stat.size,
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

        // Clean up old backups. Only auto-named backups are pruned: a rename is
        // the user saying "keep this one", so custom-named files are exempt.
        const autoBackups = getBackupFiles().filter(b => AUTO_BACKUP_FILE_RE.test(b.file));
        if (autoBackups.length > clipMaxBackups) {
            autoBackups.slice(clipMaxBackups).forEach(b => fs.unlinkSync(path.join(getBackupDir(), b.file)));
        }

        // Best-effort encrypted cloud backup (non-blocking, guarded by sync state).
        void maybeCloudBackup(backupPath);
        return backupPath;
    } catch (error) {
        console.error('[main] Error creating backup:', error);
        throw error;
    }
}

async function maybeCloudBackup(backupPath: string): Promise<void> {
    try {
        const st = cloudSync.getStatus();
        if (!st.enabled || !st.unlocked) return;
        const bytes = fs.readFileSync(backupPath);
        const r = await cloudSync.pushBackup(bytes, os.hostname());
        if (!r.ok && r.error && r.error !== 'locked') logError('cloud backup failed: ' + r.error);
    } catch (e) {
        logError('cloud backup error: ' + e);
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

    // Validate the backup is a real SQLite database BEFORE touching the live
    // connection. If it isn't, we throw here while the current db is still
    // open, so a bad backup can never leave the app without a database.
    const header = Buffer.alloc(SQLITE_MAGIC_HEADER.length);
    const headerFd = fs.openSync(backupPath, 'r');
    try {
        fs.readSync(headerFd, header, 0, SQLITE_MAGIC_HEADER.length, 0);
    } finally {
        fs.closeSync(headerFd);
    }
    if (!isSqliteBuffer(header)) {
        throw new Error('Backup file is not a valid SQLite database');
    }

    // Close the current database connection
    if (db) {
        console.log('[main] Closing current database connection');
        db.close();
    }

    // Remove the OLD database's WAL/SHM sidecars before overwriting the main DB
    // file. The backup is a checkpointed copy with no sidecars of its own, so any
    // leftover -wal/-shm belongs to the pre-restore database — if left in place,
    // SQLite may replay that stale WAL on reopen and resurrect old data.
    for (const sidecar of [`${dbPath}-wal`, `${dbPath}-shm`]) {
        try {
            if (fs.existsSync(sidecar)) {
                fs.unlinkSync(sidecar);
                console.log(`[main] Removed stale DB sidecar: ${sidecar}`);
            }
        } catch (sidecarError) {
            console.error(`[main] Failed to remove DB sidecar ${sidecar}:`, sidecarError);
        }
    }

    // From here the live db is closed, so the reopen below MUST run on every
    // path (success or failure) — otherwise a failed copy would leave db null
    // and brick the app until restart. Capture any copy error and rethrow it
    // only after the connection has been restored.
    let copyError: unknown = null;
    try {
        // Copy the backup file to replace the current database
        console.log(`[main] Copying backup to: ${dbPath}`);
        fs.copyFileSync(backupPath, dbPath);

        // Verify the copied file
        const restoredStats = fs.statSync(dbPath);
        console.log(`[main] Restored database size: ${restoredStats.size} bytes`);
    } catch (error) {
        copyError = error;
    } finally {
        // Reinitialize the database connection with the restored data (or, if
        // the copy failed, whatever file is still at dbPath). Running this in
        // finally guarantees db is a valid open Database on every exit path.
        console.log('[main] Reinitializing database connection');
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        ensureDatabaseSchema(db);
        // The restored DB may predate cloud sync (no sync_map) or carry another
        // device's shadow state. Recreate the table so a later query can't throw
        // 'no such table: sync_map'.
        ensureSyncMapTable();
    }

    // The copy failed: db is back open on the original file, so the app keeps
    // working. Surface the original error so the caller/IPC reports the failure.
    if (copyError) {
        throw copyError;
    }

    // Materialize the restored state into the main .db file right away and drop
    // any cached pre-restore history, so nothing stale can be served or copied.
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* best-effort */ }
    invalidateHistoryCache();

    // Reset the cursor + device id so the next sync re-reconciles from scratch
    // and this install registers as its own device — rather than hijacking the
    // backup's origin device.
    setAppState('sync_cursor', '');
    // We intentionally do NOT deregister the previous device on the server here:
    // this is a synchronous restore path and deregistration requires a network
    // round-trip. The orphaned remote "device" row ages out via the server-side
    // heartbeat TTL (the device heartbeat stops refreshing it). Explicit cleanup
    // would be a follow-up if it ever proves necessary.
    setAppState('sync_device_id', '');

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
        invalidateHistoryCache();

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
ipcMain.handle('rename-backup', (_event, file: string, newLabel: string) => {
    try {
        const oldPath = resolveBackupPath(file);
        if (!fs.existsSync(oldPath)) {
            return { ok: false, error: 'Backup not found.' };
        }
        // Turn the label into a filename-safe slug that still satisfies
        // resolveBackupPath's clip-backup-*.db pattern (so restore/delete keep
        // working on the renamed file).
        const slug = String(newLabel)
            .trim()
            .replace(/\.db$/i, '')
            .replace(/\s+/g, '-')
            .replace(/[^A-Za-z0-9_.-]/g, '')
            .replace(/^[.-]+|[.-]+$/g, '')
            .slice(0, 64);
        if (!slug) {
            return { ok: false, error: 'Use letters, numbers, dashes, or underscores.' };
        }
        const newFile = `clip-backup-${slug}.db`;
        const newPath = resolveBackupPath(newFile);
        if (newPath === oldPath) {
            return { ok: true, file: newFile };
        }
        if (fs.existsSync(newPath)) {
            return { ok: false, error: 'A backup with that name already exists.' };
        }
        fs.renameSync(oldPath, newPath);
        console.log(`[main] Renamed backup: ${file} -> ${newFile}`);
        return { ok: true, file: newFile };
    } catch (error) {
        console.error(`[main] Error renaming backup ${file}:`, error);
        return { ok: false, error: error instanceof Error ? error.message : 'Rename failed.' };
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
    const dbPath = getDatabasePath();
    const backupPath = `${dbPath}.bak`;
    const incoming = Buffer.from(buffer);

    if (!isSqliteBuffer(incoming)) {
        console.error('[main] import-db rejected: incoming file is not a valid SQLite database');
        return false;
    }

    let backupCreated = false;

    try {
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupPath);
            backupCreated = true;
        }

        // Close the current database connection
        if (db) {
            db.close();
            db = null;
        }

        // Same as restoreBackup: stale sidecars from the pre-import database
        // must not be replayed over the imported file on reopen.
        for (const sidecar of [`${dbPath}-wal`, `${dbPath}-shm`]) {
            try { if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar); }
            catch (sidecarError) { console.error(`[main] Failed to remove DB sidecar ${sidecar}:`, sidecarError); }
        }

        // Write the imported database file
        fs.writeFileSync(dbPath, incoming);

        // Reinitialize the database connection with the imported data
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        ensureDatabaseSchema(db);
        ensureSyncMapTable();
        invalidateHistoryCache();

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

        try {
            if (backupCreated && fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, dbPath);
                db = new Database(dbPath);
                db.pragma('journal_mode = WAL');
                ensureDatabaseSchema(db);
                ensureSyncMapTable();
                invalidateHistoryCache();
                console.log('[main] Database restored from backup after import failure');
            }
        } catch (restoreError) {
            console.error('[main] Failed to restore database backup after import failure:', restoreError);
        }

        return false;
    }
});
ipcMain.on('set-backup-settings', (_event, { enableBackups, backupInterval, maxBackups }) => {
    clipEnableBackups = enableBackups;
    clipBackupInterval = backupInterval;
    clipMaxBackups = maxBackups;
    setupAutoBackup();
});

// Persisted timestamp of the last automatic backup, so the schedule is based
// on "time since the last backup" rather than "time since the timer was
// (re)started" — previously every settings save reset the countdown, which is
// why a 5-minute interval could take 7-8 minutes to produce a backup.
function getLastAutoBackupAt(): number {
    try {
        const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('last_auto_backup_at') as { value?: string } | undefined;
        const n = Number(row?.value);
        return Number.isFinite(n) ? n : 0;
    } catch { return 0; }
}
function setLastAutoBackupAt(ts: number) {
    try {
        db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)')
            .run('last_auto_backup_at', String(ts), Date.now());
    } catch { /* best-effort */ }
}
let backupTimer: NodeJS.Timeout | null = null;
function setupAutoBackup() {
    if (backupTimer) clearInterval(backupTimer);
    if (!clipEnableBackups) return;
    // Check every 30 s whether a backup is due instead of one long interval:
    // the countdown survives settings saves and app restarts.
    backupTimer = setInterval(() => {
        try {
            if (!clipEnableBackups || !db) return;
            const interval = clipBackupInterval || 15 * 60 * 1000;
            const now = Date.now();
            if (now - getLastAutoBackupAt() >= interval) {
                setLastAutoBackupAt(now);
                createBackup();
            }
        } catch (error) {
            console.error('[main] Auto-backup tick failed:', error);
        }
    }, 30 * 1000);
}
setupAutoBackup();

let wmClipShowHookedForWindowId: number | null = null;

// Native Windows message handler for AHK trigger
function registerNativeMessageHandler() {
    if (process.platform !== 'win32' || !mainWindow) return;

    // Important: use Electron's built-in hookWindowMessage (no native addon).
    // This lets AHK trigger the *same* show path as tray click, ensuring the
    // renderer receives 'window-will-show' and the window isn't invisible.
    if (wmClipShowHookedForWindowId === mainWindow.id) return;

    try {
        mainWindow.hookWindowMessage(WM_CLIP_SHOW, (wParam) => {
            // Run on next tick to avoid re-entrancy surprises.
            setImmediate(() => {
                try {
                    // TRUST ASSUMPTION: wParam is treated as the HWND of the paste
                    // target and is not authenticated — any local process that can
                    // find Clip's window could post WM_CLIP_SHOW (0x8001) with an
                    // arbitrary HWND. This is intentional: our AHK helper captures
                    // the pre-Clip foreground window and passes it here precisely
                    // because it is more reliable than re-detecting the foreground
                    // after the async post. parseHwndParam already rejects
                    // non-positive/garbage values, and the worst case is that a
                    // subsequent paste targets the caller-supplied window. Kept as
                    // documented rather than dropping wParam (which would regress
                    // the AHK paste-back flow).
                    const targetFromAhk = parseHwndParam(wParam);
                    if (targetFromAhk && targetFromAhk > 0) {
                        lastForegroundHwnd = targetFromAhk;
                    }
                    showMainWindow(targetFromAhk);
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


function savePreviousHwnd(preferredFromAhk?: number | null) {
    // Prefer explicit target from AHK if provided.
    if (preferredFromAhk && preferredFromAhk > 0) {
        lastForegroundHwnd = preferredFromAhk;
        return;
    }

    // Fallback: capture active window before Clip is shown.
    try {
        const clipmsgPath = path.join(app.getAppPath(), 'native', 'clipmsg.node');
        if (fs.existsSync(clipmsgPath)) {
            const clipmsg = require(clipmsgPath);
            const hwnd = Number(clipmsg?.getForegroundWindow?.());
            const mainHwnd = getMainWindowHwnd();
            if (Number.isFinite(hwnd) && hwnd > 0) {
                if (mainHwnd && hwnd === mainHwnd) {
                    // Clip's own window is already foreground (e.g. the shortcut
                    // was pressed again while Clip is open). Keep the previously
                    // saved target — overwriting it here would destroy the real
                    // paste destination.
                    return;
                }
                lastForegroundHwnd = Math.trunc(hwnd);
                return;
            }
        }
    } catch {
    }

    lastForegroundHwnd = null;
}

function restorePreviousWindow() {
    if (!lastForegroundHwnd || lastForegroundHwnd <= 0) return;
    try {
        const clipmsgPath = path.join(app.getAppPath(), 'native', 'clipmsg.node');
        if (!fs.existsSync(clipmsgPath)) return;
        const clipmsg = require(clipmsgPath);
        if (typeof clipmsg?.setForegroundWindow === 'function') {
            clipmsg.setForegroundWindow(lastForegroundHwnd);
        }
    } catch {
    }
}

function showMainWindow(preferredTargetHwnd?: number | null) {
    // Save the previous foreground window HWND before showing
    savePreviousHwnd(preferredTargetHwnd);

    // Recreate window if it doesn't exist or is destroyed
    let windowWasRecreated = false;
    if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
        windowWasRecreated = true;
    }
    if (!mainWindow) return;

    suppressBlurHide(450);

    ensureWindowBoundsVisible(mainWindow);
    mainWindow.webContents.send('window-will-show');
    // On summon, promptly reflect account changes made elsewhere: detect a
    // remote "sign out this device" (→ sign out locally) and pick up any
    // profile / plan changes made on the website.
    if (cloudAuth.isLoggedIn()) {
        void cloudSync.registerDevice();
        void cloudAuth.refreshProfile();
    }

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

    // Cloud auth: encrypted session storage + browser sign-in. Broadcast auth
    // changes so the renderer's Profile tab stays in sync.
    initTokenStore(getAppDataPath());
    cloudAuth.initAuth(() => {
        cloudAuth
            .getAuthState(false)
            .then((state) => mainWindow?.webContents.send('auth-changed', state))
            .catch(() => { });
    });
    ensureSyncMapTable();
    cloudSync.initSync(buildSyncHost());
    cloudSync.startAutoSync();
    // Register this device (for the account's "Devices & sessions" list) and
    // keep it fresh — independent of Pro / cloud sync. Also poll the profile so
    // name / avatar / plan changes made on the website show up without a restart.
    cloudSync.startDeviceHeartbeat();
    setInterval(() => { void cloudAuth.refreshProfile(); }, 90 * 1000);

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
    handleShortcutChangeQueued(backendShortcut);

    // --- Cloud auth IPC ---
    ipcMain.handle('auth:get-state', () => cloudAuth.getAuthState(true));
    ipcMain.handle('auth:login', async () => {
        const state = await cloudAuth.login();
        cloudSync.startAutoSync();
        cloudSync.startDeviceHeartbeat(); // registers this device immediately
        return state;
    });
    ipcMain.handle('auth:logout', async () => {
        cloudSync.stopAutoSync();
        cloudSync.stopDeviceHeartbeat();
        await cloudSync.deregisterDevice(); // remove from "Devices" (token still valid)
        cloudSync.lock();
        await cloudAuth.logout();
        // Drop this user's sync shadow state so another account on this machine
        // doesn't resume from it.
        cloudSync.resetLocalSyncState();
        return cloudAuth.getAuthState(false);
    });

    // Open an external https link in the user's default browser.
    ipcMain.on('open-external', (_e, url: string) => {
        if (typeof url === 'string' && /^https:\/\//i.test(url)) {
            void shell.openExternal(url);
        }
    });

    // --- Cloud sync IPC ---
    ipcMain.handle('sync:get-status', async () => {
        const status = cloudSync.getStatus();
        let usage = null;
        if (status.enabled && status.unlocked) {
            usage = await cloudSync.fetchUsage().catch(() => null);
        }
        return { ...status, usage };
    });
    ipcMain.handle('sync:set-enabled', (_e, enabled: boolean) => {
        setAppState('sync_enabled', enabled ? '1' : '0');
        if (!enabled) cloudSync.lock();
        return cloudSync.getStatus();
    });
    ipcMain.handle('sync:setup-passphrase', async (_e, passphrase: string) => {
        const r = await cloudSync.setupPassphrase(passphrase);
        if (r.ok) void cloudSync.syncNow();
        return { ...r, status: cloudSync.getStatus() };
    });
    ipcMain.handle('sync:reset-passphrase', async (_e, passphrase: string) => {
        const r = await cloudSync.resetPassphrase(passphrase);
        return { ...r, status: cloudSync.getStatus() };
    });
    ipcMain.handle('sync:now', () => cloudSync.syncNow());
    ipcMain.handle('sync:lock', () => {
        cloudSync.lock();
        return cloudSync.getStatus();
    });
    ipcMain.handle('sync:backup-now', async () => {
        try {
            if (db) db.pragma('wal_checkpoint(TRUNCATE)');
            const bytes = fs.readFileSync(getDatabasePath());
            return await cloudSync.pushBackup(bytes, os.hostname());
        } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    });
    ipcMain.handle('sync:list-backups', () => cloudSync.listBackups());
    ipcMain.handle('sync:delete-backup', (_e, id: string) => cloudSync.deleteBackup(String(id)));
    ipcMain.handle('sync:rename-backup', (_e, id: string, name: string) => cloudSync.renameBackup(String(id), String(name)));
    ipcMain.handle('sync:restore-backup', async (_e, id: string) => {
        // Track the temp file so it is always removed (finally), not just on the
        // success path — otherwise a failed restore leaks a multi-MB .db file.
        let tempName: string | null = null;
        try {
            const bytes = await cloudSync.downloadBackup(id);
            if (!bytes) return { ok: false, error: 'Could not download or decrypt the backup.' };
            if (bytes.length < 16 || !bytes.subarray(0, 16).equals(SQLITE_MAGIC_HEADER)) {
                return { ok: false, error: 'The backup file is not valid.' };
            }
            ensureBackupDir();
            tempName = `clip-backup-cloud-${Date.now()}.db`;
            fs.writeFileSync(path.join(getBackupDir(), tempName), bytes);
            restoreBackup(tempName);
            invalidateHistoryCache();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('clipboard-history', getClipboardHistory());
            }
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        } finally {
            if (tempName) {
                try { fs.unlinkSync(path.join(getBackupDir(), tempName)); } catch { /* best-effort */ }
            }
        }
    });

    ipcMain.on('paste-clipboard-item', (_event, item) => {
        // getPreferredPasteTargetHwnd() returns null when the saved target is
        // missing or resolves to Clip's own window — so we never explicitly
        // target Clip. A null target means SendPaste falls back to whatever is
        // foreground after we hide Clip (normally the previous window, which the
        // OS re-foregrounds), which keeps paste working even when the native
        // foreground-capture module is unavailable. The content is on the
        // clipboard regardless, so a missed target still leaves it pasteable.
        const preferredTargetHwnd = getPreferredPasteTargetHwnd();

        if (item.type === 'text') {
            clipboard.writeText(item.content);
        } else if (item.type === 'image') {
            const image = nativeImage.createFromDataURL(item.content);
            clipboard.writeImage(image);

            const verifyImage = clipboard.readImage();
            if (verifyImage.isEmpty()) {
                setTimeout(() => {
                    try {
                        clipboard.writeImage(image);
                    } catch (retryError) {
                        console.error('[main] Failed to rewrite image to clipboard:', retryError);
                    }
                }, 30);
            }
        }

        // Prevent immediate blur-hide race while we hide and return focus.
        suppressBlurHide(900);

        // Explicitly restore focus to the previous app before paste.
        restorePreviousWindow();

        if (mainWindow && !mainWindow.isDestroyed()) {
            hideMainWindowImmediate();
        }

        // One extra restore attempt improves reliability in Chromium targets.
        setTimeout(() => {
            restorePreviousWindow();
        }, 45);

        const pasteDelayMs = item.type === 'image' ? 120 : 55;

        // Give target window a brief moment to become foreground, then paste with retry.
        setTimeout(() => {
            sendPasteWithRetries(preferredTargetHwnd, 1);
        }, pasteDelayMs);
    });

    ipcMain.on('set-window-hide-behavior', (_event, behavior) => {
        // Only accept the two known values; ignore anything else and keep the
        // current behavior rather than assigning an arbitrary renderer value.
        if (behavior !== 'hide' && behavior !== 'tray') {
            return;
        }
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

    ipcMain.handle('get-theme-paths', () => {
        return {
            configPath: getThemeConfigPath(),
            schemaPath: getThemeSchemaPath(),
        };
    });

    ipcMain.handle('open-theme-config-file', async () => {
        try {
            const configPath = getThemeConfigPath();
            if (!fs.existsSync(configPath)) {
                persistThemeConfig(activeThemeConfig);
            }

            const error = await shell.openPath(configPath);
            if (error) {
                return { ok: false, error, path: configPath };
            }

            return { ok: true, path: configPath };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
                path: getThemeConfigPath(),
            };
        }
    });

    ipcMain.handle('get-settings-paths', () => {
        return {
            configPath: getSettingsPath(),
            schemaPath: getSettingsSchemaPath(),
        };
    });

    ipcMain.handle('open-settings-config-file', async () => {
        try {
            const configPath = getSettingsPath();
            if (!fs.existsSync(configPath)) {
                const doc = { $schema: getSettingsSchemaUri(), ...createDefaultSettingsDocument() };
                fs.writeFileSync(configPath, JSON.stringify(doc, null, 2), 'utf8');
            }

            const error = await shell.openPath(configPath);
            if (error) {
                return { ok: false, error, path: configPath };
            }

            return { ok: true, path: configPath };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
                path: getSettingsPath(),
            };
        }
    });

    ipcMain.handle('reload-settings-from-disk', () => {
        // Full validation on reload: hand-edited values are clamped/corrected
        // (and written back normalized), never returned raw to the renderer.
        const settings = loadValidatedSettings();
        applySettingsRuntime(settings);
        if (Number.isFinite(Number(settings.maxItems))) {
            maxHistoryItems = Math.min(500, Math.max(10, Math.floor(Number(settings.maxItems))));
            invalidateHistoryCache();
        }
        try { writeSettingsDocument(settings); } catch { /* keep going with in-memory settings */ }
        handleShortcutChangeQueued(backendShortcut);
        return settings;
    });

    ipcMain.handle('create-theme-profile', (_event, profileName) => {
        const cleanName = String(profileName || '').trim();
        if (!cleanName) {
            throw new Error('Profile name is required');
        }

        // Build from the freshest saved config, not the (possibly stale)
        // in-memory copy. NOTE (follow-up): the theme-config-updated broadcast
        // below will replace the renderer's editor state, so any unsaved edits in
        // the theme editor are discarded when a profile is created. Fully
        // preserving in-progress edits needs renderer coordination (e.g. the
        // renderer merging rather than replacing on this event).
        const current = getFreshThemeConfig();

        const keyBase = normalizeThemeProfileKey(cleanName);
        let key = keyBase;
        let index = 2;
        while (current.profiles[key]) {
            key = `${keyBase}-${index}`;
            index += 1;
        }

        const source = current.profiles[current.activeProfile] || createDefaultThemeConfig().profiles.default;
        const next = {
            ...current,
            activeProfile: key,
            profiles: {
                ...current.profiles,
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
        // Operate on the freshest saved config rather than the in-memory copy.
        const current = getFreshThemeConfig();
        const key = normalizeThemeProfileKey(String(profileKey || ''));
        const existingKeys = Object.keys(current.profiles);
        if (!current.profiles[key]) {
            return current;
        }
        if (existingKeys.length <= 1) {
            throw new Error('At least one profile must remain');
        }

        const { [key]: _removed, ...rest } = current.profiles;
        const fallbackKey = rest[current.activeProfile] ? current.activeProfile : Object.keys(rest)[0];
        const next = {
            ...current,
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
        // Switch the active profile on the freshest saved config.
        const current = getFreshThemeConfig();
        const key = normalizeThemeProfileKey(String(profileKey || ''));
        if (!current.profiles[key]) {
            throw new Error('Profile not found');
        }

        const next = {
            ...current,
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
        // A user-initiated "clear all" is a real deletion: propagate it so other
        // devices clear too (distinct from local cap-eviction, which does not).
        cloudSync.notePendingDeletionAll();
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

    ipcMain.handle('unpin-all-items', async (event) => {
        const changed = unpinAllItems();
        const history = await getClipboardHistoryAsync();
        event.sender.send('clipboard-history', history);
        return changed;
    });

    ipcMain.on('delete-clipboard-item', (event, id) => {
        const row = db.prepare('SELECT type, content FROM history WHERE id = ?').get(id) as { type: string; content: string } | undefined;
        deleteClipboardItem(id);
        // Record as a genuine user deletion so the next sync tombstones it
        // cloud-wide (cap-eviction/trim intentionally do not do this).
        if (row) cloudSync.notePendingDeletion(row.type, row.content);
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

    ipcMain.on('set-win-v-override', (_event, enabled) => {
        // NOTE: Win+V override is not currently wired up — updateGlobalShortcut()
        // does not consult winVOverrideEnabled, and no renderer UI sends this
        // message, so toggling it has no effect today. Left in place as the hook
        // point for a future implementation (see winVOverrideEnabled declaration).
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
            if (clipboardPollTimer) {
                clearInterval(clipboardPollTimer);
                clipboardPollTimer = null;
            }
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
            if (clipboardPollTimer) {
                clearInterval(clipboardPollTimer);
                clipboardPollTimer = null;
            }
            try { globalShortcut.unregisterAll(); } catch { }
            try { if (tray) { tray.destroy(); tray = null; } } catch { }
            stopAhk();
            const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
            if (isDev) {
                // app.relaunch() is broken under `npm run dev`: this process
                // exiting makes concurrently kill the Vite server, so the
                // relaunched instance loads a dead URL and lingers as a blank
                // zombie that still holds the database and single-instance
                // lock. Just quit; the dev script is restarted by hand.
                console.log('[main] Dev mode: skipping relaunch, quitting for manual restart');
                app.exit(0);
                return;
            }
            // No need to close the main window explicitly, app.relaunch will handle it.
            app.relaunch();
            app.exit(0); // Exit cleanly
        }, 200); // Same delay as quit-app for consistency
    });

    ipcMain.on('save-settings-to-file', (_event, settings) => {
        try {
            // Normalize before anything touches disk or runtime, so out-of-range
            // or malformed values can never round-trip through the file.
            const { settings: normalized } = normalizeSettingsDocument(settings || {});
            applySettingsRuntime(normalized);
            if (Number.isFinite(Number(normalized.maxItems))) {
                maxHistoryItems = Math.min(500, Math.max(10, Math.floor(Number(normalized.maxItems))));
                invalidateHistoryCache();
            }
            // writeSettingsDocument is atomic (tmp file + rename) and refreshes
            // the last-known-good copy used for corrupt-file recovery.
            writeSettingsDocument(normalized);
            handleShortcutChangeQueued(backendShortcut);
        } catch (error) {
            console.error('[main] Failed to save settings to file:', error);
        }
    });

    // Validated settings for the renderer's boot sequence: the file (not the
    // renderer's localStorage cache) is the source of truth after a relaunch.
    ipcMain.handle('get-settings', () => {
        try {
            return loadValidatedSettings();
        } catch (error) {
            console.error('[main] get-settings failed:', error);
            return createDefaultSettingsDocument();
        }
    });

    // One-shot delivery of recovery/validation notices collected during boot.
    ipcMain.handle('get-startup-notices', () => {
        const notices = startupNotices.splice(0, startupNotices.length);
        return notices;
    });
});

app.on('window-all-closed', () => {
});

app.on('activate', () => {
    if (!mainWindow) createMainWindow();
});

app.on('before-quit', () => {
    if (clipboardPollTimer) {
        clearInterval(clipboardPollTimer);
        clipboardPollTimer = null;
    }
    stopAhk(); // Ensure AHK process is terminated when quitting the app
    // Checkpoint + close the DB so the main .db file is complete on disk at
    // exit (not split across a -wal sidecar) and no handle lingers.
    try {
        if (db) {
            db.pragma('wal_checkpoint(TRUNCATE)');
            db.close();
            db = null;
        }
    } catch (error) {
        console.error('[main] Failed to close database on quit:', error);
    }
});
