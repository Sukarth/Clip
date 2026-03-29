import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import ThemeProvider from './ThemeProvider';
import ToastContainer from './components/ToastContainer';
import { log, isDev } from '../logger';
import {
    DEFAULT_SETTINGS,
    MAIN_KEY_OPTIONS,
    MODIFIER_OPTIONS,
    sectionHeaderStyle,
} from './app-constants';
import type { BackupEntry, ClipboardItem, Settings, ToastMessage } from './app-types';
import AppDialogs from './components/AppDialogs';
import AppInlineStyles from './components/AppInlineStyles';
import ClipboardList from './components/ClipboardList';
import IconGlyph from './components/IconGlyph';
import SettingsBackupsSection from './components/SettingsBackupsSection';
import SettingsThemeSection from './components/SettingsThemeSection';
import Switch from './components/Switch';
import { getActiveThemeProfile } from './theme-utils';
import {
    WINDOW_SIZE_LIMITS,
    createDefaultThemeConfig,
    normalizeThemeProfileKey,
    sanitizeThemeConfig,
    type ThemeConfig,
    type ThemeProfile,
} from '../theme-config';

const App: React.FC = () => {
    const [items, setItems] = useState<ClipboardItem[]>([]);
    const [settings, setSettings] = useState<Settings>(() => {
        const saved = localStorage.getItem('clip-settings');
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    });
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => createDefaultThemeConfig());
    const activeThemeProfile = React.useMemo(() => getActiveThemeProfile(themeConfig), [themeConfig]);
    const activeThemeProfileKey = React.useMemo(() => {
        const normalized = normalizeThemeProfileKey(themeConfig.activeProfile);
        if (themeConfig.profiles[normalized]) return normalized;
        return Object.keys(themeConfig.profiles)[0] || 'default';
    }, [themeConfig]);

    const themeColors = activeThemeProfile.colors;
    const themeTypography = activeThemeProfile.typography;
    const themeSurface = activeThemeProfile.surface;
    const themeIcons = activeThemeProfile.icons;

    const clampWindowWidth = useCallback((value: unknown) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return WINDOW_SIZE_LIMITS.width.default;
        return Math.min(WINDOW_SIZE_LIMITS.width.max, Math.max(WINDOW_SIZE_LIMITS.width.min, Math.floor(parsed)));
    }, []);

    const clampWindowHeight = useCallback((value: unknown) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return WINDOW_SIZE_LIMITS.height.default;
        return Math.min(WINDOW_SIZE_LIMITS.height.max, Math.max(WINDOW_SIZE_LIMITS.height.min, Math.floor(parsed)));
    }, []);

    const getWindowSizeValidationError = useCallback((widthValue: unknown, heightValue: unknown) => {
        const w = Number(widthValue);
        const h = Number(heightValue);

        if (!Number.isFinite(w) || !Number.isFinite(h)) {
            return 'Width and height must be valid numbers.';
        }

        if (w < WINDOW_SIZE_LIMITS.width.min || w > WINDOW_SIZE_LIMITS.width.max) {
            return `Width must be ${WINDOW_SIZE_LIMITS.width.min}-${WINDOW_SIZE_LIMITS.width.max}px.`;
        }

        if (h < WINDOW_SIZE_LIMITS.height.min || h > WINDOW_SIZE_LIMITS.height.max) {
            return `Height must be ${WINDOW_SIZE_LIMITS.height.min}-${WINDOW_SIZE_LIMITS.height.max}px.`;
        }

        return '';
    }, []);

    const toastIdCounter = useRef(0); // For unique toast IDs
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isWindowFocused, setIsWindowFocused] = useState(document.hasFocus()); // Track window focus state
    const [listForceKey, setListForceKey] = useState(0); // Force virtualizer remount on visibility changes
    const [isAnimatingList, setIsAnimatingList] = useState(true); // Track if list should animate
    const [hasLoadedInitially, setHasLoadedInitially] = useState(false); // Track if we've loaded items at least once
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

    const persistSettings = useCallback((nextSettings: Settings, persistDraft = false) => {
        localStorage.setItem('clip-settings', JSON.stringify(nextSettings));
        if (persistDraft) {
            localStorage.setItem('clip-settingsDraft', JSON.stringify(nextSettings));
        }
        window.electronAPI?.saveSettingsToFile?.(nextSettings);
    }, []);

    const windowSizeError = React.useMemo(() => {
        return getWindowSizeValidationError(
            settingsDraft?.windowWidth ?? settings.windowWidth,
            settingsDraft?.windowHeight ?? settings.windowHeight,
        );
    }, [
        settingsDraft?.windowWidth,
        settingsDraft?.windowHeight,
        settings.windowWidth,
        settings.windowHeight,
        getWindowSizeValidationError,
    ]);
    const inputRef = useRef<HTMLInputElement>(null); // Ref for search input

    // Track if there are unsaved changes in settings
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [showThemeProfileResetConfirm, setShowThemeProfileResetConfirm] = useState(false);
    const [isThemeProfileResetDialogClosing, setIsThemeProfileResetDialogClosing] = useState(false);
    const [showThemeProfileDeleteConfirm, setShowThemeProfileDeleteConfirm] = useState(false);
    const [isThemeProfileDeleteDialogClosing, setIsThemeProfileDeleteDialogClosing] = useState(false);
    const [search, setSearch] = useState('');
    const [filteredType, setFilteredType] = useState<'all' | 'text' | 'image'>('all');
    const dragStateRef = useRef({ dragging: false, dragStarted: false, offsetX: 0, offsetY: 0, startClientX: 0, startClientY: 0 });
    const lastDragEmitRef = useRef(0);

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

    // --- Shortcut warning logic ---
    const [showShortcutInfo, setShowShortcutInfo] = useState(false);

    // --- Backup restore dropdown state ---
    const [backupList, setBackupList] = useState<BackupEntry[]>([]);
    const [selectedBackup, setSelectedBackup] = useState<string>('');

    // --- Backup selection and deletion state ---
    const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set());
    const [showBackupManagement, setShowBackupManagement] = useState(false);
    const [backupDeleteAction, setBackupDeleteAction] = useState<'single' | 'multiple' | null>(null);
    const [backupToDelete, setBackupToDelete] = useState<string>('');
    const [isBackupDeleteDialogClosing, setIsBackupDeleteDialogClosing] = useState(false);

    // --- Theme config state ---
    const [themeEditorConfig, setThemeEditorConfig] = useState<ThemeConfig>(() => createDefaultThemeConfig());
    const [themeSchema, setThemeSchema] = useState<any>(null);
    const [themePaths, setThemePaths] = useState<{ configPath: string; schemaPath: string } | null>(null);
    const [settingsPaths, setSettingsPaths] = useState<{ configPath: string; schemaPath: string } | null>(null);
    const [newThemeProfileName, setNewThemeProfileName] = useState('');
    const [isThemeSaving, setIsThemeSaving] = useState(false);
    const editorThemeProfile = React.useMemo(() => getActiveThemeProfile(themeEditorConfig), [themeEditorConfig]);

    const saveThemeEditorConfig = useCallback(async () => {
        try {
            setIsThemeSaving(true);
            const saved = await window.electronAPI?.saveThemeConfig?.(themeEditorConfig);
            if (saved) {
                const next = sanitizeThemeConfig(saved);
                setThemeConfig(next);
                setThemeEditorConfig(next);
                showToast('success', 'Theme config saved to file.');
            }
        } catch (error) {
            showToast('error', `Failed to save theme config: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsThemeSaving(false);
        }
    }, [themeEditorConfig]);

    const updateEditorActiveProfile = useCallback((updater: (profile: ThemeProfile) => ThemeProfile) => {
        setThemeEditorConfig((prev) => {
            const key = normalizeThemeProfileKey(prev.activeProfile);
            const activeKey = prev.profiles[key] ? key : Object.keys(prev.profiles)[0] || 'default';
            const current = prev.profiles[activeKey] || createDefaultThemeConfig().profiles.default;
            const updated = updater(current);
            return {
                ...prev,
                activeProfile: activeKey,
                profiles: {
                    ...prev.profiles,
                    [activeKey]: updated,
                },
            };
        });
    }, []);

    const loadThemeFromMain = useCallback(async () => {
        try {
            const [config, schema, themeFilePaths, settingsFilePaths] = await Promise.all([
                window.electronAPI?.getThemeConfig?.(),
                window.electronAPI?.getThemeSchema?.(),
                window.electronAPI?.getThemePaths?.(),
                window.electronAPI?.getSettingsPaths?.(),
            ]);

            if (config) {
                const sanitized = sanitizeThemeConfig(config);
                setThemeConfig(sanitized);
                setThemeEditorConfig(sanitized);
            }
            if (schema) {
                setThemeSchema(schema);
            }
            if (themeFilePaths?.configPath && themeFilePaths?.schemaPath) {
                setThemePaths(themeFilePaths);
            }
            if (settingsFilePaths?.configPath && settingsFilePaths?.schemaPath) {
                setSettingsPaths(settingsFilePaths);
            }
        } catch (error) {
            showToast('error', `Failed to load theme config: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    const switchThemeProfile = useCallback(async (profileKey: string) => {
        try {
            const key = normalizeThemeProfileKey(profileKey);
            setThemeEditorConfig(prev => ({ ...prev, activeProfile: key }));
            const next = await window.electronAPI?.setActiveThemeProfile?.(key);
            if (next) {
                const sanitized = sanitizeThemeConfig(next);
                setThemeConfig(sanitized);
                setThemeEditorConfig(sanitized);
            }
        } catch (error) {
            showToast('error', `Failed to switch profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    const createThemeProfileFromInput = useCallback(async () => {
        const name = newThemeProfileName.trim();
        if (!name) return;

        try {
            const saved = await window.electronAPI?.createThemeProfile?.(name);
            if (saved) {
                const sanitized = sanitizeThemeConfig(saved);
                setThemeConfig(sanitized);
                setThemeEditorConfig(sanitized);
                setNewThemeProfileName('');
                showToast('success', 'Theme profile created.');
            }
        } catch (error) {
            showToast('error', `Failed to create profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [newThemeProfileName]);

    const deleteActiveThemeProfile = useCallback(async () => {
        try {
            const saved = await window.electronAPI?.deleteThemeProfile?.(activeThemeProfileKey);
            if (saved) {
                const sanitized = sanitizeThemeConfig(saved);
                setThemeConfig(sanitized);
                setThemeEditorConfig(sanitized);
                showToast('success', 'Theme profile deleted.');
            }
        } catch (error) {
            showToast('error', `Failed to delete profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [activeThemeProfileKey]);

    const resetActiveThemeProfileToDefault = useCallback(async () => {
        try {
            const profileKey = normalizeThemeProfileKey(themeEditorConfig.activeProfile);
            const currentProfile = themeEditorConfig.profiles[profileKey] || editorThemeProfile;
            const defaultProfile = createDefaultThemeConfig().profiles.default;
            const nextConfig = sanitizeThemeConfig({
                ...themeConfig,
                ...themeEditorConfig,
                activeProfile: profileKey,
                profiles: {
                    ...themeEditorConfig.profiles,
                    [profileKey]: {
                        ...defaultProfile,
                        name: currentProfile.name || defaultProfile.name,
                    },
                },
            });

            setThemeConfig(nextConfig);
            setThemeEditorConfig(nextConfig);

            const saved = await window.electronAPI?.saveThemeConfig?.(nextConfig);
            if (saved) {
                const sanitized = sanitizeThemeConfig(saved);
                setThemeConfig(sanitized);
                setThemeEditorConfig(sanitized);
            }

            showToast('success', 'Theme profile reset to default.');
        } catch (error) {
            showToast('error', `Failed to reset profile theme: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [editorThemeProfile, themeConfig, themeEditorConfig]);

    const reloadThemeFromDisk = useCallback(async () => {
        try {
            const next = await window.electronAPI?.reloadThemeConfig?.();
            if (next) {
                const sanitized = sanitizeThemeConfig(next);
                setThemeConfig(sanitized);
                setThemeEditorConfig(sanitized);
                showToast('info', 'Theme config reloaded from file/backup.');
            }
        } catch (error) {
            showToast('error', `Failed to reload theme config: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    const exportThemeJson = useCallback(async () => {
        try {
            const text = await window.electronAPI?.exportThemeConfig?.();
            if (!text) return;
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'clip-theme.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast('success', 'Theme JSON exported.');
        } catch (error) {
            showToast('error', `Failed to export theme JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    const openThemeConfigInSystem = useCallback(async () => {
        try {
            const result = await window.electronAPI?.openThemeConfigFile?.();
            if (result?.ok) {
                showToast('success', 'Opened theme config file in default app.');
            } else {
                showToast('error', `Failed to open theme config file: ${result?.error || 'Unknown error'}`);
            }
        } catch (error) {
            showToast('error', `Failed to open theme config file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    const openSettingsConfigInSystem = useCallback(async () => {
        try {
            const result = await window.electronAPI?.openSettingsConfigFile?.();
            if (result?.ok) {
                showToast('success', 'Opened settings config file in default app.');
            } else {
                showToast('error', `Failed to open settings config file: ${result?.error || 'Unknown error'}`);
            }
        } catch (error) {
            showToast('error', `Failed to open settings config file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    const reloadSettingsFromDisk = useCallback(async () => {
        try {
            const loaded = await window.electronAPI?.reloadSettingsFromDisk?.();
            if (!loaded) return;

            const nextSettings = { ...settings, ...loaded };
            setSettings(nextSettings);
            setSettingsDraft(nextSettings);
            persistSettings(nextSettings, true);

            const profileKey = normalizeThemeProfileKey(themeEditorConfig.activeProfile);
            const currentProfile = themeEditorConfig.profiles[profileKey] || editorThemeProfile;
            const mergedThemeConfig = sanitizeThemeConfig({
                ...themeConfig,
                ...themeEditorConfig,
                activeProfile: profileKey,
                profiles: {
                    ...themeEditorConfig.profiles,
                    [profileKey]: {
                        ...currentProfile,
                        colors: {
                            ...currentProfile.colors,
                            accent: nextSettings.accentColor,
                        },
                        surface: {
                            ...currentProfile.surface,
                            borderRadius: nextSettings.borderRadius,
                            transparency: nextSettings.transparency,
                        },
                    },
                },
            });
            setThemeConfig(mergedThemeConfig);
            setThemeEditorConfig(mergedThemeConfig);
            void window.electronAPI?.saveThemeConfig?.(mergedThemeConfig);

            showToast('info', 'Settings reloaded from disk.');
        } catch (error) {
            showToast('error', `Failed to reload settings from disk: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [editorThemeProfile, persistSettings, settings, themeConfig, themeEditorConfig]);

    const copyTextToClipboard = useCallback(async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            showToast('success', `${label} copied to clipboard.`);
        } catch {
            try {
                const input = document.createElement('textarea');
                input.value = value;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                showToast('success', `${label} copied to clipboard.`);
            } catch (error) {
                showToast('error', `Failed to copy ${label.toLowerCase()}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }, []);

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (!dragStateRef.current.dragging) return;
            const deltaX = Math.abs(event.clientX - dragStateRef.current.startClientX);
            const deltaY = Math.abs(event.clientY - dragStateRef.current.startClientY);
            if (!dragStateRef.current.dragStarted) {
                if (deltaX < 4 && deltaY < 4) {
                    return;
                }
                dragStateRef.current.dragStarted = true;
            }
            const now = Date.now();
            if (now - lastDragEmitRef.current < 16) return;
            lastDragEmitRef.current = now;
            window.electronAPI?.dragWindow?.(
                event.screenX,
                event.screenY,
                dragStateRef.current.offsetX,
                dragStateRef.current.offsetY,
            );
        };

        const onMouseUp = () => {
            dragStateRef.current.dragging = false;
            dragStateRef.current.dragStarted = false;
            dragStateRef.current.offsetX = 0;
            dragStateRef.current.offsetY = 0;
            dragStateRef.current.startClientX = 0;
            dragStateRef.current.startClientY = 0;
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    useEffect(() => {
        loadThemeFromMain();
        const dispose = window.electronAPI?.onThemeConfigUpdated?.((nextConfig) => {
            const sanitized = sanitizeThemeConfig(nextConfig);
            setThemeConfig(sanitized);
            setThemeEditorConfig(sanitized);
        });
        return () => {
            if (typeof dispose === 'function') dispose();
        };
    }, [loadThemeFromMain]);

    useEffect(() => {
        setHasUnsavedChanges(prev => {
            const settingsDifferent = !!(settingsDraft && settings) && JSON.stringify(settingsDraft) !== JSON.stringify(settings);
            const themeDifferent = JSON.stringify(themeEditorConfig) !== JSON.stringify(themeConfig);
            const next = settingsDifferent || themeDifferent;
            return prev === next ? prev : next;
        });
    }, [settingsDraft, settings, themeEditorConfig, themeConfig]);

    const refreshBackupList = useCallback(async () => {
        const list = await window.electronAPI?.listBackups?.();
        setBackupList(list || []);
    }, []);

    useEffect(() => {
        if (showSettings) {
            refreshBackupList();
        }
    }, [showSettings, refreshBackupList]);

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
    const rowVirtualizer = useVirtualizer({
        count: filteredItems.length,
        getScrollElement: () => listRef.current,
        estimateSize: () => 78,
        overscan: 8,
        getItemKey: (index) => filteredItems[index]?.id ?? index,
    });
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
            window.removeEventListener('resize', delayedCheck);
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

    // Delete clipboard item
    const [deleteTarget, setDeleteTarget] = useState<ClipboardItem | null>(null);
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
                } else if (showThemeProfileDeleteConfirm) {
                    setIsThemeProfileDeleteDialogClosing(true);
                    setTimeout(() => {
                        setShowThemeProfileDeleteConfirm(false);
                        setIsThemeProfileDeleteDialogClosing(false);
                    }, 300);
                } else if (showThemeProfileResetConfirm) {
                    setIsThemeProfileResetDialogClosing(true);
                    setTimeout(() => {
                        setShowThemeProfileResetConfirm(false);
                        setIsThemeProfileResetDialogClosing(false);
                    }, 300);
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
    }, [showMaxItemsWarning, isMaxItemsWarningClosing, dangerAction, isDangerDialogClosing, showThemeProfileDeleteConfirm, isThemeProfileDeleteDialogClosing, showThemeProfileResetConfirm, isThemeProfileResetDialogClosing, showSettings, isSettingsDialogClosing, deleteTarget, showRestartConfirm, restartReason, isRestartDialogClosing, showUnsavedChangesConfirm, hasUnsavedChanges, backupDeleteAction, isBackupDeleteDialogClosing]);

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
        const dispose = window.electronAPI.onForceRefresh(handler);
        return () => {
            if (typeof dispose === 'function') dispose();
        };
    }, []);

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

                // Only set isInitialLoading to false after the very first load
                setIsInitialLoading(false);

                log.renderer(`Cache: Updated cache with ${processedItems.length} items`);
            }
        };

        const dispose = window.electronAPI?.onClipboardHistory?.(handleHistory);

        // Show welcome message on startup
        setTimeout(() => {
            showToast('info', 'Welcome to Clip! Your clipboard history is ready.');
        }, 1000);

        return () => {
            isMounted = false;
            if (typeof dispose === 'function') dispose();
        };
    }, []);

    // Listen for new clipboard items and intelligently refresh cache
    useEffect(() => {
        const handler = () => {
            // Invalidate cache since we have new clipboard data
            setLastCacheUpdate(0); // Force cache refresh on next request

            // Request updated history
            window.electronAPI?.requestClipboardHistory?.();
        };
        const dispose = window.electronAPI?.onClipboardItem?.(handler);
        return () => {
            if (typeof dispose === 'function') dispose();
        };
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
        // Invalidate cache since we're modifying data
        setLastCacheUpdate(0);

        // Send delete request to main; main will reply with updated history
        // @ts-ignore
        window.electronAPI?.deleteClipboardItem?.(typeof item.id === 'number' ? item.id : parseInt(item.id, 10));
        // Close delete dialog after fade-out
        setIsDeleteDialogClosing(true);
        setTimeout(() => {
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
        setThemeEditorConfig(themeConfig);
        setShowSettings(true);
        setIsSettingsDialogClosing(false);
    };

    const saveSettings = () => {
        if (windowSizeError) {
            showToast('error', windowSizeError);
            return;
        }

        const profileKey = normalizeThemeProfileKey(themeEditorConfig.activeProfile);
        const currentProfile = themeEditorConfig.profiles[profileKey] || editorThemeProfile;
        const draftAccentColor = settingsDraft?.accentColor ?? settings.accentColor;
        const draftBorderRadius = settingsDraft?.borderRadius ?? settings.borderRadius;
        const draftTransparency = settingsDraft?.transparency ?? settings.transparency;

        const mergedThemeConfig = sanitizeThemeConfig({
            ...themeConfig,
            ...themeEditorConfig,
            activeProfile: profileKey,
            profiles: {
                ...themeEditorConfig.profiles,
                [profileKey]: {
                    ...currentProfile,
                    colors: {
                        ...currentProfile.colors,
                        accent: draftAccentColor,
                    },
                    surface: {
                        ...currentProfile.surface,
                        borderRadius: draftBorderRadius,
                        transparency: draftTransparency,
                    },
                },
            },
        });

        if (settingsDraft) {
            setSettings(settingsDraft);

            // Show toast notification for settings saved
            showToast('success', 'Settings saved successfully');
            persistSettings(settingsDraft);
        }

        setThemeConfig(mergedThemeConfig);
        setThemeEditorConfig(mergedThemeConfig);
        void window.electronAPI?.saveThemeConfig?.(mergedThemeConfig);

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
            setThemeEditorConfig(themeConfig);
            setIsSettingsDialogClosing(false);
        }, 300);
    }; const resetSettings = () => {
        setDangerAction(null);
        setSettings(DEFAULT_SETTINGS);
        // Update settings draft to reflect the default values
        setSettingsDraft(DEFAULT_SETTINGS);

        persistSettings(DEFAULT_SETTINGS);

        showToast('success', 'Settings reset to default values');
        // Close the settings window after successful reset
        setIsSettingsDialogClosing(true);
        setTimeout(() => {
            setShowSettings(false);
            setSettingsDraft(null);
            setIsSettingsDialogClosing(false);
        }, 300);
    };

    // Enhanced window visibility management with smart caching
    useEffect(() => {
        const handleFocus = () => {
            if (!isWindowFocused) { // Only act if changing from unfocused to focused
                setIsWindowFocused(true);
                setIsAnimatingList(true);
                setListForceKey(k => k + 1);

                // Try cache first for instant display, then fetch fresh data
                if (!useCacheIfValid()) {
                    // Cache miss or invalid - fetch fresh data
                    setTimeout(() => {
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
                setListForceKey(k => k + 1);

                // Try cache first for instant display, then fetch fresh data
                if (!useCacheIfValid()) {
                    // Cache miss or invalid - fetch fresh data
                    setTimeout(() => {
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

    useEffect(() => {
        if (!window.electronAPI?.onWindowWillShow) return;
        const handleWillShow = () => {
            setIsWindowFocused(true);
            setIsAnimatingList(true);
            setListForceKey(k => k + 1);
            window.electronAPI?.requestClipboardHistory?.();
        };
        const dispose = window.electronAPI.onWindowWillShow(handleWillShow);
        return () => {
            if (typeof dispose === 'function') dispose();
        };
    }, []);

    useEffect(() => {
        const saveSettingsBeforeQuit = () => {
            // Persist current settings to localStorage (or other storage if needed)
            localStorage.setItem('clip-settings', JSON.stringify(settings));
        };
        const dispose = window.electronAPI?.onSaveSettingsBeforeQuit?.(saveSettingsBeforeQuit);
        return () => {
            if (typeof dispose === 'function') dispose();
        };
    }, [settings]);

    // Note: isAnimatingList is no longer needed for controlling individual item animations
    // Items animate naturally when the list key changes and the container remounts

    const handleSearchChange = (newSearch: string) => {
        setSearch(newSearch);
        setIsAnimatingList(true);
        listRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    };

    const handleFilterChange = () => {
        setFilteredType(t => t === 'all' ? 'text' : t === 'text' ? 'image' : 'all');
        setIsAnimatingList(true);
        listRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    };

    const effectiveAccentColor = themeColors.accent || settings.accentColor;
    const effectiveBorderRadius = themeSurface.borderRadius ?? settings.borderRadius;
    const effectiveTransparency = themeSurface.transparency ?? settings.transparency;

    const closeDangerDialog = () => {
        setIsDangerDialogClosing(true);
        setTimeout(() => {
            setDangerAction(null);
            setIsDangerDialogClosing(false);
        }, 300);
    };

    const closeRestartDialog = () => {
        setIsRestartDialogClosing(true);
        setTimeout(() => {
            setShowRestartConfirm(false);
            setRestartReason(null);
            setIsRestartDialogClosing(false);
        }, 300);
    };

    const handleUnsavedSave = () => {
        if (settingsDraft) {
            setSettings(settingsDraft);
        }
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
    };

    const handleUnsavedDontSave = () => {
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
    };

    const handleUnsavedCancel = () => {
        setIsUnsavedChangesDialogClosing(true);
        setTimeout(() => {
            setShowUnsavedChangesConfirm(null);
            setIsUnsavedChangesDialogClosing(false);
        }, 300);
    };

    const closeBackupDeleteDialog = () => {
        setIsBackupDeleteDialogClosing(true);
        setTimeout(() => {
            setBackupDeleteAction(null);
            setBackupToDelete('');
            setIsBackupDeleteDialogClosing(false);
        }, 300);
    };

    const handleConfirmBackupDelete = async () => {
        try {
            let success = false;

            if (backupDeleteAction === 'single' && backupToDelete) {
                success = await window.electronAPI?.deleteBackup?.(backupToDelete);
                if (success) {
                    showToast('success', 'Backup deleted successfully');
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
                    if (selectedBackups.has(selectedBackup)) {
                        setSelectedBackup('');
                    }
                    setSelectedBackups(new Set());
                } else {
                    showToast('error', 'Failed to delete backups');
                }
            }

            const newList = (await window.electronAPI?.listBackups?.()) || [];
            setBackupList(newList);
        } catch (error) {
            log.error('Delete backup error', error instanceof Error ? error.message : String(error));
            showToast('error', `Delete failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        closeBackupDeleteDialog();
    };

    const closeThemeProfileResetDialog = () => {
        setIsThemeProfileResetDialogClosing(true);
        setTimeout(() => {
            setShowThemeProfileResetConfirm(false);
            setIsThemeProfileResetDialogClosing(false);
        }, 300);
    };

    const handleConfirmThemeProfileReset = () => {
        closeThemeProfileResetDialog();
        void resetActiveThemeProfileToDefault();
    };

    const closeThemeProfileDeleteDialog = () => {
        setIsThemeProfileDeleteDialogClosing(true);
        setTimeout(() => {
            setShowThemeProfileDeleteConfirm(false);
            setIsThemeProfileDeleteDialogClosing(false);
        }, 300);
    };

    const handleConfirmThemeProfileDelete = async () => {
        closeThemeProfileDeleteDialog();
        await deleteActiveThemeProfile();
    };

    const closeMaxItemsWarningDialog = () => {
        setIsMaxItemsWarningClosing(true);
        setTimeout(() => {
            setShowMaxItemsWarning(false);
            setPendingMaxItems(null);
            setBackupCreated(false);
            setMaxItemsInputValue(null);
            setHasMaxItemsChanges(false);
            setIsMaxItemsWarningClosing(false);
        }, 300);
    };

    const handleCreateBackupForMaxItems = async () => {
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
    };

    const handleConfirmMaxItemsWarning = async () => {
        if (pendingMaxItems !== null) {
            const currentMaxItems = settingsDraft?.maxItems ?? settings.maxItems;
            const newSettings = settingsDraft
                ? { ...settingsDraft, maxItems: pendingMaxItems }
                : { ...settings, maxItems: pendingMaxItems };
            setSettingsDraft(newSettings);
            setSettings(newSettings);
            persistSettings(newSettings);

            if (pendingMaxItems < currentMaxItems && items.length > pendingMaxItems) {
                try {
                    await window.electronAPI?.trimClipboardItems?.(pendingMaxItems);
                    showToast('info', `Clipboard trimmed to ${pendingMaxItems} items`);
                } catch (error) {
                    console.error('Failed to trim clipboard items:', error);
                    showToast('error', 'Failed to trim clipboard items');
                }
            }
        }

        closeMaxItemsWarningDialog();
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
            >
                <ToastContainer
                    toasts={toasts}
                    accentColor={themeColors.success}
                    onDismiss={dismissToast}
                    onClearAll={clearAllToasts}
                />

                <div
                    className="clip-header"
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5vh', position: 'relative', zIndex: 3, cursor: 'default' }}
                    onMouseDown={(event) => {
                        if (showSettings) return;
                        if (event.button !== 0) return;
                        const target = event.target as HTMLElement | null;
                        if (
                            target?.closest('button') ||
                            target?.closest('input') ||
                            target?.closest('select') ||
                            target?.closest('.clip-title')
                        ) {
                            return;
                        }
                        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                        dragStateRef.current.dragging = true;
                        dragStateRef.current.dragStarted = false;
                        dragStateRef.current.offsetX = event.clientX - rect.left;
                        dragStateRef.current.offsetY = event.clientY - rect.top;
                        dragStateRef.current.startClientX = event.clientX;
                        dragStateRef.current.startClientY = event.clientY;
                        lastDragEmitRef.current = 0;
                    }}
                >
                    <span className="clip-title" style={{ fontWeight: themeTypography.fontWeightBold, fontSize: themeTypography.titleFontSize, color: themeColors.textPrimary }}>
                        <span style={{ marginRight: 6 }}>
                            <IconGlyph value={themeIcons.clipboard} fallback="📋" label="Clipboard" size={16} />
                        </span>
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
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
                            background: themeColors.inputBackground,
                            border: `1px solid ${themeColors.inputBorder}`,
                            borderRadius: 8,
                            color: themeColors.textPrimary,
                            padding: '4px 12px',
                            cursor: 'pointer',
                            transition: 'background 0.2s, border 0.2s'
                        }}
                        onClick={openSettings}
                    >
                        <IconGlyph value={themeIcons.settings} fallback="⚙️" label="Settings" size={16} />
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
                                border: `1px solid ${themeColors.inputBorder}`,
                                background: themeColors.inputBackground,
                                color: themeColors.textPrimary,
                                padding: '0 32px 0 14px',
                                fontSize: themeTypography.baseFontSize,
                                outline: 'none',
                                transition: 'border 0.2s, box-shadow 0.3s',
                                boxSizing: 'border-box',
                            }}
                            spellCheck={false}
                            autoFocus={false}
                        />
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.7, pointerEvents: 'none', fontSize: 16 }}>
                            <IconGlyph value={themeIcons.search} fallback="🔍" label="Search" size={14} />
                        </span>
                    </div>
                    <button
                        style={{
                            flexShrink: 0,
                            height: 40,
                            background: themeColors.inputBackground,
                            border: `1px solid ${themeColors.inputBorder}`,
                            borderRadius: 8,
                            color: themeColors.textPrimary,
                            padding: '0 18px',
                            fontSize: themeTypography.baseFontSize,
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
                        borderRadius: `${effectiveBorderRadius}px`,
                        overflow: 'visible',
                        backdropFilter: 'blur(8px)',
                        background: themeColors.overlayBackground
                    }} onAnimationEnd={() => {
                        if (isSettingsDialogClosing) {
                            setShowSettings(false);
                            setSettingsDraft(null);
                            setIsSettingsDialogClosing(false);
                        }
                    }}>
                        <div className={`clip-settings-page ${isSettingsDialogClosing ? 'fade-out' : 'fade-in'}`} style={{
                            background: themeColors.panelBackground,
                            borderRadius: `${effectiveBorderRadius}px`,
                            width: `${settings.windowWidth}px`,
                            height: `${settings.windowHeight}px`,
                            padding: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'border-radius 0.3s, background 0.3s',
                            // boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.2)',
                            border: `${themeSurface.panelBorderWidth}px solid ${themeColors.border}`
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
                                                                persistSettings(newSettings);

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
                                <div>
                                    <h2 style={{ ...sectionHeaderStyle, color: '#e1e1e1', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Window Size</h2>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                                            <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Width (px)</span>
                                            <input
                                                className="settings-input"
                                                type="number"
                                                min={WINDOW_SIZE_LIMITS.width.min}
                                                max={WINDOW_SIZE_LIMITS.width.max}
                                                value={settingsDraft?.windowWidth ?? settings.windowWidth}
                                                onChange={e => setSettingsDraft(s => s ? { ...s, windowWidth: clampWindowWidth(e.target.value) } : null)}
                                                style={{
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: '#fff',
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    outline: 'none'
                                                }}
                                            />
                                        </label>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                                            <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Height (px)</span>
                                            <input
                                                className="settings-input"
                                                type="number"
                                                min={WINDOW_SIZE_LIMITS.height.min}
                                                max={WINDOW_SIZE_LIMITS.height.max}
                                                value={settingsDraft?.windowHeight ?? settings.windowHeight}
                                                onChange={e => setSettingsDraft(s => s ? { ...s, windowHeight: clampWindowHeight(e.target.value) } : null)}
                                                style={{
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: '#fff',
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    outline: 'none'
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: 12, color: windowSizeError ? '#ff4136' : '#888', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{windowSizeError || `Allowed: ${WINDOW_SIZE_LIMITS.width.min}-${WINDOW_SIZE_LIMITS.width.max}px width, ${WINDOW_SIZE_LIMITS.height.min}-${WINDOW_SIZE_LIMITS.height.max}px height.`}</span>
                                        <button
                                            onClick={() => {
                                                setSettingsDraft(s => s ? {
                                                    ...s,
                                                    windowWidth: WINDOW_SIZE_LIMITS.width.default,
                                                    windowHeight: WINDOW_SIZE_LIMITS.height.default
                                                } : null);
                                                showToast('info', 'Window dimensions reset to default');
                                            }}
                                            style={{
                                                background: 'rgba(255,255,255,0.08)',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                color: '#ccc',
                                                borderRadius: 6,
                                                padding: '4px 10px',
                                                fontSize: 11,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                                                e.currentTarget.style.color = '#fff';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                e.currentTarget.style.color = '#ccc';
                                            }}
                                        >
                                            Reset to Default
                                        </button>
                                    </div>
                                </div>
                                <SettingsBackupsSection
                                    settingsDraft={settingsDraft}
                                    settings={settings}
                                    setSettingsDraft={setSettingsDraft}
                                    isBackingUp={isBackingUp}
                                    setIsBackingUp={setIsBackingUp}
                                    setBackupList={setBackupList}
                                    setSelectedBackup={setSelectedBackup}
                                    showToast={showToast}
                                    log={log}
                                    refreshBackupList={refreshBackupList}
                                    showBackupManagement={showBackupManagement}
                                    setShowBackupManagement={setShowBackupManagement}
                                    backupList={backupList}
                                    selectedBackups={selectedBackups}
                                    setSelectedBackups={setSelectedBackups}
                                    selectedBackup={selectedBackup}
                                    setBackupToDelete={setBackupToDelete}
                                    setBackupDeleteAction={setBackupDeleteAction}
                                />
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
                                                        const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
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

                                <SettingsThemeSection
                                    activeThemeProfileKey={activeThemeProfileKey}
                                    switchThemeProfile={switchThemeProfile}
                                    themeEditorConfig={themeEditorConfig}
                                    newThemeProfileName={newThemeProfileName}
                                    setNewThemeProfileName={setNewThemeProfileName}
                                    createThemeProfileFromInput={createThemeProfileFromInput}
                                    setShowThemeProfileDeleteConfirm={setShowThemeProfileDeleteConfirm}
                                    setIsThemeProfileDeleteDialogClosing={setIsThemeProfileDeleteDialogClosing}
                                    setShowThemeProfileResetConfirm={setShowThemeProfileResetConfirm}
                                    setIsThemeProfileResetDialogClosing={setIsThemeProfileResetDialogClosing}
                                    themeColors={themeColors}
                                    reloadThemeFromDisk={reloadThemeFromDisk}
                                    editorThemeProfile={editorThemeProfile}
                                    settingsDraft={settingsDraft}
                                    settings={settings}
                                    setSettingsDraft={setSettingsDraft}
                                    updateEditorActiveProfile={updateEditorActiveProfile}
                                    isThemeSaving={isThemeSaving}
                                    saveThemeEditorConfig={saveThemeEditorConfig}
                                    openThemeConfigInSystem={openThemeConfigInSystem}
                                    exportThemeJson={exportThemeJson}
                                    themePaths={themePaths}
                                    copyTextToClipboard={copyTextToClipboard}
                                    themeSchema={themeSchema}
                                />

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

                                <div style={{ marginTop: 10, padding: 14, border: `1px solid ${themeColors.border}`, borderRadius: 12, background: themeColors.panelBackground }}>
                                    <div style={{ fontSize: 13, color: themeColors.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
                                        Settings file path:{' '}
                                        <code
                                            style={{ color: themeColors.textPrimary, cursor: 'pointer', textDecoration: 'underline' }}
                                            title="click to copy"
                                            onClick={() => {
                                                if (!settingsPaths?.configPath) return;
                                                void copyTextToClipboard(settingsPaths.configPath, 'Settings file path');
                                            }}
                                        >
                                            {settingsPaths?.configPath || 'AppData/clip-settings.json'}
                                        </code>
                                        <br />
                                        Settings schema path:{' '}
                                        <code
                                            style={{ color: themeColors.textPrimary, cursor: 'pointer', textDecoration: 'underline' }}
                                            title="click to copy"
                                            onClick={() => {
                                                if (!settingsPaths?.schemaPath) return;
                                                void copyTextToClipboard(settingsPaths.schemaPath, 'Settings schema path');
                                            }}
                                        >
                                            {settingsPaths?.schemaPath || 'AppData/clip-settings.schema.json'}
                                        </code>
                                    </div>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                        <button
                                            className="settings-button"
                                            style={{
                                                background: 'rgba(255,255,255,0.08)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 8,
                                                color: '#fff',
                                                padding: '9px 12px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                            onClick={() => {
                                                void openSettingsConfigInSystem();
                                            }}
                                        >
                                            Open Settings JSON
                                        </button>
                                        <button
                                            className="settings-button"
                                            style={{
                                                background: 'rgba(255,255,255,0.08)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 8,
                                                color: '#fff',
                                                padding: '9px 12px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                            onClick={() => {
                                                void reloadSettingsFromDisk();
                                            }}
                                        >
                                            Reload Settings From Disk
                                        </button>
                                    </div>
                                </div>

                                {/* Danger Area section */}
                                <div style={{
                                    marginTop: 32,
                                    padding: 18,
                                    border: `2px solid ${themeColors.danger}`,
                                    borderRadius: 12,
                                    background: `${themeColors.danger}14`,
                                    color: themeColors.danger,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 16,
                                }}>
                                    <h2 id='danger-area' style={{ fontSize: 18, fontWeight: 700, color: themeColors.danger, margin: 0, marginBottom: 8 }}>Danger Area</h2>
                                    <div style={{ fontSize: 15, color: themeColors.danger, marginBottom: 8 }}>
                                        These actions are irreversible. Please proceed with caution.
                                    </div>
                                    <button
                                        style={{ background: themeColors.danger, border: `1px solid ${themeColors.danger}`, borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}
                                        onClick={() => setDangerAction('clear')}
                                    >
                                        Clear All Clipboard History
                                    </button>
                                    <div style={{ fontSize: 13, color: themeColors.danger, marginBottom: 8, marginTop: -8 }}>
                                        This will permanently delete all clipboard items.
                                    </div>
                                    <button
                                        style={{ background: themeColors.warning, border: `1px solid ${themeColors.warning}`, borderRadius: 8, color: '#222', padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}
                                        onClick={() => setDangerAction('reset')}
                                    >
                                        Reset Settings to Default
                                    </button>
                                    <div id='reset-settings-warning' style={{ fontSize: 13, color: themeColors.warning, marginTop: -8 }}>
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
                {/* Clipboard list */}
                <ClipboardList
                    listRef={listRef}
                    settings={settings}
                    hasScrollbar={hasScrollbar}
                    logger={log}
                    isInitialLoading={isInitialLoading}
                    isAnimatingList={isAnimatingList}
                    filteredItems={filteredItems}
                    search={search}
                    filteredType={filteredType}
                    rowVirtualizer={rowVirtualizer}
                    listForceKey={listForceKey}
                    themeColors={themeColors}
                    themeIcons={themeIcons}
                    handlePaste={handlePaste}
                    handleTogglePin={handleTogglePin}
                    handleDeleteItem={handleDeleteItem}
                />
                <AppInlineStyles
                    settings={settings}
                    themeColors={themeColors}
                    themeTypography={themeTypography}
                    themeSurface={themeSurface}
                    effectiveBorderRadius={effectiveBorderRadius}
                />

                <AppDialogs
                    settings={settings}
                    themeColors={themeColors}
                    itemsLength={items.length}
                    deleteTarget={deleteTarget}
                    isDeleteDialogClosing={isDeleteDialogClosing}
                    confirmDelete={confirmDelete}
                    handleDeleteDialogClose={handleDeleteDialogClose}
                    dangerAction={dangerAction}
                    isDangerDialogClosing={isDangerDialogClosing}
                    handleClearAll={handleClearAll}
                    resetSettings={resetSettings}
                    closeDangerDialog={closeDangerDialog}
                    showRestartConfirm={showRestartConfirm}
                    isRestartDialogClosing={isRestartDialogClosing}
                    restartReason={restartReason}
                    closeRestartDialog={closeRestartDialog}
                    restartApp={() => window.electronAPI?.restartApp?.()}
                    showUnsavedChangesConfirm={showUnsavedChangesConfirm}
                    isUnsavedChangesDialogClosing={isUnsavedChangesDialogClosing}
                    handleUnsavedSave={handleUnsavedSave}
                    handleUnsavedDontSave={handleUnsavedDontSave}
                    handleUnsavedCancel={handleUnsavedCancel}
                    backupDeleteAction={backupDeleteAction}
                    isBackupDeleteDialogClosing={isBackupDeleteDialogClosing}
                    selectedBackupsSize={selectedBackups.size}
                    onConfirmBackupDelete={handleConfirmBackupDelete}
                    onCancelBackupDelete={closeBackupDeleteDialog}
                    showThemeProfileResetConfirm={showThemeProfileResetConfirm}
                    isThemeProfileResetDialogClosing={isThemeProfileResetDialogClosing}
                    onConfirmThemeProfileReset={handleConfirmThemeProfileReset}
                    onCancelThemeProfileReset={closeThemeProfileResetDialog}
                    showThemeProfileDeleteConfirm={showThemeProfileDeleteConfirm}
                    isThemeProfileDeleteDialogClosing={isThemeProfileDeleteDialogClosing}
                    activeThemeProfileName={themeEditorConfig.profiles[activeThemeProfileKey]?.name || activeThemeProfileKey}
                    onConfirmThemeProfileDelete={handleConfirmThemeProfileDelete}
                    onCancelThemeProfileDelete={closeThemeProfileDeleteDialog}
                    showMaxItemsWarning={showMaxItemsWarning}
                    isMaxItemsWarningClosing={isMaxItemsWarningClosing}
                    pendingMaxItems={pendingMaxItems}
                    currentMaxItems={settingsDraft?.maxItems ?? settings.maxItems}
                    backupCreated={backupCreated}
                    onCreateBackupFirst={handleCreateBackupForMaxItems}
                    onConfirmMaxItemsWarning={handleConfirmMaxItemsWarning}
                    onCancelMaxItemsWarning={closeMaxItemsWarningDialog}
                />
            </div>
        </ThemeProvider>
    );
};

export default App;
