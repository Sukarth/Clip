const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    hideWindow: () => ipcRenderer.send('hide-window'),
    restorePreviousWindow: () => ipcRenderer.send('restore-previous-window'),
    onClipboardItem: (callback) => ipcRenderer.on('clipboard-item', (_event, data) => callback(data)),
    onClipboardHistory: (callback) => ipcRenderer.on('clipboard-history', (_event, data) => callback(data)),
    requestClipboardHistory: () => ipcRenderer.send('request-clipboard-history'),
    clearClipboardHistory: () => ipcRenderer.send('clear-clipboard-history'),
    toggleItemPinned: (id, pinned) => ipcRenderer.send('toggle-item-pinned', { id, pinned }),
    pasteClipboardItem: (item) => {
        console.log('[preload] pasteClipboardItem called', item);
        ipcRenderer.send('paste-clipboard-item', item);
    },
    setWindowHideBehavior: (behavior) => ipcRenderer.send('set-window-hide-behavior', behavior),
    setShowInTaskbar: (show) => ipcRenderer.send('set-show-in-taskbar', show),
    setBackupSettings: (settings) => ipcRenderer.send('set-backup-settings', settings),
    setNotifications: (enabled) => ipcRenderer.send('set-notifications', enabled),
    setStartWithSystem: (enabled) => ipcRenderer.send('set-start-with-system', enabled),
    createBackup: () => ipcRenderer.invoke('create-backup'),
    listBackups: () => ipcRenderer.invoke('list-backups'),
    restoreBackup: (file) => ipcRenderer.invoke('restore-backup', file),
    deleteBackup: (file) => ipcRenderer.invoke('delete-backup', file),
    deleteMultipleBackups: (files) => ipcRenderer.invoke('delete-multiple-backups', files),
    exportDb: () => ipcRenderer.invoke('export-db'),
    importDb: (buffer) => ipcRenderer.invoke('import-db', buffer),
    deleteClipboardItem: (id) => ipcRenderer.send('delete-clipboard-item', id),
    trimClipboardItems: (maxItems) => ipcRenderer.invoke('trim-clipboard-items', maxItems),
    onForceRefresh: (callback) => ipcRenderer.on('force-refresh', callback),
    setGlobalShortcut: (shortcut) => ipcRenderer.send('set-global-shortcut', shortcut),
    quitApp: () => ipcRenderer.send('quit-app'),
    onSaveSettingsBeforeQuit: (callback) => ipcRenderer.on('save-settings-before-quit', callback),
    setWinVOverride: (enabled) => ipcRenderer.send('set-win-v-override', enabled),
    setBackendShortcut: (shortcut) => ipcRenderer.send('set-backend-shortcut', shortcut),
    restartApp: () => ipcRenderer.send('restart-app'),
    saveSettingsToFile: (settings) => ipcRenderer.send('save-settings-to-file', settings),
    isDevelopment: () => {
        // Check multiple indicators for development mode
        return !!(
            process.env.NODE_ENV === 'development' ||
            process.defaultApp ||
            window.location.href.includes('localhost') ||
            window.location.href.includes('127.0.0.1') ||
            window.location.href.includes('file://')
        );
    },
});


