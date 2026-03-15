const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    hideWindow: () => ipcRenderer.send('hide-window'),
    restorePreviousWindow: () => ipcRenderer.send('restore-previous-window'),
    onClipboardItem: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('clipboard-item', listener);
        return () => ipcRenderer.removeListener('clipboard-item', listener);
    },
    onClipboardHistory: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('clipboard-history', listener);
        return () => ipcRenderer.removeListener('clipboard-history', listener);
    },
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
    onForceRefresh: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('force-refresh', listener);
        return () => ipcRenderer.removeListener('force-refresh', listener);
    },
    onWindowWillShow: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('window-will-show', listener);
        return () => ipcRenderer.removeListener('window-will-show', listener);
    },
    setGlobalShortcut: (shortcut) => ipcRenderer.send('set-global-shortcut', shortcut),
    quitApp: () => ipcRenderer.send('quit-app'),
    onSaveSettingsBeforeQuit: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('save-settings-before-quit', listener);
        return () => ipcRenderer.removeListener('save-settings-before-quit', listener);
    },
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
            window.location.href.includes('127.0.0.1')
        );
    },
});


