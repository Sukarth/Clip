export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    isFadingOut?: boolean;
}

export interface ClipboardItem {
    id: string;
    type: 'text' | 'image';
    content: string;
    timestamp: number;
    pinned?: boolean;
    isTemporary?: boolean;
}

export interface Settings {
    maxItems: number;
    windowHideBehavior: 'hide' | 'tray';
    showInTaskbar: boolean;
    enableBackups: boolean;
    backupInterval: number;
    maxBackups: number;
    borderRadius: number;
    transparency: number;
    accentColor: string;
    theme: 'dark' | 'light' | 'system';
    showNotifications: boolean;
    startWithSystem: boolean;
    storeImagesInClipboard: boolean;
    pinFavoriteItems: boolean;
    deleteConfirm: boolean;
    globalShortcut: string;
    windowWidth: number;
    windowHeight: number;
}

export interface BackupEntry {
    file: string;
    time: number;
}
