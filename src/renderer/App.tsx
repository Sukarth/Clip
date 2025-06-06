import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import Fuse from 'fuse.js';
import ThemeProvider from './ThemeProvider';
import { log, logger, isDev } from '../logger';

// Toast notification type
interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    isFadingOut?: boolean; // Added for controlled animation
}

interface ClipboardItem {
    id: string;
    type: 'text' | 'image';
    content: string;
    timestamp: number;
    pinned?: boolean;
}

interface Settings {
    maxItems: number;
    windowHideBehavior: 'hide' | 'tray';
    showInTaskbar: boolean;
    enableBackups: boolean;
    backupInterval: number; // ms
    maxBackups: number;

    // Visual Settings
    borderRadius: number;
    transparency: number;
    accentColor: string;
    theme: 'dark' | 'light' | 'system';

    // Behavior Settings
    showNotifications: boolean;
    startWithSystem: boolean;
    storeImagesInClipboard: boolean;
    pinFavoriteItems: boolean;
    deleteConfirm: boolean;

    // Shortcut
    globalShortcut: string;
}

const BACKUP_INTERVALS = [
    { label: '5 minutes', value: 5 * 60 * 1000 },
    { label: '15 minutes', value: 15 * 60 * 1000 },
    { label: '1 hour', value: 60 * 60 * 1000 },
    { label: '1 day', value: 24 * 60 * 60 * 1000 },
];

const MAX_ITEMS_DEFAULT = 100;

const DEFAULT_SETTINGS: Settings = {
    maxItems: MAX_ITEMS_DEFAULT,
    windowHideBehavior: 'hide',
    showInTaskbar: false,
    enableBackups: false,
    backupInterval: BACKUP_INTERVALS[1].value, // 15 min default
    maxBackups: 5,

    // Visual Settings defaults
    borderRadius: 18,
    transparency: 0.95,
    accentColor: '#4682b4', // Steel Blue - professional, calm
    theme: 'dark',

    // Behavior Settings defaults
    showNotifications: false,
    startWithSystem: true,
    storeImagesInClipboard: true,
    pinFavoriteItems: true,
    deleteConfirm: true,

    // Shortcut
    globalShortcut: 'Control+Shift+V',
};

const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    color: '#ccc',
    // marginTop: 24,
    marginBottom: 12,
    borderBottom: '1px solid #555',
    paddingBottom: 4,
};

const subHeaderStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 500,
    color: '#aaa',
    marginTop: 8,
    marginBottom: 8,
    // paddingLeft: 12,
};

// Switch component for modern toggles
const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; accentColor?: string }> = ({ checked, onChange, disabled, accentColor = '#2ecc40' }) => (
    <span
        style={{
            display: 'inline-block',
            width: 38,
            height: 22,
            borderRadius: 22,
            background: checked ? accentColor : '#444',
            position: 'relative',
            transition: 'background 0.2s',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            verticalAlign: 'middle',
        }}
        onClick={() => !disabled && onChange(!checked)}
        tabIndex={0}
        role="switch"
        aria-checked={checked}
    >
        <span
            style={{
                position: 'absolute',
                left: checked ? 18 : 2,
                top: 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px #0002',
                transition: 'left 0.2s ease, background 0.2s ease',
            }}
        />
    </span>
);

// Add custom CSS for custom sliders that use the accent color
const getSliderStyles = (accentColor: string) => `
    /* Slider style for webkit browsers (Chrome, Safari, Edge) */
    input[type="range"]::-webkit-slider-runnable-track {
        background: #333;
        height: 4px;
        border-radius: 2px;
    }
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: ${accentColor} !important;
        cursor: pointer;
        margin-top: -7px;
        border: none;
        transition: transform 0.15s ease, background-color 0.15s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.1);
        background: ${accentColor} !important;
    }

    /* Firefox styles */
    input[type="range"]::-moz-range-track {
        background: #333;
        height: 4px;
        border-radius: 2px;
        border: none;
    }
    input[type="range"]::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: ${accentColor} !important;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        transition: transform 0.15s ease, background-color 0.15s ease;
    }
    input[type="range"]::-moz-range-thumb:hover {
        transform: scale(1.1);
        background: ${accentColor} !important;
    }
`;

// Old code - keeping for reference but not used
const getCustomRangeStyles = (accentColor: string) => ({
    // Style the track
    '::-webkit-slider-runnable-track': {
        background: '#333',
        height: '4px',
        borderRadius: '2px',
    },
    // Style the thumb
    '::-webkit-slider-thumb': {
        appearance: 'none',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: accentColor,
        border: 'none',
        cursor: 'pointer',
        marginTop: '-7px',
        transition: 'transform 0.15s ease',
    },
    // Firefox specific styles
    '::-moz-range-track': {
        background: '#333',
        height: '4px',
        borderRadius: '2px',
        border: 'none',
    },
    '::-moz-range-thumb': {
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: accentColor,
        border: 'none',
        cursor: 'pointer',
        boxShadow: 'none',
        transition: 'transform 0.15s ease',
    },
});

// Pin SVGs
const PinIcon: React.FC<{ pinned: boolean }> = ({ pinned }) => (
    pinned ? (
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="rotate(90 12 12)">
                <path d="m14.579 14.579-2.947 2.947-.864-.863c-.39-.39-.61-.92-.61-1.474v-2.084L7.21 10.158 5 9.421 9.421 5l.737 2.21 2.947 2.948h2.084c.553 0 1.083.22 1.474.61l.863.864zm0 0L19 19" stroke="#888" fill="#888" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </svg>
    ) : (
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="rotate(90 12 12)">
                <path d="m14.579 14.579-2.947 2.947-.864-.863c-.39-.39-.61-.92-.61-1.474v-2.084L7.21 10.158 5 9.421 9.421 5l.737 2.21 2.947 2.948h2.084c.553 0 1.083.22 1.474.61l.863.864zm0 0L19 19" stroke="#888" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </svg>
    )
);

// Dustbin SVG
const DustbinIcon: React.FC = () => (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="7.5" width="14" height="11" rx="2.5" stroke="#888" strokeWidth="1.5" fill="none" />
        <rect x="9" y="3" width="6" height="3" rx="1.5" stroke="#888" strokeWidth="1.5" fill="none" />
        <path d="M3 7.5h18" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 11v4" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 11v4" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// --- Modern shortcut input (checkboxes for modifiers + text for main key) ---
const MODIFIER_OPTIONS = [
    { label: 'Ctrl', value: 'Control' },
    { label: 'Shift', value: 'Shift' },
    { label: 'Alt', value: 'Alt' },
    { label: 'Windows', value: 'Super' },
];
const MAIN_KEY_OPTIONS = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(k => ({ label: k, value: k })),
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
];

// For transparency to show as hex with percentage
const transparencyToHex = (value: number): string => {
    return Math.round(value * 255).toString(16).padStart(2, '0');
};

// Helper function to format relative time
const getRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''} ago`;
};

// Toast notification component
const Toast: React.FC<{
    message: ToastMessage;
    onDismiss: (id: string, type: 'manual' | 'auto') => void; // Updated signature
    accentColor?: string;
}> = ({ message, onDismiss, accentColor = '#2ecc40' }) => {
    // const [isRemoving, setIsRemoving] = useState(false); // Local animation state removed, driven by prop

    // Auto-dismissal logic and animation triggering are now fully handled by the App component.
    // This Toast component is now more presentational regarding its dismissal.

    let bgColor = '';
    let textColor = '#fff';
    let icon = '💬';

    switch (message.type) {
        case 'success':
            bgColor = accentColor;
            icon = '✅';
            break;
        case 'error':
            bgColor = '#ff4136';
            icon = '❌';
            break;
        case 'info':
            bgColor = '#0074D9';
            icon = 'ℹ️';
            break;
    }

    const handleManualDismiss = () => {
        // Call the onDismiss prop (which is dismissToast from App) with 'manual' type
        onDismiss(message.id, 'manual');
    };

    return (
        <div
            className={`toast-message ${message.isFadingOut ? 'removing' : ''}`}
            onClick={handleManualDismiss}
            style={{
                background: bgColor,
                color: textColor,
                padding: '10px 16px',
                borderRadius: 8,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                maxWidth: '90%',
                gap: 8,
                willChange: 'transform, opacity',
            }}
        >
            <span style={{ fontSize: 18, marginRight: 4 }}>{icon}</span>
            <span>{message.message}</span>
        </div>
    );
};

const App: React.FC = () => {
    const [items, setItems] = useState<ClipboardItem[]>([]);
    const [settings, setSettings] = useState<Settings>(() => {
        const saved = localStorage.getItem('clip-settings');
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    });
    const toastIdCounter = useRef(0); // For unique toast IDs
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isWindowFocused, setIsWindowFocused] = useState(document.hasFocus()); // Track window focus state
    const [isAnimatingList, setIsAnimatingList] = useState(true); // Track if list should animate
    const [listKey, setListKey] = useState(0); // Key to trigger list remounting for animations
    const [hasLoadedInitially, setHasLoadedInitially] = useState(false); // Track if we've loaded items at least once
    const [showEmptyMessage, setShowEmptyMessage] = useState(false); // Control when to show empty message
    const [isDataLoading, setIsDataLoading] = useState(false); // Track if we're currently loading data
    const [isInitialLoading, setIsInitialLoading] = React.useState(true); // Track only the very first load

    // High-performance persistent cache system
    const [itemsCache, setItemsCache] = useState<ClipboardItem[]>([]);
    const [isCacheLoaded, setIsCacheLoaded] = useState(false);
    const [lastCacheUpdate, setLastCacheUpdate] = useState(0);
    const cacheValidDuration = 30000; // 30 seconds cache validity

    // Restore settings modal state and draft from localStorage
    const [showSettings, setShowSettings] = useState(() => localStorage.getItem('clip-showSettings') === 'true');
    const [settingsDraft, setSettingsDraft] = useState<Settings | null>(() => {
        const draft = localStorage.getItem('clip-settingsDraft');
        return draft ? JSON.parse(draft) : null;
    });
    const inputRef = useRef<HTMLInputElement>(null); // Ref for search input

    // Track if there are unsaved changes in settings
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Update hasUnsavedChanges whenever settingsDraft changes
    useEffect(() => {
        if (settingsDraft && settings) {
            // Compare settings and settingsDraft to see if there are any differences
            const isDifferent = JSON.stringify(settingsDraft) !== JSON.stringify(settings);
            setHasUnsavedChanges(isDifferent);
        } else {
            setHasUnsavedChanges(false);
        }
    }, [settingsDraft, settings]);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const escListener = useRef<((e: KeyboardEvent) => void) | null>(null);
    const settingsModalRef = useRef<HTMLDivElement>(null); const [search, setSearch] = useState('');
    const [filteredType, setFilteredType] = useState<'all' | 'text' | 'image'>('all');

    const [isClosingSettings, setIsClosingSettings] = useState(false);
    // Settings panel fade state
    const [isSettingsDialogClosing, setIsSettingsDialogClosing] = useState(false);

    // Danger Area state
    const [dangerAction, setDangerAction] = useState<null | 'clear' | 'reset'>(null);
    // Danger Area confirmation popup fade state
    const [isDangerDialogClosing, setIsDangerDialogClosing] = useState(false);
    const [restartReason, setRestartReason] = useState<'import' | 'restore' | null>(null); // For custom restart message
    const [isRestartDialogClosing, setIsRestartDialogClosing] = useState(false);
    const [isUnsavedChangesDialogClosing, setIsUnsavedChangesDialogClosing] = useState(false);

    // --- Modern shortcut input state ---
    const [shortcutModifiers, setShortcutModifiers] = useState<string[]>(() => {
        const shortcut = settingsDraft?.globalShortcut ?? settings.globalShortcut;
        return shortcut.split('+').filter(k => MODIFIER_OPTIONS.some(opt => opt.value.toLowerCase() === k.toLowerCase()));
    });
    const [shortcutMainKey, setShortcutMainKey] = useState<string>(() => {
        const shortcut = settingsDraft?.globalShortcut ?? settings.globalShortcut;
        const parts = shortcut.split('+');
        return parts[parts.length - 1] || '';
    });
    // Keep shortcutModifiers and shortcutMainKey in sync with settingsDraft/globalShortcut
    useEffect(() => {
        const shortcut = settingsDraft?.globalShortcut ?? settings.globalShortcut;
        const parts = shortcut.split('+');
        setShortcutModifiers(parts.slice(0, -1));
        setShortcutMainKey(parts[parts.length - 1] || '');
    }, [settingsDraft?.globalShortcut, settings.globalShortcut]);
    // Compose shortcut string and update settingsDraft
    useEffect(() => {
        const composed = [...shortcutModifiers, shortcutMainKey].filter(Boolean).join('+');
        setSettingsDraft(s => s ? { ...s, globalShortcut: composed } : null);
    }, [shortcutModifiers, shortcutMainKey]);

    // Handle system theme changes
    const handleSystemThemeChange = () => {
        // Force re-render when system theme changes (when using 'system' theme setting)
        // if (settings.theme === 'system') {
        setSettings({ ...settings });
        // }
    };

    const requestCloseSettings = () => {
        setIsClosingSettings(true);
    };

    // --- Shortcut warning logic ---
    const [showShortcutInfo, setShowShortcutInfo] = useState(false);
    const shortcutValue = settingsDraft?.globalShortcut ?? settings.globalShortcut;
    const shortcutHasWindows = /\b(Win|Windows|Super|Meta)\b/i.test(shortcutValue);

    // --- Backup restore dropdown state ---
    const [backupList, setBackupList] = useState<{ file: string; time: number }[]>([]);
    const [selectedBackup, setSelectedBackup] = useState<string>('');

    // --- Backup selection and deletion state ---
    const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set());
    const [showBackupManagement, setShowBackupManagement] = useState(false);
    const [backupDeleteAction, setBackupDeleteAction] = useState<'single' | 'multiple' | null>(null);
    const [backupToDelete, setBackupToDelete] = useState<string>('');
    const [isBackupDeleteDialogClosing, setIsBackupDeleteDialogClosing] = useState(false);
    useEffect(() => {
        if (showSettings) {
            window.electronAPI?.listBackups?.().then(list => setBackupList(list || []));
        }
    }, [showSettings]);

    // Refresh backup list periodically
    useEffect(() => {
        const refreshBackupList = async () => {
            if (showSettings) {
                const list = await window.electronAPI?.listBackups?.();
                if (list) {
                    setBackupList(list);
                }
            }
        };

        const intervalId = setInterval(refreshBackupList, 2000);
        return () => clearInterval(intervalId);
    }, [showSettings]);

    // Toast notification helpers
    const showToast = (type: 'success' | 'error' | 'info', messageText: string) => {
        toastIdCounter.current += 1;
        const id = `toast-${toastIdCounter.current}`;
        const newToast: ToastMessage = { id, type, message: messageText, isFadingOut: false }; // Initialize isFadingOut
        setToasts(prev => [...prev, newToast]);

        // If too many toasts (more than 3), remove the oldest ones
        setTimeout(() => {
            setToasts(currentToasts => {
                if (currentToasts.length > 3) {
                    return currentToasts.slice(currentToasts.length - 3);
                }
                return currentToasts;
            });
        }, 100);
    };

    const toastTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

    const dismissToast = useCallback((id: string, type: 'manual' | 'auto') => {
        // Start fading out animation
        setToasts(prevToasts =>
            prevToasts.map(toast =>
                toast.id === id ? { ...toast, isFadingOut: true } : toast
            )
        );

        // Clear the main 3-second auto-dismiss timer if it exists for this toast
        if (toastTimersRef.current[id]) {
            clearTimeout(toastTimersRef.current[id]);
            delete toastTimersRef.current[id];
        }

        // After animation duration, actually remove the toast
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300); // Corresponds to animation duration
    }, [setToasts]); // setToasts is stable

    useEffect(() => {
        const newTimers: Record<string, NodeJS.Timeout> = { ...toastTimersRef.current };

        toasts.forEach(toast => {
            if (!toast.isFadingOut && !newTimers[toast.id]) {
                // If not already fading out and no timer exists, set one.
                newTimers[toast.id] = setTimeout(() => {
                    dismissToast(toast.id, 'auto');
                }, 3000); // Start dismissal process after 3 seconds
            } else if (toast.isFadingOut && newTimers[toast.id]) {
                // If it started fading out but still had a 3s timer, clear it.
                clearTimeout(newTimers[toast.id]);
                delete newTimers[toast.id];
            }
        });

        // Clear timers for toasts that no longer exist
        Object.keys(newTimers).forEach(toastId => {
            if (!toasts.some(t => t.id === toastId)) {
                clearTimeout(newTimers[toastId]);
                delete newTimers[toastId];
            }
        });

        toastTimersRef.current = newTimers;

        // Cleanup on unmount - clear all managed timers
        return () => {
            Object.values(toastTimersRef.current).forEach(clearTimeout);
            toastTimersRef.current = {};
        };
    }, [toasts, dismissToast]);

    // Reset animation state after animations complete
    useEffect(() => {
        if (isAnimatingList) {
            const timeout = setTimeout(() => {
                setIsAnimatingList(false);
            }, 400); // Allow time for all animations to complete (400ms duration)
            return () => clearTimeout(timeout);
        }
    }, [isAnimatingList]);

    // Control when to show empty message - only after we've had time to load and if truly empty
    useEffect(() => {
        if (hasLoadedInitially && items.length === 0) {
            const timer = setTimeout(() => {
                setShowEmptyMessage(true);
            }, 800); // Wait 800ms before showing empty message
            return () => clearTimeout(timer);
        } else {
            setShowEmptyMessage(false);
        }
    }, [hasLoadedInitially, items.length]);

    const clearAllToasts = () => {
        // Mark all toasts for fading out
        setToasts(prevToasts =>
            prevToasts.map(toast => ({ ...toast, isFadingOut: true }))
        );

        // Clear all active 3s auto-dismiss timers
        Object.values(toastTimersRef.current).forEach(clearTimeout);
        toastTimersRef.current = {};

        // Actually remove them after animation completes
        setTimeout(() => {
            setToasts([]);
        }, 300); // Animation duration
    };

    // Add loading state for backup operation
    const [isBackingUp, setIsBackingUp] = useState(false);

    // Fuse.js setup
    const fuse = React.useMemo(() => new Fuse(items, {
        keys: [
            {
                name: 'content',
                weight: 1.0,
            },
        ],
        threshold: 0.38, // smart fuzzy
        ignoreLocation: true,
        minMatchCharLength: 2,
        isCaseSensitive: false,
    }), [items]);

    const filteredItems = React.useMemo(() => {
        let result = items;
        if (search.trim().length > 0) {
            result = fuse.search(search).map(r => r.item);
        }
        if (filteredType !== 'all') {
            result = result.filter(i => i.type === filteredType);
        }

        // Sort the items - pinned items first, then by timestamp
        return result.sort((a, b) => {
            // First compare pinned status
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            // Then sort by timestamp (newest first)
            return b.timestamp - a.timestamp;
        });
    }, [items, search, filteredType, fuse]);

    // Track if the clipboard list is scrollable via a sentinel IntersectionObserver
    const listRef = useRef<HTMLDivElement>(null);
    // Detect if vertical scrollbar is present to adjust right padding
    const [hasScrollbar, setHasScrollbar] = useState(false);
    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        // Function to check if vertical scrollbar is present
        const updateScrollbarPresence = () => {
            const hasScroll = el.scrollHeight > el.clientHeight;
            log.renderer(`Scrollbar check: scrollHeight=${el.scrollHeight}, clientHeight=${el.clientHeight}, hasScroll=${hasScroll}, items=${items.length}, filtered=${filteredItems.length}, animating=${isAnimatingList}`);
            setHasScrollbar(hasScroll);
        };

        // Delayed check to ensure DOM has updated after item changes
        const delayedCheck = () => {
            setTimeout(() => {
                log.renderer('Scrollbar delayed check triggered after 10ms');
                updateScrollbarPresence();
            }, 10);
        };

        // Initial check
        delayedCheck();
        // Observe size changes in the container
        const resizeObserver = new ResizeObserver(delayedCheck);
        resizeObserver.observe(el);
        // Also update on window resize
        window.addEventListener('resize', delayedCheck);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateScrollbarPresence);
        };
    }, [filteredItems.length, items.length, hasLoadedInitially]);    // Persist settings modal state and draft
    useEffect(() => {
        localStorage.setItem('clip-showSettings', showSettings ? 'true' : 'false');
    }, [showSettings]);
    useEffect(() => {
        if (settingsDraft) {
            localStorage.setItem('clip-settingsDraft', JSON.stringify(settingsDraft));
        } else {
            localStorage.removeItem('clip-settingsDraft');
        }
    }, [settingsDraft]);

    // Track if there are unsaved changes in settings
    useEffect(() => {
        if (settingsDraft && settings) {
            // Compare settings and settingsDraft to see if there are any differences
            const isDifferent = JSON.stringify(settingsDraft) !== JSON.stringify(settings);
            setHasUnsavedChanges(isDifferent);
        } else {
            setHasUnsavedChanges(false);
        }
    }, [settingsDraft, settings]);

    // Delete clipboard item
    const [deleteTarget, setDeleteTarget] = useState<ClipboardItem | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isDeleteDialogClosing, setIsDeleteDialogClosing] = useState(false);
    // Add state for restart confirmation dialog
    const [showRestartConfirm, setShowRestartConfirm] = useState(false);

    // Add state for unsaved changes confirmation dialog
    const [showUnsavedChangesConfirm, setShowUnsavedChangesConfirm] = useState<'cancel' | 'quit' | null>(null);

    // Add state for max items warning dialog
    const [showMaxItemsWarning, setShowMaxItemsWarning] = useState(false);
    const [pendingMaxItems, setPendingMaxItems] = useState<number | null>(null);
    const [isMaxItemsWarningClosing, setIsMaxItemsWarningClosing] = useState(false);
    const [backupCreated, setBackupCreated] = useState(false);
    const [maxItemsInputValue, setMaxItemsInputValue] = useState<number | null>(null);
    const [hasMaxItemsChanges, setHasMaxItemsChanges] = useState(false);
    useEffect(() => {
        const escHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showMaxItemsWarning) {
                    setIsMaxItemsWarningClosing(true);
                    setTimeout(() => {
                        setShowMaxItemsWarning(false);
                        setPendingMaxItems(null);
                        setBackupCreated(false); // Reset backup status
                        setMaxItemsInputValue(null); // Reset input states
                        setHasMaxItemsChanges(false);
                        setIsMaxItemsWarningClosing(false);
                    }, 300);
                } else if (backupDeleteAction) {
                    setIsBackupDeleteDialogClosing(true);
                    setTimeout(() => {
                        setBackupDeleteAction(null);
                        setBackupToDelete('');
                        setIsBackupDeleteDialogClosing(false);
                    }, 300);
                } else if (showUnsavedChangesConfirm) {
                    setIsUnsavedChangesDialogClosing(true);
                    setTimeout(() => {
                        setShowUnsavedChangesConfirm(null);
                        setIsUnsavedChangesDialogClosing(false);
                    }, 300);
                } else if (showRestartConfirm) {
                    setIsRestartDialogClosing(true);
                    setTimeout(() => {
                        setShowRestartConfirm(false);
                        setRestartReason(null); // Reset reason
                        setIsRestartDialogClosing(false);
                    }, 300);
                } else if (dangerAction) {
                    setIsDangerDialogClosing(true);
                    setTimeout(() => {
                        setDangerAction(null);
                        setIsDangerDialogClosing(false);
                    }, 300);
                } else if (deleteTarget) {
                    setIsDeleteDialogClosing(true);
                    setTimeout(() => {
                        setDeleteTarget(null);
                        setIsDeleteDialogClosing(false);
                    }, 300);
                } else if (showResetConfirm) {
                    setShowResetConfirm(false);
                } else if (showSettings) {
                    if (hasUnsavedChanges) {
                        setShowUnsavedChangesConfirm('cancel');
                    } else {
                        setIsSettingsDialogClosing(true);
                        setTimeout(() => {
                            setShowSettings(false);
                            setSettingsDraft(null);
                            setIsSettingsDialogClosing(false);
                        }, 300);
                    }
                } else {
                    // @ts-ignore
                    window.electronAPI?.hideWindow();
                }
            }
        };
        window.addEventListener('keydown', escHandler);
        return () => window.removeEventListener('keydown', escHandler);
    }, [showMaxItemsWarning, isMaxItemsWarningClosing, dangerAction, isDangerDialogClosing, showResetConfirm, showSettings, isSettingsDialogClosing, deleteTarget, showRestartConfirm, restartReason, isRestartDialogClosing, showUnsavedChangesConfirm, hasUnsavedChanges, backupDeleteAction, isBackupDeleteDialogClosing]);

    // Force refresh when Ctrl+Shift+V is pressed (global shortcut)
    // This effect is now primarily for development/debugging if needed,
    // as visibility/focus handlers are the main triggers for refresh.
    // useEffect(() => {
    //     const handleShortcut = (e: KeyboardEvent) => {
    //         if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
    //             // Potentially set isAnimatingList true here if this shortcut is a primary way to show window
    //             // setIsAnimatingList(true);
    //             // setVisibilityKey(k => k + 1);
    //             window.electronAPI?.requestClipboardHistory?.();
    //         }
    //     };
    //     window.addEventListener('keydown', handleShortcut);
    //     return () => window.removeEventListener('keydown', handleShortcut);
    // }, []);

    // Listen for 'force-refresh' event from main process and request clipboard history
    useEffect(() => {
        if (!window.electronAPI?.onForceRefresh) return;
        const handler = () => {
            window.electronAPI?.requestClipboardHistory?.();
        };
        window.electronAPI.onForceRefresh(handler);
        // No direct cleanup needed for removeListener with electronAPI,
        // but if it returned a cleanup function, it would be used here.
        return () => { /* window.electronAPI.offForceRefresh(handler); // If such API existed */ };
    }, [items.length]); // Depend on items.length to know if we need animation

    // Click-away to close clipboard window (when hide is selected)
    useEffect(() => {
        if (settings.windowHideBehavior !== 'hide') return;
        const handleClick = (e: MouseEvent) => {
            const root = document.querySelector('.clip-root');
            if (root && !root.contains(e.target as Node) && !showSettings) {
                // @ts-ignore
                window.electronAPI?.hideWindow();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [settings.windowHideBehavior, showSettings]);

    // Smart cache system for instant display when window shows
    const useCacheIfValid = useCallback(() => {
        const now = Date.now();
        const cacheAge = now - lastCacheUpdate;

        if (isCacheLoaded && cacheAge < cacheValidDuration && itemsCache.length > 0) {
            log.renderer(`Cache: Using valid cache (${cacheAge}ms old, ${itemsCache.length} items)`);
            setItems(itemsCache);
            setHasLoadedInitially(true);
            setIsDataLoading(false);

            // Force scrollbar detection after cache load
            setTimeout(() => {
                const el = listRef.current;
                if (el) {
                    const hasScroll = el.scrollHeight > el.clientHeight;
                    log.renderer(`Scrollbar cache load check: scrollHeight=${el.scrollHeight}, clientHeight=${el.clientHeight}, hasScroll=${hasScroll}`);
                    setHasScrollbar(hasScroll);
                }
            }, 50); // Slightly longer delay to ensure DOM is updated

            return true;
        }
        return false;
    }, [isCacheLoaded, lastCacheUpdate, cacheValidDuration, itemsCache]);

    // Enhanced clipboard history handler with persistent cache
    useEffect(() => {
        let isMounted = true;

        const handleHistory = (history: any[]) => {
            if (isMounted) {
                const processedItems = history.map((item: any) => ({ ...item, id: String(item.id) }));

                // Update cache immediately
                setItemsCache(processedItems);
                setLastCacheUpdate(Date.now());
                setIsCacheLoaded(true);

                // Update display items
                setItems(processedItems);
                setHasLoadedInitially(true);
                setIsDataLoading(false);

                // Only set isInitialLoading to false after the very first load
                setIsInitialLoading(false);

                log.renderer(`Cache: Updated cache with ${processedItems.length} items`);
            }
        };

        window.electronAPI?.onClipboardHistory(handleHistory);

        // Show welcome message on startup
        setTimeout(() => {
            showToast('info', 'Welcome to Clip! Your clipboard history is ready.');
        }, 1000);

        return () => { isMounted = false; };
    }, []);

    // Listen for new clipboard items and intelligently refresh cache
    useEffect(() => {
        const handler = () => {
            // Invalidate cache since we have new clipboard data
            setLastCacheUpdate(0); // Force cache refresh on next request

            // Request updated history
            window.electronAPI?.requestClipboardHistory?.();
        };
        window.electronAPI?.onClipboardItem(handler);
        return () => { };
    }, []);

    // Send backup settings to main process when settings change
    useEffect(() => {
        window.electronAPI?.setBackupSettings?.({
            enableBackups: settings.enableBackups,
            backupInterval: settings.backupInterval,
            maxBackups: settings.maxBackups,
        });
    }, [settings.enableBackups, settings.backupInterval, settings.maxBackups]);

    // Clear all clipboard items (send IPC to main, rely on main for update)
    const handleClearAll = () => {
        // Invalidate cache since we're clearing all data
        setLastCacheUpdate(0);
        setItemsCache([]);
        setIsCacheLoaded(false);

        window.electronAPI?.clearClipboardHistory?.();
        setDangerAction(null);
        showToast('success', 'Clipboard history cleared successfully');
    };

    // Send windowHideBehavior and showInTaskbar settings to main process
    useEffect(() => {
        window.electronAPI?.setWindowHideBehavior?.(settings.windowHideBehavior);
        window.electronAPI?.setShowInTaskbar?.(settings.showInTaskbar);
    }, [settings.windowHideBehavior, settings.showInTaskbar]);

    // Send notification settings to main process
    useEffect(() => {
        window.electronAPI?.setNotifications?.(settings.showNotifications);
    }, [settings.showNotifications]);

    // Send start with system settings to main process
    useEffect(() => {
        window.electronAPI?.setStartWithSystem?.(settings.startWithSystem);
    }, [settings.startWithSystem]);

    // Send updated shortcut to main process
    useEffect(() => {
        if (window.electronAPI?.setGlobalShortcut) {
            window.electronAPI.setGlobalShortcut(settings.globalShortcut);
        }
    }, [settings.globalShortcut]);

    // Paste clipboard item on click
    const handlePaste = (item: ClipboardItem) => {
        log.renderer('handlePaste called for item', item);
        // @ts-ignore
        window.electronAPI?.pasteClipboardItem(item);
    };

    // Pin/unpin a clipboard item
    function handleTogglePin(item: ClipboardItem) {
        // Invalidate cache since we're modifying data
        setLastCacheUpdate(0);

        // If item.id is a string, try to parse as number for DB
        const dbId = typeof item.id === 'number' ? item.id : parseInt(item.id, 10);
        if (!isNaN(dbId)) {
            window.electronAPI?.toggleItemPinned?.(dbId, !item.pinned);
            // Do not update local state; main will send updated history
        }
    }

    function handleDeleteItem(item: ClipboardItem) {
        if (settings.deleteConfirm) {
            setDeleteTarget(item);
            setIsDeleteDialogClosing(false);
        } else {
            confirmDelete(item);
        }
    }

    function confirmDelete(item: ClipboardItem) {
        setDeletingId(item.id);

        // Invalidate cache since we're modifying data
        setLastCacheUpdate(0);

        // Send delete request to main; main will reply with updated history
        // @ts-ignore
        window.electronAPI?.deleteClipboardItem?.(typeof item.id === 'number' ? item.id : parseInt(item.id, 10));
        // Close delete dialog after fade-out
        setIsDeleteDialogClosing(true);
        setTimeout(() => {
            setDeletingId(null);
            setIsDeleteDialogClosing(false);
            setDeleteTarget(null);
        }, 300); // match fade-out duration
    }

    // Handle fade-out for delete dialog
    const handleDeleteDialogClose = () => {
        setIsDeleteDialogClosing(true);
        setTimeout(() => {
            setDeleteTarget(null);
            setIsDeleteDialogClosing(false);
        }, 300); // match fade-out duration
    }    // Export/import settings logic
    const handleExportSettings = () => {
        const data = JSON.stringify(settings, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clip-settings.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('success', 'Settings exported successfully');
    }; const handleImportSettings = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev: any) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    if (imported && typeof imported === 'object') {
                        setSettingsDraft(s => ({ ...s, ...imported }));
                        showToast('success', 'Settings imported successfully');
                    } else {
                        showToast('error', 'Invalid settings file format');
                    }
                } catch (error) {
                    showToast('error', `Failed to parse settings file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };    // Settings modal logic
    const openSettings = () => {
        setSettingsDraft(settings);
        setShowSettings(true);
        setIsSettingsDialogClosing(false);
    };

    const saveSettings = () => {
        if (settingsDraft) {
            setSettings(settingsDraft);

            // Show toast notification for settings saved
            showToast('success', 'Settings saved successfully');

            // Persist settings immediately to localStorage
            localStorage.setItem('clip-settings', JSON.stringify(settingsDraft));

            // Also save to file for main process to read at startup
            window.electronAPI?.saveSettingsToFile?.(settingsDraft);
        }

        setIsSettingsDialogClosing(true);
        setTimeout(() => {
            setShowSettings(false); setSettingsDraft(null);
            setIsSettingsDialogClosing(false);
        }, 300);
    };

    const cancelSettings = () => {
        if (hasUnsavedChanges) {
            setShowUnsavedChangesConfirm('cancel');
        } else {
            closeSettingsWithoutSaving();
        }
    };

    const closeSettingsWithoutSaving = () => {
        setIsSettingsDialogClosing(true);
        setTimeout(() => {
            setShowSettings(false);
            setSettingsDraft(null);
            setIsSettingsDialogClosing(false);
        }, 300);
    }; const resetSettings = () => {
        setDangerAction(null);
        setSettings(DEFAULT_SETTINGS);
        // Update settings draft to reflect the default values
        setSettingsDraft(DEFAULT_SETTINGS);
        showToast('success', 'Settings reset to default values');
        // Close the settings window after successful reset
        setIsSettingsDialogClosing(true);
        setTimeout(() => {
            setShowSettings(false);
            setSettingsDraft(null);
            setIsSettingsDialogClosing(false);
        }, 300);
    };

    const handleSettingsAnimationEnd = () => {
        if (isClosingSettings) {
            setShowSettings(false);
            setSettingsDraft(null);
            setIsClosingSettings(false);
        }
    };

    // Enhanced window visibility management with smart caching
    useEffect(() => {
        const handleFocus = () => {
            if (!isWindowFocused) { // Only act if changing from unfocused to focused
                setIsWindowFocused(true);
                setIsAnimatingList(true);
                setListKey(k => k + 1); // Trigger animation IMMEDIATELY

                // Try cache first for instant display, then fetch fresh data
                if (!useCacheIfValid()) {
                    // Cache miss or invalid - fetch fresh data
                    setTimeout(() => {
                        setIsDataLoading(true);
                        window.electronAPI?.requestClipboardHistory?.();
                    }, 50); // Reduced delay since cache wasn't available
                }

                // Always request fresh data in background (but don't block UI)
                setTimeout(() => {
                    window.electronAPI?.requestClipboardHistory?.();
                }, 200);
            }
        };

        const handleBlur = () => {
            setIsWindowFocused(false);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setIsWindowFocused(true);
                setIsAnimatingList(true);
                setListKey(k => k + 1); // Trigger animation IMMEDIATELY

                // Try cache first for instant display, then fetch fresh data
                if (!useCacheIfValid()) {
                    // Cache miss or invalid - fetch fresh data
                    setTimeout(() => {
                        setIsDataLoading(true);
                        window.electronAPI?.requestClipboardHistory?.();
                    }, 50); // Reduced delay since cache wasn't available
                }

                // Always request fresh data in background
                setTimeout(() => {
                    window.electronAPI?.requestClipboardHistory?.();
                }, 200);
            } else if (document.visibilityState === 'hidden') {
                setIsWindowFocused(false);
                // Keep items in DOM for better UX when window becomes visible again
                // Items will be refreshed from cache on next show
            }
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Initial state check on mount
        if (document.visibilityState === 'visible' && document.hasFocus()) {
            setIsWindowFocused(true);
            setIsAnimatingList(true);

            // Try cache first, then fetch if needed
            if (!useCacheIfValid()) {
                setTimeout(() => {
                    setIsDataLoading(true);
                    window.electronAPI?.requestClipboardHistory?.();
                }, 50);
            }
        } else if (document.visibilityState === 'hidden' || !document.hasFocus()) {
            setIsWindowFocused(false);
            setIsAnimatingList(false);
            // Try to load from cache even when hidden for faster next show
            useCacheIfValid();
        }

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isWindowFocused, useCacheIfValid]); // Add useCacheIfValid dependency

    // Listen for both focus and visibilitychange events to always request clipboard history
    useEffect(() => {
        const handleUpdate = () => {
            window.electronAPI?.requestClipboardHistory?.();
        };
        window.addEventListener('focus', handleUpdate);
        document.addEventListener('visibilitychange', handleUpdate);
        return () => {
            window.removeEventListener('focus', handleUpdate);
            document.removeEventListener('visibilitychange', handleUpdate);
        };
    }, []);

    useEffect(() => {
        const saveSettingsBeforeQuit = () => {
            // Persist current settings to localStorage (or other storage if needed)
            localStorage.setItem('clip-settings', JSON.stringify(settings));
        };
        window.electronAPI?.onSaveSettingsBeforeQuit?.(saveSettingsBeforeQuit);
        return () => {
            // No cleanup needed
        };
    }, [settings]);

    // Note: isAnimatingList is no longer needed for controlling individual item animations
    // Items animate naturally when the list key changes and the container remounts

    const handleSearchChange = (newSearch: string) => {
        setSearch(newSearch);
        setIsAnimatingList(true);
        setListKey(k => k + 1); // Trigger animation
    };

    const handleFilterChange = () => {
        setFilteredType(t => t === 'all' ? 'text' : t === 'text' ? 'image' : 'all');
        setIsAnimatingList(true);
        setListKey(k => k + 1); // Trigger animation
    };

    // UI: Add settings page/modal
    return (
        <ThemeProvider
            theme={settings.theme}
            onSystemThemeChange={handleSystemThemeChange}
        >
            <div
                className="clip-root"
                // Conditionally apply a style to hide content if window is not focused/visible
                // This is a fallback, primary control is via setItems([])
                style={{ opacity: isWindowFocused || showSettings ? 1 : 0, transition: 'opacity 0.1s' }}
            >                {/* Toast notifications container */}
                {toasts.length > 0 && (
                    <div
                        style={{
                            position: 'fixed',
                            bottom: 20,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 9999,
                        }}
                    >
                        {toasts.length > 1 && (
                            <div
                                onClick={clearAllToasts}
                                style={{
                                    fontSize: 12,
                                    color: '#ccc',
                                    padding: '4px 8px',
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: 4,
                                    marginBottom: 5,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
                            >
                                Clear all notifications
                            </div>
                        )}
                        {toasts.map(toast => (
                            <Toast
                                key={toast.id}
                                message={toast}
                                onDismiss={dismissToast}
                                accentColor={settings.accentColor}
                            />
                        ))}
                    </div>
                )}

                <div className="clip-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5vh' }}>
                    <span className="clip-title" style={{ fontWeight: 600, fontSize: 18 }}>
                        Clipboard
                        {isDev() ? (
                            <span
                                style={{
                                    marginLeft: 6,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    opacity: 0.85,
                                    verticalAlign: 'middle',
                                    position: 'relative'
                                }}
                                title={`Cache: ${itemsCache.length} items, age: ${Math.round((Date.now() - lastCacheUpdate) / 1000)}s`}
                            >
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                                    <path
                                        d="M7 7v6a3 3 0 0 0 6 0V6a4 4 0 0 0-8 0v7a5 5 0 0 0 10 0V7"
                                        stroke="#9C27B0"
                                        strokeWidth="2"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </span>
                        ) : null}
                    </span>
                    <button
                        className="clip-settings-btn"
                        style={{
                            marginLeft: 'auto',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid #333',
                            borderRadius: 8,
                            color: '#fff',
                            padding: '4px 12px',
                            cursor: 'pointer',
                            transition: 'background 0.2s, border 0.2s'
                        }}
                        onClick={openSettings}
                    >
                        ⚙️
                    </button>
                </div>
                {/* Search/filter row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, width: '100%' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 0, height: 40 }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            placeholder="Search clipboard..."
                            style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 10,
                                border: '1px solid #333',
                                background: 'rgba(255,255,255,0.07)',
                                color: '#fff',
                                padding: '0 32px 0 14px',
                                fontSize: 15,
                                outline: 'none',
                                transition: 'border 0.2s, box-shadow 0.3s',
                                boxSizing: 'border-box',
                            }}
                            spellCheck={false}
                            autoFocus={false}
                        />
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none', fontSize: 16 }}>🔍</span>
                    </div>
                    <button
                        style={{
                            flexShrink: 0,
                            height: 40,
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid #333',
                            borderRadius: 8,
                            color: '#fff',
                            padding: '0 18px',
                            fontSize: 15,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 500,
                            transition: 'background 0.2s, box-shadow 0.3s',
                        }}
                        onClick={handleFilterChange}
                        title="Filter by type"
                    >
                        {filteredType === 'all' ? 'All' : filteredType === 'text' ? 'Text' : 'Images'}
                    </button>
                </div>
                {showSettings && (
                    <div className={`clip-settings-modal ${isSettingsDialogClosing ? 'fade-out' : 'fade-in'}`} style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                        borderRadius: `${settings.borderRadius}px`,
                        overflow: 'visible',
                        backdropFilter: 'blur(8px)',
                        background: 'rgba(0,0,0,0.4)'
                    }} onAnimationEnd={() => {
                        if (isSettingsDialogClosing) {
                            setShowSettings(false);
                            setSettingsDraft(null);
                            setIsSettingsDialogClosing(false);
                        }
                    }}>
                        <div className={`clip-settings-page ${isSettingsDialogClosing ? 'fade-out' : 'fade-in'}`} style={{
                            background: `rgba(30,32,36,${settings.transparency})`,
                            borderRadius: `${settings.borderRadius}px`,
                            width: '400px',
                            height: '600px',
                            padding: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'border-radius 0.3s, background 0.3s',
                            // boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.2)',
                            border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                            <div style={{
                                padding: '20px 24px',
                                borderBottom: '1px solid rgba(255,255,255,0.12)',
                                flexShrink: 0,
                                background: 'rgba(255,255,255,0.02)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span id='settings-title' style={{ fontWeight: 600, fontSize: 20, color: '#fff' }}>Settings</span>
                                    <button
                                        style={{
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            borderRadius: 6,
                                            color: '#fff',
                                            padding: '6px 8px',
                                            cursor: 'pointer',
                                            fontSize: 16,
                                            lineHeight: 1,
                                            transition: 'background 0.2s'
                                        }}
                                        onClick={cancelSettings}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                        title="Close settings"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div className="clip-settings-scroll" style={{
                                flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 24, display: 'flex', flexDirection: 'column', gap: 24,
                                scrollbarWidth: 'thin',
                                scrollbarColor: settings.theme === 'light' ? '#ccc #f0f0f0' : '#444 #23252a',
                            }}>
                                {/* General section */}
                                <div>
                                    <h2 style={{ ...sectionHeaderStyle, marginBlockStart: 0, color: '#e1e1e1', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>General</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Max clipboard items</span>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    className="settings-input"
                                                    type="number"
                                                    min={10}
                                                    max={500}
                                                    value={maxItemsInputValue ?? (settingsDraft?.maxItems ?? settings.maxItems)}
                                                    onChange={e => {
                                                        const newValue = Number(e.target.value);
                                                        const currentMaxItems = settingsDraft?.maxItems ?? settings.maxItems;
                                                        setMaxItemsInputValue(newValue);
                                                        setHasMaxItemsChanges(newValue !== currentMaxItems);
                                                    }}
                                                    style={{
                                                        borderRadius: 8,
                                                        border: '1px solid rgba(255,255,255,0.12)',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        color: '#fff',
                                                        padding: hasMaxItemsChanges ? '10px 40px 10px 12px' : '10px 12px',
                                                        fontSize: 14,
                                                        transition: 'border-color 0.2s, background 0.2s, padding 0.2s',
                                                        outline: 'none',
                                                        width: '100%',
                                                        boxSizing: 'border-box'
                                                    }}
                                                    onFocus={e => e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor}
                                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                                                />
                                                {hasMaxItemsChanges && (
                                                    <button
                                                        style={{
                                                            position: 'absolute',
                                                            right: 8,
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            background: settingsDraft?.accentColor ?? settings.accentColor,
                                                            border: 'none',
                                                            borderRadius: 4,
                                                            color: '#fff',
                                                            padding: '4px 8px',
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            opacity: 0.9
                                                        }}
                                                        onClick={() => {
                                                            const newValue = maxItemsInputValue!;
                                                            const currentMaxItems = settingsDraft?.maxItems ?? settings.maxItems;

                                                            // Always show warning when decreasing max items
                                                            if (newValue < currentMaxItems) {
                                                                setPendingMaxItems(newValue);
                                                                setBackupCreated(false); // Reset backup status
                                                                setShowMaxItemsWarning(true);
                                                                // Don't reset input states yet - wait for warning dialog
                                                            }
                                                            // Show performance warning when increasing significantly beyond current count
                                                            else if (newValue > currentMaxItems && items.length > 0 && newValue > items.length + 50) {
                                                                setPendingMaxItems(newValue);
                                                                setBackupCreated(false); // Reset backup status
                                                                setShowMaxItemsWarning(true);
                                                                // Don't reset input states yet - wait for warning dialog
                                                            } else {
                                                                // Safe change - apply immediately and reset input states
                                                                const newSettings = settingsDraft ? { ...settingsDraft, maxItems: newValue } : { ...settings, maxItems: newValue };
                                                                setSettingsDraft(newSettings);
                                                                setSettings(newSettings);

                                                                // Persist settings immediately to localStorage
                                                                localStorage.setItem('clip-settings', JSON.stringify(newSettings));

                                                                // Also save to file for main process to read at startup
                                                                window.electronAPI?.saveSettingsToFile?.(newSettings);

                                                                setMaxItemsInputValue(null);
                                                                setHasMaxItemsChanges(false);
                                                            }
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
                                                        title="Apply changes"
                                                    >
                                                        ✓
                                                    </button>
                                                )}
                                            </div>
                                        </label>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Window hide behavior</span>
                                            <select
                                                className="settings-select"
                                                value={settingsDraft?.windowHideBehavior ?? settings.windowHideBehavior}
                                                onChange={e => setSettingsDraft(s => s ? { ...s, windowHideBehavior: e.target.value as Settings['windowHideBehavior'] } : null)}
                                                style={{
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: '#fff',
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    transition: 'border-color 0.2s, background 0.2s',
                                                    outline: 'none'
                                                }}
                                                onFocus={e => e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor}
                                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                                            >
                                                <option value="hide">Hide (completely hidden)</option>
                                                <option value="tray">Minimize to tray (tray icon only)</option>
                                            </select>
                                        </label>
                                        <label className="settings-container" style={{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 8,
                                            padding: '12px 16px',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: 8,
                                            border: '1px solid rgba(255,255,255,0.08)'
                                        }}>
                                            <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Show clipboard window in taskbar</span>
                                            <Switch
                                                checked={settingsDraft?.showInTaskbar ?? settings.showInTaskbar}
                                                onChange={v => setSettingsDraft(s => s ? { ...s, showInTaskbar: v } : null)}
                                                accentColor={settingsDraft?.accentColor ?? settings.accentColor}
                                            />
                                        </label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Shortcut to open clipboard</span>
                                                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                    {MODIFIER_OPTIONS.map(opt => (
                                                        <label
                                                            key={opt.value}
                                                            className="settings-modifier-button"
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                fontSize: 13,
                                                                color: '#fff',
                                                                background: shortcutModifiers.includes(opt.value)
                                                                    ? settingsDraft?.accentColor ?? settings.accentColor
                                                                    : 'rgba(255,255,255,0.05)',
                                                                borderRadius: 6,
                                                                padding: '8px 12px',
                                                                cursor: 'pointer',
                                                                border: shortcutModifiers.includes(opt.value)
                                                                    ? `1px solid ${settingsDraft?.accentColor ?? settings.accentColor}`
                                                                    : '1px solid rgba(255,255,255,0.12)',
                                                                transition: 'background 0.2s, border 0.2s',
                                                                flex: 1,
                                                                justifyContent: 'center',
                                                                userSelect: 'none',
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={shortcutModifiers.includes(opt.value)}
                                                                onChange={e => {
                                                                    setShortcutModifiers(mods =>
                                                                        e.target.checked
                                                                            ? [...mods, opt.value]
                                                                            : mods.filter(m => m !== opt.value)
                                                                    );
                                                                }}
                                                                style={{
                                                                    accentColor: settingsDraft?.accentColor ?? settings.accentColor,
                                                                    margin: 0,
                                                                    width: 14,
                                                                    height: 14
                                                                }}
                                                            />
                                                            {opt.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </label>
                                            <select
                                                className="settings-select"
                                                value={shortcutMainKey}
                                                onChange={e => setShortcutMainKey(e.target.value)}
                                                style={{
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: '#fff',
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    transition: 'border-color 0.2s, background 0.2s',
                                                    outline: 'none'
                                                }}
                                                onFocus={e => e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor}
                                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                                            >
                                                <option value="">Select key...</option>
                                                {MAIN_KEY_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <div className="settings-display-box" style={{
                                                fontSize: 12,
                                                color: '#888',
                                                padding: '8px 12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: 6,
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                fontFamily: 'monospace'
                                            }}>
                                                {shortcutModifiers.concat(shortcutMainKey).filter(Boolean).join('+') || 'No shortcut set'}
                                            </div>
                                            {shortcutModifiers.includes('Super') && (
                                                <div style={{
                                                    fontSize: 12,
                                                    color: '#e67e22',
                                                    padding: '8px 12px',
                                                    background: 'rgba(230, 126, 34, 0.1)',
                                                    borderRadius: 6,
                                                    border: '1px solid rgba(230, 126, 34, 0.2)'
                                                }}>
                                                    ⚠️ Not all shortcuts with Windows key are supported.
                                                    <span style={{
                                                        color: '#888',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        marginLeft: 4
                                                    }} onClick={e => {
                                                        e.stopPropagation();
                                                        setShowShortcutInfo(v => !v);
                                                    }}>
                                                        {showShortcutInfo ? 'Hide info' : 'More info'}
                                                    </span>
                                                </div>
                                            )}
                                            {shortcutModifiers.includes('Super') && showShortcutInfo && (
                                                <div style={{
                                                    padding: 12,
                                                    background: 'rgba(255,255,255,0.03)',
                                                    borderRadius: 8,
                                                    fontSize: 12,
                                                    color: '#bbb',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    lineHeight: 1.4
                                                }}>
                                                    <div style={{ fontWeight: 600, color: '#fff', marginBottom: 6 }}>Why this limitation?</div>
                                                    Windows reserves many shortcuts with the Windows key (like Win+V), so this app uses AutoHotkey to trigger the app directly.
                                                    <br /><br />
                                                    <span style={{ color: '#e67e22' }}>However, some shortcuts (like Win+Shift+S) cannot be replaced and are reserved by Windows.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Backups section */}
                                <div>
                                    <h2 style={{ ...sectionHeaderStyle, color: '#e1e1e1', fontSize: 16, fontWeight: 600, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>Backups</h2>
                                    <label className="settings-container" style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                        padding: '12px 16px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: 8,
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        marginBottom: 16
                                    }}>
                                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Enable automatic database backups</span>
                                        <Switch
                                            checked={settingsDraft?.enableBackups ?? settings.enableBackups}
                                            onChange={v => setSettingsDraft(s => s ? { ...s, enableBackups: v } : null)}
                                            accentColor={settingsDraft?.accentColor ?? settings.accentColor}
                                        />
                                    </label>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        gap: 12,
                                        opacity: (settingsDraft?.enableBackups ?? settings.enableBackups) ? 1 : 0.5,
                                        transition: 'opacity 0.2s',
                                        marginBottom: 16
                                    }}>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                                            <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Backup interval</span>
                                            <select
                                                className="settings-select"
                                                value={settingsDraft?.backupInterval ?? settings.backupInterval}
                                                onChange={e => setSettingsDraft(s => s ? { ...s, backupInterval: Number(e.target.value) } : null)}
                                                style={{
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: '#fff',
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    transition: 'border-color 0.2s, background 0.2s',
                                                    outline: 'none'
                                                }}
                                                disabled={!(settingsDraft?.enableBackups ?? settings.enableBackups)}
                                                onFocus={e => e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor}
                                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                                            >
                                                {BACKUP_INTERVALS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 100 }}>
                                            <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Max backups</span>
                                            <input
                                                className="settings-input"
                                                type="number"
                                                min={1}
                                                max={50}
                                                value={settingsDraft?.maxBackups ?? settings.maxBackups}
                                                onChange={e => setSettingsDraft(s => s ? { ...s, maxBackups: Number(e.target.value) } : null)}
                                                style={{
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: '#fff',
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    transition: 'border-color 0.2s, background 0.2s',
                                                    outline: 'none'
                                                }}
                                                disabled={!(settingsDraft?.enableBackups ?? settings.enableBackups)}
                                                onFocus={e => e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor}
                                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                                            />
                                        </label>
                                    </div>                                    <button
                                        className="settings-button"
                                        style={{
                                            background: isBackingUp ? `${settingsDraft?.accentColor ?? settings.accentColor}44` : '#23252a',
                                            border: isBackingUp ? `1px solid ${settingsDraft?.accentColor ?? settings.accentColor}` : '1px solid #444',
                                            marginBottom: 15,
                                            borderRadius: 8,
                                            width: '100%',
                                            color: '#fff',
                                            padding: '7px 18px',
                                            cursor: isBackingUp ? 'wait' : 'pointer',
                                            fontWeight: 600,
                                            fontSize: 15,
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8,
                                            opacity: isBackingUp ? 0.9 : 1
                                        }}
                                        disabled={isBackingUp}
                                        onClick={async () => {
                                            try {
                                                setIsBackingUp(true);
                                                const backupPath = await window.electronAPI?.createBackup?.();
                                                const newList = await window.electronAPI?.listBackups?.() || [];
                                                setBackupList(newList);
                                                setSelectedBackup(''); // Reset selection

                                                if (backupPath) {
                                                    const filename = backupPath.split('\\').pop() || 'backup';
                                                    showToast('success', `Backup created successfully: ${filename}`);
                                                } else {
                                                    showToast('error', 'Could not create backup');
                                                }
                                            } catch (error) {
                                                log.error('Backup error', error instanceof Error ? error.message : String(error));
                                                showToast('error', `Backup failed: ${error instanceof Error ? error.message : String(error)}`);
                                            } finally {
                                                setIsBackingUp(false);
                                            }
                                        }}
                                    >
                                        {isBackingUp ? (
                                            <>
                                                <span style={{
                                                    display: 'inline-block',
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    border: '2px solid rgba(255,255,255,0.3)',
                                                    borderTopColor: '#fff',
                                                    animation: 'spin 1s linear infinite'
                                                }}></span>
                                                Creating...
                                            </>
                                        ) : (
                                            'Create Backup Now'
                                        )}
                                    </button>
                                </div>
                                {/* Backup Management section */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h3 style={{ ...subHeaderStyle, margin: 0 }}>Backup Management</h3>
                                        <button
                                            className="settings-button"
                                            style={{
                                                background: 'rgba(255,255,255,0.08)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 6,
                                                color: '#fff',
                                                padding: '6px 12px',
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                fontWeight: 500,
                                                transition: 'background 0.2s'
                                            }}
                                            onClick={() => setShowBackupManagement(!showBackupManagement)}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                        >
                                            {showBackupManagement ? 'Simple View' : 'Advanced'}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                                        {backupList.length === 0 ? (
                                            <div className="settings-display-box" style={{
                                                padding: 16,
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                textAlign: 'center',
                                                color: '#888',
                                                fontSize: 14
                                            }}>
                                                No backups found. Create a backup first.
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{
                                                    fontSize: 13,
                                                    color: '#aaa',
                                                    marginBottom: 8,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span>Found {backupList.length} backup{backupList.length !== 1 ? 's' : ''}</span>
                                                    {showBackupManagement && (
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.05)',
                                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                                    borderRadius: 4,
                                                                    color: '#ccc',
                                                                    padding: '4px 8px',
                                                                    cursor: 'pointer',
                                                                    fontSize: 11,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onClick={() => setSelectedBackups(new Set(backupList.map(b => b.file)))}
                                                            >
                                                                Select All
                                                            </button>
                                                            <button
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.05)',
                                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                                    borderRadius: 4,
                                                                    color: '#ccc',
                                                                    padding: '4px 8px',
                                                                    cursor: 'pointer',
                                                                    fontSize: 11,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onClick={() => setSelectedBackups(new Set())}
                                                            >
                                                                Clear All
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="settings-display-box" style={{
                                                    maxHeight: 200,
                                                    overflowY: 'auto',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: 8,
                                                    background: 'rgba(255,255,255,0.03)',
                                                    scrollbarWidth: 'thin',
                                                    scrollbarColor: '#444 transparent'
                                                }}>
                                                    {backupList.map((backup, index) => {
                                                        const date = new Date(backup.time);
                                                        const isSelected = selectedBackup === backup.file;
                                                        const isChecked = selectedBackups.has(backup.file);
                                                        const formattedDate = date.toLocaleDateString();
                                                        const formattedTime = date.toLocaleTimeString();
                                                        const relativeTime = getRelativeTime(backup.time);

                                                        return (
                                                            <div
                                                                key={backup.file}
                                                                style={{
                                                                    padding: '12px 16px',
                                                                    borderBottom: index < backupList.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                                                    background: isSelected ? settingsDraft?.accentColor + '22' : isChecked ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                                    borderLeft: isSelected ? `3px solid ${settingsDraft?.accentColor ?? settings.accentColor}` : '3px solid transparent',
                                                                    transition: 'all 0.2s ease',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 12
                                                                }}
                                                            >
                                                                {showBackupManagement && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => {
                                                                            const newSelected = new Set(selectedBackups);
                                                                            if (e.target.checked) {
                                                                                newSelected.add(backup.file);
                                                                            } else {
                                                                                newSelected.delete(backup.file);
                                                                            }
                                                                            setSelectedBackups(newSelected);
                                                                        }}
                                                                        style={{
                                                                            accentColor: settingsDraft?.accentColor ?? settings.accentColor,
                                                                            width: 16,
                                                                            height: 16,
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    />
                                                                )}

                                                                <div
                                                                    style={{
                                                                        flex: 1,
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: 4
                                                                    }}
                                                                    onClick={() => setSelectedBackup(isSelected ? '' : backup.file)}
                                                                    onMouseEnter={e => {
                                                                        if (!isSelected && !isChecked) {
                                                                            e.currentTarget.parentElement!.style.background = 'rgba(255,255,255,0.05)';
                                                                        }
                                                                    }}
                                                                    onMouseLeave={e => {
                                                                        if (!isSelected && !isChecked) {
                                                                            e.currentTarget.parentElement!.style.background = 'transparent';
                                                                        }
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'flex-start'
                                                                    }}>
                                                                        <div style={{
                                                                            fontWeight: 500,
                                                                            fontSize: 14,
                                                                            color: isSelected ? '#fff' : '#ccc'
                                                                        }}>
                                                                            {formattedDate} at {formattedTime}
                                                                        </div>
                                                                        {isSelected && (
                                                                            <div style={{
                                                                                fontSize: 12,
                                                                                color: settingsDraft?.accentColor ?? settings.accentColor,
                                                                                fontWeight: 600
                                                                            }}>
                                                                                SELECTED
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: 12,
                                                                        color: '#888',
                                                                        fontStyle: 'italic'
                                                                    }}>
                                                                        {relativeTime}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: 11,
                                                                        color: '#666',
                                                                        fontFamily: 'monospace',
                                                                        marginTop: 2
                                                                    }}>
                                                                        {backup.file}
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: '#ff4136',
                                                                        cursor: 'pointer',
                                                                        padding: '4px 8px',
                                                                        borderRadius: 4,
                                                                        fontSize: 18,
                                                                        lineHeight: 1,
                                                                        transition: 'background 0.2s',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        minWidth: 32,
                                                                        height: 32
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setBackupToDelete(backup.file);
                                                                        setBackupDeleteAction('single');
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,65,54,0.15)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                    title="Delete this backup"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div style={{ display: 'flex', gap: 12 }}>
                                                    <button
                                                        className="settings-button"
                                                        style={{
                                                            background: selectedBackup ? (settingsDraft?.accentColor ?? settings.accentColor) : '#23252a',
                                                            border: selectedBackup ? `1px solid ${settingsDraft?.accentColor ?? settings.accentColor}` : '1px solid #444',
                                                            flex: 1,
                                                            borderRadius: 8,
                                                            color: selectedBackup ? '#000' : '#fff',
                                                            padding: '12px 18px',
                                                            cursor: selectedBackup ? 'pointer' : 'not-allowed',
                                                            fontWeight: 600,
                                                            fontSize: 15,
                                                            transition: 'all 0.2s',
                                                            opacity: selectedBackup ? 1 : 0.5,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: 8
                                                        }}
                                                        disabled={!selectedBackup}
                                                        onClick={async () => {
                                                            if (selectedBackup) {
                                                                const button = document.activeElement as HTMLButtonElement;
                                                                const originalText = button.textContent;

                                                                try {
                                                                    button.textContent = "Restoring...";
                                                                    button.style.opacity = "0.7";
                                                                    button.disabled = true;

                                                                    const success = await window.electronAPI?.restoreBackup?.(selectedBackup);

                                                                    if (success) {
                                                                        showToast('success', 'Backup restored successfully!');
                                                                        setSelectedBackup('');
                                                                        // Refresh backup list
                                                                        const newList = await window.electronAPI?.listBackups?.() || [];
                                                                        setBackupList(newList);
                                                                        // Note: No need to manually request clipboard history -
                                                                        // the backend already sends updated history after restore
                                                                    } else {
                                                                        showToast('error', 'Failed to restore backup.');
                                                                    }
                                                                } catch (error) {
                                                                    log.error('Restore error', error instanceof Error ? error.message : String(error));
                                                                    showToast('error', `Restore failed: ${error instanceof Error ? error.message : String(error)}`);
                                                                } finally {
                                                                    button.textContent = originalText;
                                                                    button.style.opacity = "1";
                                                                    button.disabled = false;
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {selectedBackup ? '↻ Restore Selected' : 'Select backup to restore'}
                                                    </button>

                                                    {showBackupManagement && selectedBackups.size > 0 && (
                                                        <button
                                                            className="settings-button"
                                                            style={{
                                                                background: '#ff4136',
                                                                border: '1px solid #ff4136',
                                                                borderRadius: 8,
                                                                color: '#fff',
                                                                padding: '12px 18px',
                                                                cursor: 'pointer',
                                                                fontWeight: 600,
                                                                fontSize: 15,
                                                                transition: 'all 0.2s',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 8,
                                                                minWidth: 140
                                                            }}
                                                            onClick={() => setBackupDeleteAction('multiple')}
                                                        >
                                                            🗑️ Delete {selectedBackups.size}
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* Data export/import section */}
                                <div>
                                    <h2 style={sectionHeaderStyle}>Data</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, marginTop: 21 }}>
                                        <button
                                            className="settings-button"
                                            style={{ background: '#23252a', border: '1px solid #444', borderRadius: 8, color: '#fff', padding: '7px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15, transition: 'background 0.2s, border 0.2s' }}
                                            onClick={handleExportSettings}
                                        >
                                            Export Settings
                                        </button>
                                        <button
                                            className="settings-button"
                                            style={{ background: '#23252a', border: '1px solid #444', borderRadius: 8, color: '#fff', padding: '7px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15, transition: 'background 0.2s, border 0.2s' }}
                                            onClick={handleImportSettings}
                                        >
                                            Import Settings
                                        </button>                                        <button
                                            className="settings-button"
                                            style={{ background: '#23252a', border: '1px solid #444', borderRadius: 8, color: '#fff', padding: '7px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15, transition: 'background 0.2s, border 0.2s' }}
                                            onClick={async (e) => {
                                                const button = e.currentTarget;
                                                const originalText = button.textContent;

                                                try {
                                                    button.textContent = "Exporting...";
                                                    button.style.opacity = "0.7";

                                                    const data = await window.electronAPI?.exportDb?.();

                                                    if (data) {
                                                        const blob = new Blob([data], { type: 'application/octet-stream' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = 'clip-backup-' + new Date().toISOString().substring(0, 10) + '.db';
                                                        a.click();
                                                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                                                        showToast('success', 'Database exported successfully');
                                                    } else {
                                                        showToast('error', 'Failed to export database');
                                                    }
                                                } catch (error) {
                                                    log.error('Export error', error instanceof Error ? error.message : String(error));
                                                    showToast('error', `Export failed: ${error instanceof Error ? error.message : String(error)}`);
                                                } finally {
                                                    // Reset button state
                                                    button.textContent = originalText;
                                                    button.style.opacity = "1";
                                                }
                                            }}
                                        >
                                            Export Database
                                        </button>                                        <button
                                            className="settings-button"
                                            style={{ background: '#23252a', border: '1px solid #444', borderRadius: 8, color: '#fff', padding: '7px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15, transition: 'background 0.2s, border 0.2s' }}
                                            onClick={async (e) => {
                                                const button = e.currentTarget;

                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = '.db,application/octet-stream';
                                                input.onchange = async (e: any) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;

                                                    const originalText = button.textContent;
                                                    button.textContent = "Importing...";
                                                    button.style.opacity = "0.7";

                                                    try {
                                                        const buffer = await file.arrayBuffer();
                                                        const success = await window.electronAPI?.importDb?.(buffer);
                                                        if (success) {
                                                            showToast('success', 'Database imported successfully!');
                                                            // Note: No need to manually request clipboard history -
                                                            // the backend already sends updated history after import
                                                        } else {
                                                            showToast('error', 'Failed to import database');
                                                        }
                                                    } catch (error) {
                                                        log.error('Import error', error instanceof Error ? error.message : String(error));
                                                        showToast('error', `Import failed: ${error instanceof Error ? error.message : String(error)}`);
                                                    } finally {
                                                        // Reset button state
                                                        button.textContent = originalText;
                                                        button.style.opacity = "1";
                                                    }
                                                };
                                                input.click();
                                            }}
                                        >
                                            Import Database
                                        </button>
                                    </div>
                                </div>

                                {/* Visual Settings section */}
                                <div>
                                    <h2 style={sectionHeaderStyle}>Visual Settings</h2>

                                    <label style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                        Border radius
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <input
                                                type="range"
                                                min={0}
                                                max={24}
                                                value={settingsDraft?.borderRadius ?? settings.borderRadius}
                                                onChange={e => setSettingsDraft(s => s ? { ...s, borderRadius: Number(e.target.value) } : null)}
                                                style={{ flex: 1, ...getCustomRangeStyles(settingsDraft?.accentColor ?? settings.accentColor) }}
                                            />
                                            <span style={{ minWidth: 40, textAlign: 'right', fontFamily: 'monospace' }}>{`${settingsDraft?.borderRadius ?? settings.borderRadius}px`}</span>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                        Window transparency
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <input
                                                type="range"
                                                min={70}
                                                max={100}
                                                value={(settingsDraft?.transparency ?? settings.transparency) * 100}
                                                onChange={e => setSettingsDraft(s => s ? { ...s, transparency: Number(e.target.value) / 100 } : null)}
                                                style={{ flex: 1, ...getCustomRangeStyles(settingsDraft?.accentColor ?? settings.accentColor) }}
                                            />
                                            <span style={{ minWidth: 40, textAlign: 'right', fontFamily: 'monospace' }}>{`${Math.round((settingsDraft?.transparency ?? settings.transparency) * 100)}%`}</span>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                        Accent color
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>                                            <input
                                            className="settings-input"
                                            type="color"
                                            value={settingsDraft?.accentColor ?? settings.accentColor}
                                            onChange={e => setSettingsDraft(s => s ? { ...s, accentColor: e.target.value } : null)}
                                            style={{ width: 40, height: 40, border: '1px solid #444', borderRadius: 8, background: 'transparent', cursor: 'pointer' }}
                                        />
                                            <input
                                                className="settings-input"
                                                type="text"
                                                value={settingsDraft?.accentColor ?? settings.accentColor}
                                                onChange={e => setSettingsDraft(s => s ? { ...s, accentColor: e.target.value } : null)}
                                                style={{
                                                    borderRadius: 7,
                                                    border: '1px solid #444',
                                                    background: '#23252a',
                                                    color: '#fff',
                                                    padding: '6px 12px',
                                                    width: 90,
                                                    fontSize: 15
                                                }}
                                            />
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                        Theme
                                        <select
                                            className="settings-select"
                                            value={settingsDraft?.theme ?? settings.theme}
                                            onChange={e => setSettingsDraft(s => s ? { ...s, theme: e.target.value as Settings['theme'] } : null)}
                                            style={{ borderRadius: 7, border: '1px solid #444', background: '#23252a', color: '#fff', padding: '6px 12px', width: 150, fontSize: 15 }}
                                        >
                                            <option value="dark">Dark (Default)</option>
                                            <option value="light">Light</option>
                                            <option value="system">System theme</option>
                                        </select>
                                    </label>
                                </div>

                                {/* Behavior Settings section */}
                                <div>
                                    <h2 style={sectionHeaderStyle}>Behavior Settings</h2>

                                    <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
                                        Show notifications for new clips                                    <Switch
                                            checked={settingsDraft?.showNotifications ?? settings.showNotifications}
                                            onChange={v => setSettingsDraft(s => s ? { ...s, showNotifications: v } : null)}
                                            accentColor={settingsDraft?.accentColor ?? settings.accentColor}
                                        />
                                    </label>

                                    <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
                                        Start with system                                    <Switch
                                            checked={settingsDraft?.startWithSystem ?? settings.startWithSystem}
                                            onChange={v => setSettingsDraft(s => s ? { ...s, startWithSystem: v } : null)}
                                            accentColor={settingsDraft?.accentColor ?? settings.accentColor}
                                        />
                                    </label>

                                    <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
                                        Store images in clipboard history                                    <Switch
                                            checked={settingsDraft?.storeImagesInClipboard ?? settings.storeImagesInClipboard}
                                            onChange={v => setSettingsDraft(s => s ? { ...s, storeImagesInClipboard: v } : null)}
                                            accentColor={settingsDraft?.accentColor ?? settings.accentColor}
                                        />
                                    </label>

                                    <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
                                        Allow pinning favorite items                                    <Switch
                                            checked={settingsDraft?.pinFavoriteItems ?? settings.pinFavoriteItems}
                                            onChange={v => setSettingsDraft(s => s ? { ...s, pinFavoriteItems: v } : null)}
                                            accentColor={settingsDraft?.accentColor ?? settings.accentColor}
                                        />
                                    </label>

                                    <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
                                        Ask before deleting items
                                        <Switch
                                            checked={settingsDraft?.deleteConfirm ?? settings.deleteConfirm}
                                            onChange={v => setSettingsDraft(s => s ? { ...s, deleteConfirm: v } : null)}
                                            accentColor={settingsDraft?.accentColor ?? settings.accentColor}
                                        />
                                    </label>
                                </div>

                                {/* Danger Area section */}
                                <div style={{
                                    marginTop: 32,
                                    padding: 18,
                                    border: '2px solid #ff4136',
                                    borderRadius: 12,
                                    background: 'rgba(255,65,54,0.08)',
                                    color: '#ff4136',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 16,
                                }}>
                                    <h2 id='danger-area' style={{ fontSize: 18, fontWeight: 700, color: '#ff4136', margin: 0, marginBottom: 8 }}>Danger Area</h2>
                                    <div style={{ fontSize: 15, color: '#ff4136', marginBottom: 8 }}>
                                        These actions are irreversible. Please proceed with caution.
                                    </div>
                                    <button
                                        style={{ background: '#ff4136', border: '1px solid #ff4136', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}
                                        onClick={() => setDangerAction('clear')}
                                    >
                                        Clear All Clipboard History
                                    </button>
                                    <div style={{ fontSize: 13, color: '#ff4136', marginBottom: 8, marginTop: -8 }}>
                                        This will permanently delete all clipboard items.
                                    </div>
                                    <button
                                        style={{ background: '#ffb300', border: '1px solid #ffb300', borderRadius: 8, color: '#222', padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}
                                        onClick={() => setDangerAction('reset')}
                                    >
                                        Reset Settings to Default
                                    </button>
                                    <div id='reset-settings-warning' style={{ fontSize: 13, color: '#ffb300', marginTop: -8 }}>
                                        This will reset all settings to their original defaults.
                                    </div>
                                </div>
                            </div>                            <div style={{ padding: '12px 24px', borderTop: '1px solid #333', flexShrink: 0, display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>                                <button
                                style={{
                                    background: '#ff4136',
                                    border: '1px solid #ff4136',
                                    borderRadius: 8,
                                    color: '#fff',
                                    padding: '8px 18px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    marginRight: 'auto',
                                    transition: 'background 0.2s, border 0.2s'
                                }}
                                onClick={() => {
                                    if (hasUnsavedChanges) {
                                        setShowUnsavedChangesConfirm('quit');
                                    } else {
                                        window.electronAPI?.quitApp?.();
                                    }
                                }}
                            >
                                Quit App
                            </button>
                                <button
                                    className="clip-settings-save-btn"
                                    style={{
                                        background: settingsDraft?.accentColor ?? settings.accentColor,
                                        border: `1px solid ${settingsDraft?.accentColor ?? settings.accentColor}`,
                                        borderRadius: 8,
                                        color: '#222',
                                        padding: '8px 18px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: 15
                                    }}
                                    onClick={saveSettings}
                                >
                                    Save
                                </button>
                                <button
                                    className="clip-settings-cancel-btn"
                                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid #444', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}
                                    onClick={cancelSettings}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Clipboard list with key-based remounting for animations */}
                <div
                    key={listKey}
                    ref={listRef}
                    className="clip-list"
                    style={{
                        overflowY: 'auto',
                        marginTop: 0,
                        paddingTop: 0,
                        paddingBottom: 1,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        gap: 10,
                        scrollbarWidth: 'thin',
                        scrollbarColor: settings.theme === 'light' ? '#ccc #f0f0f0' : '#444 #23252a',
                        paddingRight: (() => {
                            const padding = hasScrollbar ? 8 : 0;
                            log.renderer(`Scrollbar: Applying paddingRight: ${padding} (hasScrollbar: ${hasScrollbar})`);
                            return padding;
                        })(), // reserve space for scrollbar gutter
                    }}
                >
                    {/* Show skeleton loading only during the very first data load */}
                    {isInitialLoading && (
                        <>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={`skeleton-${i}`}
                                    className={`clip-item-skeleton ${isAnimatingList ? 'clip-item-animate' : ''}`}
                                    style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: 12,
                                        margin: 0,
                                        padding: '2.5% 3%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        height: 60,
                                        animationDelay: `${i * 50}ms`
                                    }}
                                >
                                    <div style={{
                                        flex: 1,
                                        height: 16,
                                        background: 'rgba(255,255,255,0.06)',
                                        borderRadius: 4,
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: '-100%',
                                            width: '100%',
                                            height: '100%',
                                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                                            animation: 'skeleton-shimmer 2s infinite'
                                        }} />
                                    </div>
                                    <div style={{
                                        width: 60,
                                        height: 12,
                                        background: 'rgba(255,255,255,0.04)',
                                        borderRadius: 4
                                    }} />
                                </div>
                            ))}
                        </>
                    )}

                    {/* Show empty state message when not loading and no items in filtered list */}
                    {filteredItems.length === 0 && !isInitialLoading && (
                        <div className="clip-empty" style={{ opacity: 0.7, textAlign: 'center', marginTop: '10%' }}>
                            {search.trim().length > 0
                                ? 'No results found.'
                                : filteredType === 'text'
                                    ? 'No text found.'
                                    : filteredType === 'image'
                                        ? 'No images found.'
                                        : 'No clipboard items found.'}
                        </div>
                    )}
                    {filteredItems.map((item, idx) => (
                        <div
                            key={item.id}
                            className={`clip-item clip-item-${item.type} ${isAnimatingList ? 'clip-item-animate' : ''}`}
                            onClick={() => handlePaste(item)}
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                borderRadius: 12,
                                margin: 0,
                                padding: '2.5% 3%',
                                display: 'flex',
                                alignItems: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                transition: 'background 0.2s, transform 0.25s cubic-bezier(.4,2,.6,1), box-shadow 0.25s cubic-bezier(.4,2,.6,1)',
                                cursor: 'pointer',
                                gap: 10
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        >
                            {item.type === 'image' ? (
                                <img className="clip-item-image" src={item.content} alt="clip" style={{ width: '13%', minWidth: 36, maxWidth: 48, height: 'auto', aspectRatio: '1/1', borderRadius: 8, objectFit: 'cover', marginRight: '4%' }} />
                            ) : (
                                <div className="clip-item-text" style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '1rem', lineHeight: 1.4 }}>{item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content}</div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', minWidth: 60 }}>
                                <span className="clip-item-time" style={{ opacity: 0.5, fontSize: '0.85rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{new Date(item.timestamp).toLocaleTimeString()}</span>
                                {(settings.pinFavoriteItems) && (
                                    <button
                                        className="clip-pin-btn"
                                        tabIndex={-1}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            marginLeft: 2,
                                            marginTop: 2,
                                            cursor: 'pointer',
                                            outline: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            opacity: item.pinned ? 1 : 0.6,
                                            transition: 'opacity 0.2s',
                                            height: 25,
                                            width: 25,
                                        }}
                                        title={item.pinned ? 'Unpin' : 'Pin'}
                                        onClick={e => {
                                            e.stopPropagation();
                                            if (settings.pinFavoriteItems) handleTogglePin(item);
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = item.pinned ? '1' : '0.6')}
                                    >
                                        <PinIcon pinned={!!item.pinned} />
                                    </button>
                                )}
                                <button
                                    className="clip-delete-btn"
                                    tabIndex={-1}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        marginLeft: 2,
                                        marginTop: 2,
                                        cursor: 'pointer',
                                        outline: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        opacity: 0.7,
                                        transition: 'opacity 0.2s',
                                        height: 25,
                                        width: 25,
                                    }}
                                    title="Delete"
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleDeleteItem(item);
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                                >
                                    <DustbinIcon />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {deleteTarget && (
                    <div className={`fade-opacity-${isDeleteDialogClosing ? 'out' : 'in'}`} style={{
                        position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, borderRadius: settings.borderRadius
                    }}>
                        <div
                            className={`delete-confirm-dialog ${isDeleteDialogClosing ? 'fade-out' : 'fade-in'}`}
                            style={{
                                background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                                borderRadius: 10,
                                padding: 24,
                                minWidth: 220,
                                textAlign: 'center',
                                boxShadow: '0 2px 12px #0008',
                                border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`
                            }}
                        >
                            <div style={{
                                marginBottom: 18,
                                color: settings.theme === 'light' ? '#333' : '#fff',
                                fontWeight: 500
                            }}>
                                Delete this item?
                            </div>
                            <button
                                style={{
                                    background: settings.accentColor,
                                    color: '#fff',
                                    border: '1px solid ' + settings.accentColor,
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    marginRight: 10,
                                    fontWeight: 600
                                }}
                                onClick={() => confirmDelete(deleteTarget)}
                            >
                                Yes
                            </button>
                            <button
                            className='no-btn'
                                style={{
                                    background: '#ff4136',
                                    color: '#fff !important',
                                    border: '1px solid #ff4136',
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    fontWeight: 600
                                }}
                                onClick={handleDeleteDialogClose}
                            >
                                No
                            </button>
                        </div>
                    </div>
                )}
                {/* Danger Area confirmation popup */}
                {dangerAction && (
                    <div className={`fade-opacity-${isDangerDialogClosing ? 'out' : 'in'}`} style={{
                        position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, borderRadius: settings.borderRadius
                    }}>
                        <div
                            className={`delete-confirm-dialog ${isDangerDialogClosing ? 'fade-out' : 'fade-in'}`}
                            style={{
                                background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                                borderRadius: 10,
                                padding: 24,
                                minWidth: 280,
                                maxWidth: 280,
                                textAlign: 'center',
                                boxShadow: '0 2px 12px #0008',
                                border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`
                            }}
                        >
                            <div style={{
                                marginBottom: 18,
                                color: dangerAction === 'clear' ? '#ff4136' : '#ffb300',
                                fontWeight: 600,
                                fontSize: 17
                            }}>
                                {dangerAction === 'clear' ? 'Clear ALL clipboard history? This action cannot be undone.' : 'Reset ALL settings to default?'}
                            </div>
                            <button
                                style={{
                                    background: dangerAction === 'clear' ? '#ff4136' : '#ffb300',
                                    color: '#222',
                                    border: '1px solid ' + (dangerAction === 'clear' ? '#ff4136' : '#ffb300'),
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    marginRight: 10,
                                    fontWeight: 600
                                }}
                                onClick={dangerAction === 'clear' ? handleClearAll : resetSettings}
                            >
                                Yes
                            </button>
                            <button
                                className='no-btn'
                                style={{
                                    background: '#222',
                                    color: dangerAction === 'clear' ? '#ff4136' : '#ffb300',
                                    border: '1px solid ' + (dangerAction === 'clear' ? '#ff4136' : '#ffb300'),
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    fontWeight: 600
                                }}
                                onClick={() => {
                                    setIsDangerDialogClosing(true);
                                    setTimeout(() => {
                                        setDangerAction(null);
                                        setIsDangerDialogClosing(false);
                                    }, 300);
                                }}
                            >
                                No
                            </button>
                        </div>
                    </div>
                )}
                <style>{`
                /* Global CSS for clean interface */
                body {
                    margin: 0;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    overflow: hidden;
                    -webkit-user-select: none;
                    user-select: none;
                }

                /* Custom slider styles */
                ${getSliderStyles(settings.accentColor)}

                /* Light theme slider styles */
                .theme-light input[type="range"]::-webkit-slider-runnable-track {
                    background: #ccc !important;
                }
                .theme-light input[type="range"]::-moz-range-track {
                    background: #ccc !important;
                }
                .clip-root {
                    background: rgba(30,32,36,${settings.transparency});
                    border-radius: ${settings.borderRadius}px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
                    padding: 3%;
                    height: 600px; /* Fixed height instead of min-height */
                    width: 400px; /* Match main window width */
                    color: #fff;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    transition: box-shadow 0.2s, border-radius 0.3s, background 0.3s;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box; /* Include padding in dimensions */
                    padding-bottom: 7px;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                /* Dark mode option styling */
                option {
                    background: #23252a !important;
                    color: #fff !important;
                }

                select option {
                    background: #23252a !important;
                    color: #fff !important;
                }

                /* Theme-based styling */
                .theme-light .clip-root {
                    background: rgba(250,250,250,${settings.transparency});
                    color: #2c3e50;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                .theme-light .clip-item {
                    background: rgba(255,255,255,0.85) !important;
                    color: #2c3e50;
                    border: 1px solid rgba(0,0,0,0.08) !important;
                }

                .theme-light .clip-item:hover {
                    background: rgba(255,255,255,0.95) !important;
                    border: 1px solid rgba(0,0,0,0.12) !important;
                }

                .theme-light .clip-settings-page {
                    background: rgba(250,250,250,${settings.transparency}) !important;
                    color: #2c3e50;
                }


                .theme-light .clip-settings-scroll::-webkit-scrollbar-thumb {
                    background: #aaa;
                    border: 2px solid #f0f0f0;
                    max-height: 90%;
                }

                .theme-light .clip-settings-scroll::-webkit-scrollbar-thumb:hover {
                    background: ${settings.accentColor};
                }

                .theme-light input, .theme-light select {
                    background: rgba(255,255,255,0.95) !important;
                    color: #2c3e50 !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }

                /* Only apply input-like styling to labels that have background styling (container labels) */
                .theme-light label[style*="background: rgba(255,255,255,0.03)"],
                .theme-light label[style*="background: rgba(255,255,255,0.05)"],
                .theme-light label[style*="background: rgba(255,255,255,0.08)"] {
                    background: rgba(255,255,255,0.9) !important;
                    border: 1px solid #e5e7eb !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
                }

                .theme-light input:focus, .theme-light select:focus {
                    border-color: ${settings.accentColor} !important;
                    box-shadow: 0 0 0 3px rgba(70, 130, 180, 0.1) !important;
                    outline: none !important;
                }

                .theme-light option {
                    background: rgba(255,255,255,0.98) !important;
                    color: #2c3e50 !important;
                }

                /* Dark mode theme-specific option styling */
                .theme-dark option {
                    background: #23252a !important;
                    color: #fff !important;
                }

                .theme-dark select option {
                    background: #23252a !important;
                    color: #fff !important;
                }

                .theme-light button:not(.no-btn, .clip-pin-btn, .clip-delete-btn) {
                    color: #292e36a6 !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                    transition: all 0.2s ease !important;
                }

                .theme-light button:hover:not(.clip-pin-btn, .clip-delete-btn) {
                    border-color: #9ca3af !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.15) !important;
                }

                .theme-light button.clip-settings-save-btn {
                    background: ${settings.accentColor} !important;
                    color: #fff !important;
                    border-color: ${settings.accentColor} !important;
                }

                .theme-light button.clip-settings-save-btn:hover {
                    background: ${settings.accentColor}dd !important;
                    box-shadow: 0 2px 8px rgba(70, 130, 180, 0.3) !important;
                }

                .theme-light h2 {
                    color: #2c3440e8 !important;
                    border-bottom-color: #e5e7eb !important;
                }

                .theme-light h3 {
                    color: #374151 !important;
                }

                .theme-light span:not(.toast-message>span) {
                    color: #6b7280 !important;
                }

                /* Light mode text labels - only for text labels, not container labels */
                .theme-light label:not([style*="background:"]) {
                    color: #374151 !important;
                }

                /* Light mode simple class-based styling */

                /* Settings inputs and selects */
                .theme-light .settings-input,
                .theme-light .settings-select {
                    background: rgba(255,255,255,0.95) !important;
                    color: #2c3e50 !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }

                #danger-area, .theme-light #reset-settings-warning {
                    color: #ff4136 !important;
                }

                .theme-light .settings-input:focus,
                .theme-light .settings-select:focus {
                    border-color: ${settings.accentColor} !important;
                    box-shadow: 0 0 0 3px rgba(70, 130, 180, 0.1) !important;
                }

                /* Settings container labels (switch containers) */
                .theme-light .settings-container {
                    background: rgba(255,255,255,0.9) !important;
                    border: 1px solid #e5e7eb !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
                }

                /* Settings buttons */
                .theme-light .settings-button {
                    background: rgba(255,255,255,0.9) !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }

                .theme-light .settings-button:hover {
                    border-color: #9ca3af !important;
                }

                /* Settings display boxes (shortcut display, backup list, etc.) */
                .theme-light .settings-display-box {
                    background: rgba(255,255,255,0.9) !important;
                    color: #374151 !important;
                    border: 1px solid #e5e7eb !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
                }

                /* Danger zone styling for light mode */
                .theme-light div[style*="background: rgba(255,65,54,0.08)"] {
                    background: rgba(120,120,120,0.15) !important;
                }

                .theme-light div[style*="color: #ffb300"] {
                    color: #ff4136 !important;
                }

                /* Shortcut modifier buttons */
                .theme-light .settings-modifier-button {
                    background: rgba(255,255,255,0.9) !important;
                    color: #2c3e50 !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }
                    
                .theme-light #settings-title {
                    color: #575f6c !important;
                }

                .theme-light .settings-modifier-button:hover {
                    background: rgba(255,255,255,1) !important;
                    border-color: #9ca3af !important;
                }

                /* Light mode section backgrounds */
                .theme-light div[style*="background: rgba(255,255,255,0.03)"] {
                    background: rgba(255,255,255,0.7) !important;
                    border: 1px solid #e5e7eb !important;
                }

                .theme-light div[style*="background: rgba(255,255,255,0.05)"] {
                    background: rgba(255,255,255,0.8) !important;
                    border: 1px solid #e5e7eb !important;
                }

                .theme-light div[style*="background: rgba(255,255,255,0.08)"] {
                    background: rgba(255,255,255,0.9) !important;
                    border: 1px solid #d1d5db !important;
                }

                @keyframes clip-fadein {
                    from { opacity: 0; transform: translateY(16px) scale(0.98); }
                    to { opacity: 1; transform: none; }
                }
                @keyframes clip-fadeout {
                from { opacity: 1; transform: none; }
                to { opacity: 0; transform: translateY(16px) scale(0.98); }
                }
                @keyframes clip-item-slide-in {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                .clip-item-animate {
                    animation: clip-item-slide-in 0.4s ease-out forwards;
                }
                .fade-in { animation: clip-fadein 0.3s forwards; }
                .fade-out { animation: clip-fadeout 0.3s forwards; }
                .fade-opacity-in { opacity: 1; transition: opacity 0.3s; }
                .fade-opacity-out { opacity: 0; transition: opacity 0.3s; }

                /* Toast notifications */
                @keyframes toast-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes toast-out {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(20px); }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes skeleton-shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                .toast-message {
                    animation: toast-in 0.3s ease-out forwards;
                }
                .toast-message.removing {
                    animation: toast-out 0.3s ease-in forwards;
                }

                /* Other elements */
                .clip-item {
                    will-change: transform, opacity;
                }
                .clip-item:active {
                    transform: scale(0.97);
                    box-shadow: 0 2px 16px 0 #ffb30044;
                }
                .clip-settings-page {
                    overflow: hidden;
                }
                .clip-settings-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: #444 #23252a;
                }
                .clip-settings-scroll::-webkit-scrollbar {
                    width: 8px;
                    background: transparent;
                    transition: opacity 0.2s;
                    opacity: 0;
                    position: absolute;
                    right: 0;
                    z-index: 10;
                }
                .clip-settings-scroll:hover::-webkit-scrollbar {
                    opacity: 1;
                }
                .clip-settings-scroll::-webkit-scrollbar-thumb {
                    background: #444;
                    border-radius: 6px;
                    border: 2px solid #23252a;
                    min-height: 40px;
                    transition: background 0.2s;
                    max-height: 90%;
                }
                .clip-settings-scroll::-webkit-scrollbar-thumb:hover {
                    background: #2ecc40;
                }
                /* Clipboard list scrollbar styling */
                .clip-list {
                    overflow-y: overlay;
                    scrollbar-width: thin;
                    scrollbar-color: #444 #23252a;
                }
                .clip-list::-webkit-scrollbar {
                    width: 8px;
                    background: transparent;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .clip-list:hover::-webkit-scrollbar {
                    opacity: 1;
                }
                .clip-list::-webkit-scrollbar-thumb {
                    background: #444;
                    border-radius: 6px;
                    border: 2px solid #23252a;
                    min-height: 20px !important;
                    transition: background 0.2s;
                }
                .clip-list::-webkit-scrollbar-thumb:hover {
                    background: #2ecc40;
                }

                /* Backup list scrollbar styling */
                .clip-settings-scroll div[style*="overflowY"]::-webkit-scrollbar {
                    width: 6px;
                    background: transparent;
                }
                .clip-settings-scroll div[style*="overflowY"]::-webkit-scrollbar-thumb {
                    background: #444;
                    border-radius: 3px;
                    transition: background 0.2s;
                }
                .clip-settings-scroll div[style*="overflowY"]::-webkit-scrollbar-thumb:hover {
                    background: ${settings.accentColor};
                }
            `}                </style>
                {/* Restart confirmation dialog */}
                {showRestartConfirm && (
                    <div className={`fade-opacity-${isRestartDialogClosing ? 'out' : 'in'}`} style={{
                        position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, borderRadius: settings.borderRadius
                    }}>
                        <div
                            className={`${isRestartDialogClosing ? 'fade-out' : 'fade-in'}`}
                            style={{
                                background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                                borderRadius: 10,
                                padding: 24,
                                minWidth: 280,
                                maxWidth: 350,
                                textAlign: 'center',
                                boxShadow: '0 2px 12px #0008',
                                border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`
                            }}
                        >
                            <div style={{ marginBottom: 18, fontWeight: 600, fontSize: 17 }}>
                                {restartReason === 'import'
                                    ? "Database imported successfully! Do you want to restart the app now?"
                                    : restartReason === 'restore'
                                        ? "Backup restored successfully! Do you want to restart the app now?"
                                        : "Operation successful! Do you want to restart the app now?"}
                            </div>
                            <button
                                style={{
                                    background: settings.accentColor,
                                    color: '#222',
                                    border: `1px solid ${settings.accentColor}`,
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    marginRight: 10,
                                    fontWeight: 600
                                }}
                                onClick={() => window.electronAPI?.restartApp?.()}
                            >
                                Yes, Restart Now
                            </button>
                            <button
                                style={{
                                    background: '#222',
                                    color: '#fff',
                                    border: '1px solid #444',
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    fontWeight: 600
                                }}
                                onClick={() => {
                                    setIsRestartDialogClosing(true);
                                    setTimeout(() => {
                                        setShowRestartConfirm(false);
                                        setRestartReason(null); // Reset reason
                                        setIsRestartDialogClosing(false);
                                    }, 300);
                                }}
                            >
                                Later
                            </button>
                        </div>
                    </div>
                )}

                {/* Unsaved changes confirmation dialog */}
                {showUnsavedChangesConfirm && (
                    <div className={`fade-opacity-${isUnsavedChangesDialogClosing ? 'out' : 'in'}`} style={{
                        position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, borderRadius: settings.borderRadius
                    }}>
                        <div
                            className={`${isUnsavedChangesDialogClosing ? 'fade-out' : 'fade-in'}`}
                            style={{
                                background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                                borderRadius: 10,
                                padding: 24,
                                minWidth: 280,
                                maxWidth: 350,
                                textAlign: 'center',
                                boxShadow: '0 2px 12px #0008',
                                border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`
                            }}
                        >
                            <div style={{ marginBottom: 18, fontWeight: 600, fontSize: 17 }}>
                                You have unsaved changes. Do you want to save them?
                            </div>
                            <button
                                style={{
                                    background: settings.accentColor,
                                    color: '#222',
                                    border: `1px solid ${settings.accentColor}`,
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    marginRight: 10,
                                    fontWeight: 600
                                }}
                                onClick={() => {
                                    if (settingsDraft) setSettings(settingsDraft);
                                    const actionType = showUnsavedChangesConfirm;

                                    setIsUnsavedChangesDialogClosing(true);
                                    setTimeout(() => {
                                        setShowUnsavedChangesConfirm(null);
                                        setIsUnsavedChangesDialogClosing(false);

                                        if (actionType === 'quit') {
                                            window.electronAPI?.quitApp?.();
                                        } else {
                                            closeSettingsWithoutSaving();
                                        }
                                    }, 300);
                                }}
                            >
                                Save
                            </button>
                            <button
                                style={{
                                    background: '#ff4136',
                                    color: '#fff',
                                    border: '1px solid #ff4136',
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    marginRight: 10,
                                    fontWeight: 600
                                }}
                                onClick={() => {
                                    const actionType = showUnsavedChangesConfirm;

                                    setIsUnsavedChangesDialogClosing(true);
                                    setTimeout(() => {
                                        setShowUnsavedChangesConfirm(null);
                                        setIsUnsavedChangesDialogClosing(false);

                                        if (actionType === 'quit') {
                                            window.electronAPI?.quitApp?.();
                                        } else {
                                            closeSettingsWithoutSaving();
                                        }
                                    }, 300);
                                }}
                            >
                                Don't Save
                            </button>
                            <button
                                style={{
                                    background: '#222',
                                    color: '#fff',
                                    border: '1px solid #444',
                                    borderRadius: 6,
                                    padding: '6px 18px',
                                    fontWeight: 600
                                }}
                                onClick={() => {
                                    setIsUnsavedChangesDialogClosing(true);
                                    setTimeout(() => {
                                        setShowUnsavedChangesConfirm(null);
                                        setIsUnsavedChangesDialogClosing(false);
                                    }, 300);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Backup deletion confirmation dialog */}
                {backupDeleteAction && (
                    <div className={`fade-opacity-${isBackupDeleteDialogClosing ? 'out' : 'in'}`} style={{
                        position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, borderRadius: settings.borderRadius
                    }}>
                        <div
                            className={`${isBackupDeleteDialogClosing ? 'fade-out' : 'fade-in'}`}
                            style={{
                                background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                                borderRadius: 10,
                                padding: 24,
                                minWidth: 280,
                                maxWidth: 400,
                                textAlign: 'center',
                                boxShadow: '0 2px 12px #0008',
                                border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`
                            }}
                        >
                            <div style={{
                                marginBottom: 18,
                                color: '#ff4136',
                                fontWeight: 600,
                                fontSize: 17,
                                lineHeight: 1.4
                            }}>
                                {backupDeleteAction === 'single'
                                    ? `Delete backup permanently?`
                                    : `Delete ${selectedBackups.size} backup${selectedBackups.size !== 1 ? 's' : ''} permanently?`
                                }
                                <div style={{
                                    fontSize: 14,
                                    fontWeight: 400,
                                    color: '#ccc',
                                    marginTop: 8
                                }}>
                                    This action cannot be undone.
                                </div>
                            </div>
                            <button
                                style={{
                                    background: '#ff4136',
                                    color: '#fff',
                                    border: '1px solid #ff4136',
                                    borderRadius: 6,
                                    padding: '8px 18px',
                                    marginRight: 10,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onClick={async () => {
                                    try {
                                        let success = false;

                                        if (backupDeleteAction === 'single' && backupToDelete) {
                                            success = await window.electronAPI?.deleteBackup?.(backupToDelete);
                                            if (success) {
                                                showToast('success', 'Backup deleted successfully');
                                                // Clear selection if the deleted backup was selected
                                                if (selectedBackup === backupToDelete) {
                                                    setSelectedBackup('');
                                                }
                                            } else {
                                                showToast('error', 'Failed to delete backup');
                                            }
                                        } else if (backupDeleteAction === 'multiple' && selectedBackups.size > 0) {
                                            const deletedCount = await window.electronAPI?.deleteMultipleBackups?.(Array.from(selectedBackups));
                                            if (deletedCount > 0) {
                                                showToast('success', `${deletedCount} backup${deletedCount !== 1 ? 's' : ''} deleted successfully`);
                                                // Clear restore selection if it was in the deleted backups
                                                if (selectedBackups.has(selectedBackup)) {
                                                    setSelectedBackup('');
                                                }
                                                setSelectedBackups(new Set());
                                            } else {
                                                showToast('error', 'Failed to delete backups');
                                            }
                                        }

                                        // Refresh backup list
                                        const newList = await window.electronAPI?.listBackups?.() || [];
                                        setBackupList(newList);

                                    } catch (error) {
                                        log.error('Delete backup error', error instanceof Error ? error.message : String(error));
                                        showToast('error', `Delete failed: ${error instanceof Error ? error.message : String(error)}`);
                                    }

                                    // Close dialog
                                    setIsBackupDeleteDialogClosing(true);
                                    setTimeout(() => {
                                        setBackupDeleteAction(null);
                                        setBackupToDelete('');
                                        setIsBackupDeleteDialogClosing(false);
                                    }, 300);
                                }}
                            >
                                Yes, Delete
                            </button>
                            <button
                                style={{
                                    background: '#222',
                                    color: '#fff',
                                    border: '1px solid #444',
                                    borderRadius: 6,
                                    padding: '8px 18px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    setIsBackupDeleteDialogClosing(true);
                                    setTimeout(() => {
                                        setBackupDeleteAction(null);
                                        setBackupToDelete('');
                                        setIsBackupDeleteDialogClosing(false);
                                    }, 300);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Max items warning dialog */}
                {showMaxItemsWarning && (
                    <div className={`fade-opacity-${isMaxItemsWarningClosing ? 'out' : 'in'}`} style={{
                        position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2300, borderRadius: settings.borderRadius
                    }}>
                        <div
                            className={`${isMaxItemsWarningClosing ? 'fade-out' : 'fade-in'}`}
                            style={{
                                background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                                borderRadius: 10,
                                padding: 24,
                                minWidth: 320,
                                maxWidth: 450,
                                textAlign: 'center',
                                boxShadow: '0 2px 12px #0008',
                                border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`
                            }}
                        >
                            <div style={{
                                marginBottom: 18,
                                color: pendingMaxItems !== null && pendingMaxItems < (settingsDraft?.maxItems ?? settings.maxItems) ? '#ff4136' : '#e67e22',
                                fontWeight: 600,
                                fontSize: 17,
                                lineHeight: 1.4
                            }}>
                                {pendingMaxItems !== null && pendingMaxItems < (settingsDraft?.maxItems ?? settings.maxItems)
                                    ? 'Data Loss Warning'
                                    : 'Performance Warning'}
                            </div>
                            <div style={{
                                fontSize: 14,
                                color: settings.theme === 'light' ? '#666' : '#ccc',
                                marginBottom: 18,
                                lineHeight: 1.5
                            }}>
                                {pendingMaxItems !== null && pendingMaxItems < (settingsDraft?.maxItems ?? settings.maxItems) ? (
                                    <>
                                        You're decreasing the max items from <strong>{settingsDraft?.maxItems ?? settings.maxItems}</strong> to <strong>{pendingMaxItems}</strong>.
                                        <br /><br />
                                        <span style={{ color: '#ff4136', fontWeight: 600 }}>⚠️ This will immediately delete {Math.max(0, items.length - pendingMaxItems)} clipboard items from the oldest entries.</span>
                                        <br /><br />
                                        <strong>This action is irreversible.</strong> Consider creating a backup first if you might want to restore these items later.
                                    </>
                                ) : (
                                    <>
                                        You're setting the max items to <strong>{pendingMaxItems}</strong>, which is significantly higher than your current {items.length} items.
                                        <br /><br />
                                        Large clipboard histories may impact performance. Are you sure you want to continue?
                                    </>
                                )}
                            </div>
                            {pendingMaxItems !== null && pendingMaxItems < (settingsDraft?.maxItems ?? settings.maxItems) && !backupCreated && (
                                <button
                                    style={{
                                        background: settingsDraft?.accentColor ?? settings.accentColor,
                                        color: '#fff',
                                        border: `1px solid ${settingsDraft?.accentColor ?? settings.accentColor}`,
                                        borderRadius: 6,
                                        padding: '6px 16px',
                                        marginBottom: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        width: '100%',
                                        fontSize: 13
                                    }}
                                    onClick={async () => {
                                        try {
                                            const backupPath = await window.electronAPI?.createBackup?.();
                                            if (backupPath) {
                                                const filename = backupPath.split('\\').pop() || 'backup';
                                                showToast('success', `Backup created: ${filename}`);
                                                setBackupCreated(true);
                                            } else {
                                                showToast('error', 'Failed to create backup');
                                            }
                                        } catch (error) {
                                            log.error('Backup error', error instanceof Error ? error.message : String(error));
                                            showToast('error', 'Backup failed');
                                        }
                                    }}
                                >
                                    📦 Create Backup First
                                </button>
                            )}
                            <button
                                style={{
                                    background: settings.accentColor,
                                    color: '#222',
                                    border: `1px solid ${settings.accentColor}`,
                                    borderRadius: 6,
                                    padding: '8px 18px',
                                    marginRight: 10,
                                    marginBottom: 8,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onClick={async () => {
                                    if (pendingMaxItems !== null) {
                                        const currentMaxItems = settingsDraft?.maxItems ?? settings.maxItems;

                                        // Update both the settings draft and main settings
                                        const newSettings = settingsDraft ? { ...settingsDraft, maxItems: pendingMaxItems } : { ...settings, maxItems: pendingMaxItems };
                                        setSettingsDraft(newSettings);
                                        setSettings(newSettings);

                                        // Persist settings immediately to localStorage
                                        localStorage.setItem('clip-settings', JSON.stringify(newSettings));

                                        // Also save to file for main process to read at startup
                                        window.electronAPI?.saveSettingsToFile?.(newSettings);

                                        // If decreasing max items and we have more items than the new limit, trim them
                                        if (pendingMaxItems < currentMaxItems && items.length > pendingMaxItems) {
                                            try {
                                                // Tell the main process to trim clipboard items to the new limit
                                                await window.electronAPI?.trimClipboardItems?.(pendingMaxItems);
                                                showToast('info', `Clipboard trimmed to ${pendingMaxItems} items`);
                                            } catch (error) {
                                                console.error('Failed to trim clipboard items:', error);
                                                showToast('error', 'Failed to trim clipboard items');
                                            }
                                        }
                                    }
                                    setIsMaxItemsWarningClosing(true);
                                    setTimeout(() => {
                                        setShowMaxItemsWarning(false);
                                        setPendingMaxItems(null);
                                        setBackupCreated(false); // Reset backup status
                                        setMaxItemsInputValue(null); // Reset input states
                                        setHasMaxItemsChanges(false);
                                        setIsMaxItemsWarningClosing(false);
                                    }, 300);
                                }}
                            >
                                {pendingMaxItems !== null && pendingMaxItems < (settingsDraft?.maxItems ?? settings.maxItems)
                                    ? (backupCreated ? 'Continue' : 'Continue Anyway (not recommended)')
                                    : 'Yes, Continue'
                                }
                            </button>
                            <button
                                style={{
                                    background: '#222',
                                    color: '#fff',
                                    border: '1px solid #444',
                                    borderRadius: 6,
                                    padding: '8px 18px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    setIsMaxItemsWarningClosing(true);
                                    setTimeout(() => {
                                        setShowMaxItemsWarning(false);
                                        setPendingMaxItems(null);
                                        setBackupCreated(false); // Reset backup status
                                        setMaxItemsInputValue(null); // Reset input states
                                        setHasMaxItemsChanges(false);
                                        setIsMaxItemsWarningClosing(false);
                                    }, 300);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </ThemeProvider>
    );
};

export default App;
