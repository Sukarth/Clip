// Type definitions for Electron contextBridge API exposed in preload.js
interface ElectronAPI {
    hideWindow: () => void;
    onClipboardItem: (callback: (data: any) => void) => void;
    onClipboardHistory: (callback: (data: any) => void) => void;
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
    exportDb: () => Promise<Uint8Array>;
    importDb: (buffer: ArrayBuffer) => Promise<boolean>;
    deleteClipboardItem: (id: number) => void;
    onForceRefresh: (callback: () => void) => void;
    setGlobalShortcut: (shortcut: string) => void;
    quitApp: () => void;
    onSaveSettingsBeforeQuit?: (callback: () => void) => void;
    setWinVOverride: (enabled: boolean) => void;
    setBackendShortcut: (shortcut: string) => void;
    restartApp: () => void;
}

interface Window {
    electronAPI: ElectronAPI;
}

declare var window: Window;
