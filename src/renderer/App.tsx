import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import ThemeProvider from './ThemeProvider';
import ToastContainer from './components/ToastContainer';
import { log, isDev } from '../logger';
import {
    DEFAULT_SETTINGS,
} from './app-constants';
import type { BackupEntry, ClipboardItem, Settings } from './app-types';
import AppDialogs from './components/AppDialogs';
import AppInlineStyles from './components/AppInlineStyles';
import ClipboardList from './components/ClipboardList';
import IconGlyph from './components/IconGlyph';
import SettingsBehaviorSection from './components/SettingsBehaviorSection';
import SettingsBackupsSection from './components/SettingsBackupsSection';
import SettingsDataSection from './components/SettingsDataSection';
import SettingsGeneralSection from './components/SettingsGeneralSection';
import SettingsModalFooter from './components/SettingsModalFooter';
import SettingsThemeSection from './components/SettingsThemeSection';
import { useShortcutDraft } from './hooks/useShortcutDraft';
import { useThemeConfigManager } from './hooks/useThemeConfigManager';
import { useToastManager } from './hooks/useToastManager';
import {
    WINDOW_SIZE_LIMITS,
    normalizeThemeProfileKey,
    sanitizeThemeConfig,
} from '../theme-config';

const App: React.FC = () => {
    const [items, setItems] = useState<ClipboardItem[]>([]);
    const [settings, setSettings] = useState<Settings>(() => {
        const saved = localStorage.getItem('clip-settings');
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    });
    const { toasts, showToast, dismissToast, clearAllToasts } = useToastManager();

    const {
        themeConfig,
        setThemeConfig,
        themeEditorConfig,
        setThemeEditorConfig,
        themeSchema,
        themePaths,
        settingsPaths,
        newThemeProfileName,
        setNewThemeProfileName,
        isThemeSaving,
        activeThemeProfileKey,
        editorThemeProfile,
        themeColors,
        themeTypography,
        themeSurface,
        themeIcons,
        saveThemeEditorConfig,
        updateEditorActiveProfile,
        switchThemeProfile,
        createThemeProfileFromInput,
        deleteActiveThemeProfile,
        resetActiveThemeProfileToDefault,
        reloadThemeFromDisk,
        exportThemeJson,
        openThemeConfigInSystem,
        openSettingsConfigInSystem,
    } = useThemeConfigManager({ showToast });

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

    const {
        shortcutModifiers,
        setShortcutModifiers,
        shortcutMainKey,
        setShortcutMainKey,
        showShortcutInfo,
        setShowShortcutInfo,
    } = useShortcutDraft({
        settingsDraft,
        settings,
        setSettingsDraft,
    });

    // Handle system theme changes
    const handleSystemThemeChange = () => {
        // Force re-render when system theme changes (when using 'system' theme setting)
        // if (settings.theme === 'system') {
        setSettings({ ...settings });
        // }
    };

    // --- Backup restore dropdown state ---
    const [backupList, setBackupList] = useState<BackupEntry[]>([]);
    const [selectedBackup, setSelectedBackup] = useState<string>('');

    // --- Backup selection and deletion state ---
    const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set());
    const [showBackupManagement, setShowBackupManagement] = useState(false);
    const [backupDeleteAction, setBackupDeleteAction] = useState<'single' | 'multiple' | null>(null);
    const [backupToDelete, setBackupToDelete] = useState<string>('');
    const [isBackupDeleteDialogClosing, setIsBackupDeleteDialogClosing] = useState(false);

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
        setHasUnsavedChanges(prev => {
            const settingsDifferent = !!(settingsDraft && settings) && JSON.stringify(settingsDraft) !== JSON.stringify(settings);
            const themeDifferent = JSON.stringify(themeEditorConfig) !== JSON.stringify(themeConfig);
            const next = settingsDifferent || themeDifferent;
            return prev === next ? prev : next;
        });
    }, [settingsDraft, settings, themeEditorConfig, themeConfig]);

    useEffect(() => {
        if (!showSettings) {
            return;
        }

        setSettingsDraft((draft) => {
            if (!draft) {
                return draft;
            }

            const syncedAccent = editorThemeProfile.colors.accent;
            const syncedBorderRadius = editorThemeProfile.surface.borderRadius;
            const syncedTransparency = editorThemeProfile.surface.transparency;

            if (
                draft.accentColor === syncedAccent
                && draft.borderRadius === syncedBorderRadius
                && draft.transparency === syncedTransparency
            ) {
                return draft;
            }

            return {
                ...draft,
                accentColor: syncedAccent,
                borderRadius: syncedBorderRadius,
                transparency: syncedTransparency,
            };
        });
    }, [
        showSettings,
        editorThemeProfile.colors.accent,
        editorThemeProfile.surface.borderRadius,
        editorThemeProfile.surface.transparency,
    ]);

    const refreshBackupList = useCallback(async () => {
        const list = await window.electronAPI?.listBackups?.();
        setBackupList(list || []);
    }, []);

    useEffect(() => {
        if (showSettings) {
            refreshBackupList();
        }
    }, [showSettings, refreshBackupList]);

    // Reset animation state after animations complete
    useEffect(() => {
        if (isAnimatingList) {
            const timeout = setTimeout(() => {
                setIsAnimatingList(false);
            }, 400); // Allow time for all animations to complete (400ms duration)
            return () => clearTimeout(timeout);
        }
    }, [isAnimatingList]);

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

        const temporaryItems = result
            .filter((item) => item.isTemporary)
            .sort((a, b) => b.timestamp - a.timestamp);
        const regularItems = result
            .filter((item) => !item.isTemporary)
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return b.timestamp - a.timestamp;
            });

        return [...temporaryItems, ...regularItems];
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

    const handleQuitFromSettings = () => {
        if (hasUnsavedChanges) {
            setShowUnsavedChangesConfirm('quit');
        } else {
            window.electronAPI?.quitApp?.();
        }
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
                                <SettingsGeneralSection
                                    settingsDraft={settingsDraft}
                                    settings={settings}
                                    setSettingsDraft={setSettingsDraft}
                                    setSettings={setSettings}
                                    persistSettings={persistSettings}
                                    maxItemsInputValue={maxItemsInputValue}
                                    setMaxItemsInputValue={setMaxItemsInputValue}
                                    hasMaxItemsChanges={hasMaxItemsChanges}
                                    setHasMaxItemsChanges={setHasMaxItemsChanges}
                                    setPendingMaxItems={setPendingMaxItems}
                                    setBackupCreated={setBackupCreated}
                                    setShowMaxItemsWarning={setShowMaxItemsWarning}
                                    itemsLength={items.length}
                                    shortcutModifiers={shortcutModifiers}
                                    setShortcutModifiers={setShortcutModifiers}
                                    shortcutMainKey={shortcutMainKey}
                                    setShortcutMainKey={setShortcutMainKey}
                                    showShortcutInfo={showShortcutInfo}
                                    setShowShortcutInfo={setShowShortcutInfo}
                                    clampWindowWidth={clampWindowWidth}
                                    clampWindowHeight={clampWindowHeight}
                                    windowSizeError={windowSizeError}
                                    showToast={showToast}
                                />
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
                                <SettingsDataSection
                                    handleExportSettings={handleExportSettings}
                                    handleImportSettings={handleImportSettings}
                                    showToast={showToast}
                                    logger={log}
                                />

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
                                <SettingsBehaviorSection
                                    settingsDraft={settingsDraft}
                                    settings={settings}
                                    setSettingsDraft={setSettingsDraft}
                                    settingsPaths={settingsPaths}
                                    copyTextToClipboard={copyTextToClipboard}
                                    openSettingsConfigInSystem={openSettingsConfigInSystem}
                                    reloadSettingsFromDisk={reloadSettingsFromDisk}
                                    setDangerAction={setDangerAction}
                                    themeColors={themeColors}
                                />
                            </div>
                            <SettingsModalFooter
                                settingsDraft={settingsDraft}
                                settings={settings}
                                onQuitRequest={handleQuitFromSettings}
                                onSave={saveSettings}
                                onCancel={cancelSettings}
                            />
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
