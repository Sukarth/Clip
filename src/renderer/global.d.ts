// Type definitions for Electron contextBridge API exposed in preload.js
type ThemeConfig = import('../theme-config').ThemeConfig;
type ThemeSchema = Record<string, unknown>;

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
    listBackups: () => Promise<{ file: string; time: number }[]>;
    restoreBackup: (file: string) => Promise<boolean>;
    deleteBackup: (file: string) => Promise<boolean>;
    deleteMultipleBackups: (files: string[]) => Promise<number>;
    exportDb: () => Promise<Uint8Array>;
    importDb: (buffer: ArrayBuffer) => Promise<boolean>;
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
    createThemeProfile: (profileName: string) => Promise<ThemeConfig>;
    deleteThemeProfile: (profileKey: string) => Promise<ThemeConfig>;
    setActiveThemeProfile: (profileKey: string) => Promise<ThemeConfig>;
    onThemeConfigUpdated: (callback: (data: ThemeConfig) => void) => (() => void) | void;
    isDevelopment: () => boolean;
}

interface Window {
    electronAPI: ElectronAPI;
}

declare var window: Window;
