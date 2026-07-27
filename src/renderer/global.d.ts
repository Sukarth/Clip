// Type definitions for Electron contextBridge API exposed in preload.js
type ThemeConfig = import('../theme-config').ThemeConfig;
type ThemeSchema = Record<string, unknown>;

interface AuthState {
    loggedIn: boolean;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    isPro: boolean;
    plan: 'free' | 'pro' | null;
}

interface ElectronAPI {
    dragWindow: (cursorX: number, cursorY: number, offsetX?: number, offsetY?: number) => void;
    hideWindow: () => void;
    restorePreviousWindow: () => void;
    onClipboardItem: (callback: (data: any) => void) => (() => void) | void;
    onClipboardHistory: (callback: (data: any) => void) => (() => void) | void;
    pasteClipboardItem: (item: any) => void;
    setWindowHideBehavior: (behavior: string) => void;
    setShowInTaskbar: (show: boolean) => void;
    requestClipboardHistory: () => void;
    clearClipboardHistory: () => void;
    toggleItemPinned: (id: number, pinned: boolean) => void;
    setBackupSettings: (settings: { enableBackups: boolean; backupInterval: number; maxBackups: number }) => void;
    setNotifications: (enabled: boolean) => void;
    setStartWithSystem: (enabled: boolean) => void;
    createBackup: () => Promise<string>;
    listBackups: () => Promise<{ file: string; time: number; size: number }[]>;
    restoreBackup: (file: string) => Promise<boolean>;
    deleteBackup: (file: string) => Promise<boolean>;
    renameBackup: (file: string, newLabel: string) => Promise<{ ok: boolean; file?: string; error?: string }>;
    deleteMultipleBackups: (files: string[]) => Promise<number>;
    exportFileDialog: (options: {
        data: string | Uint8Array;
        defaultName: string;
        filters?: { name: string; extensions: string[] }[];
    }) => Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
    importFileDialog: (options?: {
        filters?: { name: string; extensions: string[] }[];
    }) => Promise<{ ok: boolean; canceled?: boolean; name?: string; data?: Uint8Array; error?: string }>;
    exportDbDialog: () => Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
    importDbDialog: () => Promise<{ ok: boolean; canceled?: boolean; error?: string }>;
    deleteClipboardItem: (id: number) => void;
    trimClipboardItems: (maxItems: number) => Promise<boolean>;
    onForceRefresh: (callback: () => void) => (() => void) | void;
    onWindowWillShow: (callback: () => void) => (() => void) | void;
    setGlobalShortcut: (shortcut: string) => void;
    quitApp: () => void;
    onSaveSettingsBeforeQuit?: (callback: () => void) => (() => void) | void;
    setWinVOverride: (enabled: boolean) => void;
    setBackendShortcut: (shortcut: string) => void;
    restartApp: () => void;
    openExternal: (url: string) => void;
    saveSettingsToFile: (settings: any) => void;
    getThemeConfig: () => Promise<ThemeConfig>;
    getThemeSchema: () => Promise<ThemeSchema>;
    saveThemeConfig: (config: ThemeConfig) => Promise<ThemeConfig>;
    reloadThemeConfig: () => Promise<ThemeConfig>;
    exportThemeConfig: () => Promise<string>;
    getThemePaths: () => Promise<{ configPath: string; schemaPath: string }>;
    openThemeConfigFile: () => Promise<{ ok: boolean; error?: string; path?: string }>;
    getSettingsPaths: () => Promise<{ configPath: string; schemaPath: string }>;
    openSettingsConfigFile: () => Promise<{ ok: boolean; error?: string; path?: string }>;
    reloadSettingsFromDisk: () => Promise<any>;
    getSettings: () => Promise<any>;
    getStartupNotices: () => Promise<{ type: 'info' | 'error'; message: string }[]>;
    unpinAllItems: () => Promise<number>;
    createThemeProfile: (profileName: string) => Promise<ThemeConfig>;
    deleteThemeProfile: (profileKey: string) => Promise<ThemeConfig>;
    setActiveThemeProfile: (profileKey: string) => Promise<ThemeConfig>;
    onThemeConfigUpdated: (callback: (data: ThemeConfig) => void) => (() => void) | void;
    auth: {
        getState: () => Promise<AuthState>;
        login: () => Promise<AuthState>;
        cancelLogin: () => Promise<boolean>;
        logout: () => Promise<AuthState>;
        onChanged: (callback: (state: AuthState) => void) => (() => void) | void;
    };
    sync: {
        getStatus: () => Promise<SyncStatusView>;
        setEnabled: (enabled: boolean) => Promise<SyncStatusView>;
        setupPassphrase: (passphrase: string) => Promise<SyncActionResult>;
        resetPassphrase: (passphrase: string) => Promise<SyncActionResult>;
        now: () => Promise<{ pushed: number; pulled: number; error?: string }>;
        lock: () => Promise<SyncStatusView>;
        backupNow: () => Promise<{ ok: boolean; error?: string }>;
        listBackups: () => Promise<CloudBackupView[]>;
        restoreBackup: (id: string) => Promise<{ ok: boolean; error?: string }>;
        deleteBackup: (id: string) => Promise<{ ok: boolean; error?: string }>;
        renameBackup: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>;
        /** Main pushes status changes; `usage` is absent (fetch via getStatus). */
        onStatus: (callback: (status: SyncStatusView) => void) => (() => void) | void;
    };
    isDevelopment: () => boolean;
}

interface CloudBackupView {
    id: string;
    deviceName: string | null;
    sizeBytes: number;
    createdAt: string;
}

interface SyncUsageView {
    bytesUsed: number;
    clipCount: number;
    limits: { storageBytes: number; maxClips: number };
}

interface SyncStatusView {
    enabled: boolean;
    unlocked: boolean;
    lastSync: number | null;
    lastError: string | null;
    syncing: boolean;
    /** Device-registration problem (e.g. device limit reached). Not Pro-gated. */
    deviceError: string | null;
    usage?: SyncUsageView | null;
}

interface SyncActionResult {
    ok: boolean;
    error?: string;
    status: SyncStatusView;
}

interface Window {
    electronAPI: ElectronAPI;
}

declare var window: Window;
