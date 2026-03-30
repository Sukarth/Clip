import type { CSSProperties } from 'react';
import { WINDOW_SIZE_LIMITS } from '../theme-config';
import type { Settings } from './app-types';

export const BACKUP_INTERVALS = [
    { label: '5 minutes', value: 5 * 60 * 1000 },
    { label: '15 minutes', value: 15 * 60 * 1000 },
    { label: '1 hour', value: 60 * 60 * 1000 },
    { label: '1 day', value: 24 * 60 * 60 * 1000 },
] as const;

export const MAX_ITEMS_DEFAULT = 100;

export const DEFAULT_SETTINGS: Settings = {
    maxItems: MAX_ITEMS_DEFAULT,
    windowHideBehavior: 'hide',
    showInTaskbar: false,
    enableBackups: false,
    backupInterval: BACKUP_INTERVALS[1].value,
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

export const MODIFIER_OPTIONS = [
    { label: 'Ctrl', value: 'Control' },
    { label: 'Shift', value: 'Shift' },
    { label: 'Alt', value: 'Alt' },
    { label: 'Windows', value: 'Windows' },
] as const;

export const MAIN_KEY_OPTIONS = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((k) => ({ label: k, value: k })),
    ...Array.from({ length: 10 }, (_, i) => ({ label: String(i), value: String(i) })),
    { label: 'Space', value: 'Space' },
    { label: 'Tab', value: 'Tab' },
    { label: 'Esc', value: 'Escape' },
    { label: 'Insert', value: 'Insert' },
    { label: 'Delete', value: 'Delete' },
    { label: 'Home', value: 'Home' },
    { label: 'End', value: 'End' },
    { label: 'PageUp', value: 'PageUp' },
    { label: 'PageDown', value: 'PageDown' },
    { label: 'Up', value: 'ArrowUp' },
    { label: 'Down', value: 'ArrowDown' },
    { label: 'Left', value: 'ArrowLeft' },
    { label: 'Right', value: 'ArrowRight' },
] as const;

export const sectionHeaderStyle: CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    color: '#ccc',
    marginBottom: 12,
    borderBottom: '1px solid #555',
    paddingBottom: 4,
};

export const subHeaderStyle: CSSProperties = {
    fontSize: 16,
    fontWeight: 500,
    color: '#aaa',
    marginTop: 8,
    marginBottom: 8,
};
