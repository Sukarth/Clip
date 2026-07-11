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
import type { BackupEntry, Settings } from './app-types';
import AppDialogs from './components/AppDialogs';
import FirstRunDialog from './components/dialogs/FirstRunDialog';
import SyncPassphraseDialog from './components/dialogs/SyncPassphraseDialog';
import AppInlineStyles from './components/AppInlineStyles';
import ClipboardList from './components/ClipboardList';
import IconGlyph from './components/IconGlyph';
import SettingsBehaviorSection from './components/SettingsBehaviorSection';
import SettingsBackupsSection from './components/SettingsBackupsSection';
import SettingsDataSection from './components/SettingsDataSection';
import SettingsGeneralSection from './components/SettingsGeneralSection';
import SettingsThemeSection from './components/SettingsThemeSection';
import { useClipboardManager } from './hooks/useClipboardManager';
import { useShortcutDraft } from './hooks/useShortcutDraft';
import { useThemeConfigManager } from './hooks/useThemeConfigManager';
import { useToastManager } from './hooks/useToastManager';
import {
    WINDOW_SIZE_LIMITS,
    normalizeThemeProfileKey,
    sanitizeThemeConfig,
} from '../theme-config';

type SettingsSectionKey = 'General' | 'Behavior' | 'Backups' | 'Data' | 'Theme' | 'Profile' | 'About';

const PRIMARY_SETTINGS_SECTIONS: Array<{
    key: Exclude<SettingsSectionKey, 'About'>;
    label: string;
    icon: string;
}> = [
    { key: 'General', label: 'General', icon: 'settings' },
    { key: 'Behavior', label: 'Behavior', icon: 'gesture' },
    { key: 'Backups', label: 'Backups', icon: 'backup' },
    { key: 'Data', label: 'Data', icon: 'database' },
    { key: 'Theme', label: 'Theme', icon: 'palette' },
    { key: 'Profile', label: 'Profile', icon: 'person' },
];

const App: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(() => {
        const saved = localStorage.getItem('clip-settings');
        if (!saved) {
            return DEFAULT_SETTINGS;
        }

        try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch {
            localStorage.removeItem('clip-settings');
        }

        return DEFAULT_SETTINGS;
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
        captureThemeEditorSnapshot,
        revertThemeEditorToSnapshot,
        hasThemeEditorChangesSinceOpen,
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

    // Restore settings modal state and draft from localStorage
    const [showSettings, setShowSettings] = useState(() => localStorage.getItem('clip-showSettings') === 'true');
    const [settingsDraft, setSettingsDraftState] = useState<Settings | null>(() => {
        const draft = localStorage.getItem('clip-settingsDraft');
        if (!draft) {
            return null;
        }

        try {
            return JSON.parse(draft);
        } catch {
            localStorage.removeItem('clip-settingsDraft');
            return null;
        }
    });

    const persistSettings = useCallback((nextSettings: Settings, persistDraft = false) => {
        localStorage.setItem('clip-settings', JSON.stringify(nextSettings));
        if (persistDraft) {
            localStorage.setItem('clip-settingsDraft', JSON.stringify(nextSettings));
        }
        window.electronAPI?.saveSettingsToFile?.(nextSettings);
    }, []);

    const setSettingsDraft = useCallback((value: React.SetStateAction<Settings | null>) => {
        setSettingsDraftState((prev) => {
            const next = typeof value === 'function'
                ? (value as (prevState: Settings | null) => Settings | null)(prev)
                : value;

            if (!next) {
                return next;
            }

            const current = settingsRef.current;
            if (JSON.stringify(next) !== JSON.stringify(current)) {
                isInternalSettingsSyncRef.current = true;
                setSettings(next);
                persistSettings(next, true);
            }

            return next;
        });
    }, [persistSettings]);

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
    const settingsModalRef = useRef<HTMLDivElement>(null);
    const settingsRef = useRef(settings);
    const isInternalSettingsSyncRef = useRef(false);

    // Track if there are unsaved changes in settings
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionKey>('General');
    const [settingsNavigationStack, setSettingsNavigationStack] = useState<SettingsSectionKey[]>([]);

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

    // Cloud account state (browser sign-in via the loopback flow)
    const [account, setAccount] = useState<AuthState>({ loggedIn: false, email: null, name: null, avatarUrl: null, isPro: false, plan: null });
    const [authBusy, setAuthBusy] = useState(false);
    // One-time first-run welcome (sign in for sync / continue offline).
    const [showFirstRun, setShowFirstRun] = useState(false);
    useEffect(() => {
        const refreshAccount = () => window.electronAPI.auth.getState().then(setAccount).catch(() => { });
        // Initial load: fetch the account, then decide the one-time welcome only
        // once we know whether the user is already signed in — and mark it seen
        // immediately so it never reappears later (e.g. after a sign-out).
        window.electronAPI.auth.getState().then((s) => {
            setAccount(s);
            try {
                if (!localStorage.getItem('clip.firstRunSeen')) {
                    if (!s.loggedIn) setShowFirstRun(true);
                    localStorage.setItem('clip.firstRunSeen', '1');
                }
            } catch { /* ignore */ }
        }).catch(() => { });
        const unsub = window.electronAPI.auth.onChanged(setAccount);
        // Pick up name / avatar / plan changes made on the website each time the
        // window is summoned, without needing a restart.
        const unsubShow = window.electronAPI.onWindowWillShow?.(refreshAccount);
        return () => {
            if (typeof unsub === 'function') unsub();
            if (typeof unsubShow === 'function') unsubShow();
        };
    }, []);

    // Cloud sync state
    const [syncStatus, setSyncStatus] = useState<SyncStatusView | null>(null);
    const [syncModal, setSyncModal] = useState<{ open: boolean; mode: 'enter' | 'reset'; busy: boolean; error: string | null }>({ open: false, mode: 'enter', busy: false, error: null });
    const refreshSync = useCallback(async () => {
        try { setSyncStatus(await window.electronAPI.sync.getStatus()); } catch { /* ignore */ }
    }, []);
    useEffect(() => {
        if (account.loggedIn && account.isPro) void refreshSync();
        else setSyncStatus(null);
    }, [account.loggedIn, account.isPro, refreshSync]);

    const openPassphrase = (mode: 'enter' | 'reset') => setSyncModal({ open: true, mode, busy: false, error: null });
    const handleToggleSync = async (enable: boolean) => {
        try {
            const st = await window.electronAPI.sync.setEnabled(enable);
            setSyncStatus(st);
            if (enable && !st.unlocked) openPassphrase('enter');
            else void refreshSync();
        } catch (error) {
            // A rejected IPC call must not leave the toggle out of sync with the
            // real state; surface the error and re-read the actual status.
            showToast('error', `Failed to ${enable ? 'enable' : 'disable'} sync: ${error instanceof Error ? error.message : String(error)}`);
            void refreshSync();
        }
    };
    const submitPassphrase = async (passphrase: string) => {
        const isReset = syncModal.mode === 'reset';
        setSyncModal((m) => ({ ...m, busy: true, error: null }));
        try {
            const r = isReset
                ? await window.electronAPI.sync.resetPassphrase(passphrase)
                : await window.electronAPI.sync.setupPassphrase(passphrase);
            if (r.ok) {
                setSyncStatus(r.status);
                setSyncModal({ open: false, mode: 'enter', busy: false, error: null });
                showToast('success', isReset ? 'Passphrase reset. Re-uploading your clips…' : 'Cloud sync is on.');
                setTimeout(() => void refreshSync(), 1800);
            } else {
                setSyncModal((m) => ({ ...m, busy: false, error: r.error ?? 'Something went wrong.' }));
            }
        } catch {
            // A rejected IPC call (offline, service unreachable) must not leave
            // the dialog stuck on "Working…" with no way forward.
            setSyncModal((m) => ({ ...m, busy: false, error: 'Could not reach the sync service. Please try again.' }));
        }
    };
    const syncNow = async () => {
        try {
            const r = await window.electronAPI.sync.now();
            await refreshSync();
            if (r.error && r.error !== 'disabled' && r.error !== 'locked' && r.error !== 'busy') {
                showToast('error', `Sync issue: ${r.error}`);
            } else if (!r.error) {
                showToast('success', `Synced (${r.pushed} up, ${r.pulled} down).`);
            }
        } catch (error) {
            // A rejected IPC call (offline, service unreachable) must not surface
            // as an unhandled rejection.
            showToast('error', `Sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    // Cloud backups
    const [cloudBackups, setCloudBackups] = useState<CloudBackupView[]>([]);
    const [backupBusy, setBackupBusy] = useState(false);
    const loadBackups = useCallback(async () => {
        try { setCloudBackups(await window.electronAPI.sync.listBackups()); } catch { setCloudBackups([]); }
    }, []);
    useEffect(() => {
        if (syncStatus?.enabled && syncStatus?.unlocked) void loadBackups();
        else setCloudBackups([]);
    }, [syncStatus?.enabled, syncStatus?.unlocked, loadBackups]);
    const backupNow = async () => {
        setBackupBusy(true);
        const r = await window.electronAPI.sync.backupNow();
        setBackupBusy(false);
        if (r.ok) { showToast('success', 'Backed up to the cloud.'); void loadBackups(); }
        else showToast('error', r.error ?? 'Backup failed.');
    };
    const restoreCloudBackup = async (id: string) => {
        setBackupBusy(true);
        const r = await window.electronAPI.sync.restoreBackup(id);
        setBackupBusy(false);
        if (r.ok) showToast('success', 'Restored from cloud backup. Restart Clip to be safe.');
        else showToast('error', r.error ?? 'Restore failed.');
    };

    const handleWindowWillShow = useCallback(() => {
        setIsWindowFocused(true);
        setIsAnimatingList(true);
        setListForceKey((k) => k + 1);
    }, []);

    const {
        items,
        hasLoadedInitially,
        isInitialLoading,
        itemsCache,
        lastCacheUpdate,
        useCacheIfValid,
        requestClipboardHistory,
        deleteTarget,
        isDeleteDialogClosing,
        handleClearAll,
        handlePaste,
        handleTogglePin,
        handleDeleteItem,
        confirmDelete,
        handleDeleteDialogClose,
    } = useClipboardManager({
        settings,
        showToast,
        logger: log,
        onWindowWillShow: handleWindowWillShow,
        onAfterClearAll: () => setDangerAction(null),
    });

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
        if (settings.theme === 'system') {
            setSettings({ ...settings });
        }
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
    }, [editorThemeProfile, persistSettings, settings, showToast, themeConfig, themeEditorConfig]);

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
    }, [showToast]);

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
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        setHasUnsavedChanges(prev => {
            if (isInternalSettingsSyncRef.current) {
                isInternalSettingsSyncRef.current = false;
                return false;
            }
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
                    handleDeleteDialogClose();
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
                    // Prompt to save when there are unsaved settings/theme edits
                    // instead of silently discarding them on Escape.
                    if (hasUnsavedChanges || hasThemeEditorChangesSinceOpen()) {
                        setShowUnsavedChangesConfirm('cancel');
                    } else {
                        setIsSettingsDialogClosing(true);
                        setTimeout(() => {
                            setShowSettings(false);
                            setSettingsDraftState(null);
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
    }, [showMaxItemsWarning, dangerAction, showThemeProfileDeleteConfirm, showThemeProfileResetConfirm, showSettings, isSettingsDialogClosing, deleteTarget, showRestartConfirm, isRestartDialogClosing, showUnsavedChangesConfirm, backupDeleteAction, handleDeleteDialogClose, hasUnsavedChanges, hasThemeEditorChangesSinceOpen]);

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

    // Send backup settings to main process when settings change
    useEffect(() => {
        window.electronAPI?.setBackupSettings?.({
            enableBackups: settings.enableBackups,
            backupInterval: settings.backupInterval,
            maxBackups: settings.maxBackups,
        });
    }, [settings.enableBackups, settings.backupInterval, settings.maxBackups]);

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

    // Export/import settings logic
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
                        const nextSettings = { ...settingsRef.current, ...imported } as Settings;
                        setSettingsDraft(nextSettings);
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
        setSettingsDraftState(settings);
        setThemeEditorConfig(themeConfig);
        // Baseline for reverting autosaved-but-cancelled theme edits on close.
        captureThemeEditorSnapshot();
        setActiveSettingsSection('General');
        setSettingsNavigationStack([]);
        setShowSettings(true);
        setIsSettingsDialogClosing(false);
    };

    const closeSettingsWithoutSaving = () => {
        setIsSettingsDialogClosing(true);
        setTimeout(() => {
            setShowSettings(false);
            setSettingsDraftState(null);
            setThemeEditorConfig(themeConfig);
            setActiveSettingsSection('General');
            setSettingsNavigationStack([]);
            setIsSettingsDialogClosing(false);
        }, 300);
    };

    const handleSettingsBackOrClose = () => {
        setSettingsNavigationStack((stack) => {
            if (stack.length === 0) {
                // If there are unsaved settings/theme edits, prompt instead of
                // silently discarding them. Theme edits autosave to disk, so we
                // also check divergence from the editor-open baseline.
                if (hasUnsavedChanges || hasThemeEditorChangesSinceOpen()) {
                    setShowUnsavedChangesConfirm('cancel');
                } else {
                    closeSettingsWithoutSaving();
                }
                return stack;
            }

            const nextStack = stack.slice(0, -1);
            const previousSection = stack[stack.length - 1];
            setActiveSettingsSection(previousSection);
            return nextStack;
        });
    };

    const navigateToSettingsSection = (section: SettingsSectionKey) => {
        setSettingsNavigationStack([]);
        setActiveSettingsSection(section);
    };

    const pushSettingsSection = (section: SettingsSectionKey) => {
        setSettingsNavigationStack((stack) => [...stack, activeSettingsSection]);
        setActiveSettingsSection(section);
    };

    const resetSettings = () => {
        setDangerAction(null);
        setSettings(DEFAULT_SETTINGS);
        persistSettings(DEFAULT_SETTINGS);
        setSettingsDraftState(DEFAULT_SETTINGS);

        showToast('success', 'Settings reset to default values');
        // Close the settings window after successful reset
        setIsSettingsDialogClosing(true);
        setTimeout(() => {
            setShowSettings(false);
            setSettingsDraftState(null);
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
                        requestClipboardHistory();
                    }, 50); // Reduced delay since cache wasn't available
                }

                // Always request fresh data in background (but don't block UI)
                setTimeout(() => {
                    requestClipboardHistory();
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
                        requestClipboardHistory();
                    }, 50); // Reduced delay since cache wasn't available
                }

                // Always request fresh data in background
                setTimeout(() => {
                    requestClipboardHistory();
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
                    requestClipboardHistory();
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
    }, [isWindowFocused, requestClipboardHistory, useCacheIfValid]);

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

    const handleUnsavedSave = async () => {
        setIsUnsavedChangesDialogClosing(true);
        setTimeout(() => {
            setShowUnsavedChangesConfirm(null);
            setIsUnsavedChangesDialogClosing(false);
            closeSettingsWithoutSaving();
        }, 300);
    };

    const handleUnsavedDontSave = () => {
        const actionType = showUnsavedChangesConfirm;

        setIsUnsavedChangesDialogClosing(true);
        setTimeout(async () => {
            setShowUnsavedChangesConfirm(null);
            setIsUnsavedChangesDialogClosing(false);

            // Discard: revert any autosaved theme edits back to the baseline
            // captured when the editor opened, so "Don't save" actually undoes
            // changes that the ~220ms autosave already wrote to disk.
            await revertThemeEditorToSnapshot();

            if (actionType === 'quit') {
                window.electronAPI?.quitApp?.();
                return;
            }

            // Close settings. Note: the theme editor config was already restored
            // by the revert above, so we intentionally do NOT call
            // closeSettingsWithoutSaving() here (its setThemeEditorConfig reset
            // would re-apply the now-stale edited config).
            setIsSettingsDialogClosing(true);
            setTimeout(() => {
                setShowSettings(false);
                setSettingsDraftState(null);
                setActiveSettingsSection('General');
                setSettingsNavigationStack([]);
                setIsSettingsDialogClosing(false);
            }, 300);
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
                const lastSlash = Math.max(backupPath.lastIndexOf('/'), backupPath.lastIndexOf('\\'));
                const filename = (lastSlash >= 0 ? backupPath.slice(lastSlash + 1) : backupPath) || 'backup';
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
        window.electronAPI?.quitApp?.();
    };

    const pinnedItemsCount = React.useMemo(() => items.filter((item) => item.pinned).length, [items]);
    const imageItemsCount = React.useMemo(() => items.filter((item) => item.type === 'image').length, [items]);
    const oldestItemAgeLabel = React.useMemo(() => {
        if (items.length === 0) {
            return '0d';
        }

        const oldest = items.reduce((min, item) => Math.min(min, item.timestamp), items[0].timestamp);
        const days = Math.max(0, Math.floor((Date.now() - oldest) / (1000 * 60 * 60 * 24)));
        return `${days}d`;
    }, [items]);

    const estimatedStorageLabel = React.useMemo(() => {
        const totalLength = items.reduce((sum, item) => sum + item.content.length, 0);
        const kilobytes = totalLength / 1024;
        return kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kilobytes))} KB`;
    }, [items]);

    const renderSettingsSection = () => {
        switch (activeSettingsSection) {
            case 'General':
                return (
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
                        onNavigateToAbout={() => pushSettingsSection('About')}
                    />
                );
            case 'Behavior':
                return (
                    <SettingsBehaviorSection
                        settingsDraft={settingsDraft}
                        settings={settings}
                        setSettingsDraft={setSettingsDraft}
                        themeColors={themeColors}
                    />
                );
            case 'Backups':
                return (
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
                );
            case 'Data':
                return (
                    <SettingsDataSection
                        handleExportSettings={handleExportSettings}
                        handleImportSettings={handleImportSettings}
                        settingsPaths={settingsPaths}
                        copyTextToClipboard={copyTextToClipboard}
                        openSettingsConfigInSystem={openSettingsConfigInSystem}
                        reloadSettingsFromDisk={reloadSettingsFromDisk}
                        setDangerAction={setDangerAction}
                        showToast={showToast}
                        logger={log}
                    />
                );
            case 'Theme':
                return (
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
                );
            case 'Profile':
                return (
                    <div className="space-y-3 py-3">
                        <div className="bg-surface-container-low p-5 rounded-xl flex flex-col items-center text-center">
                            {account.loggedIn && account.avatarUrl ? (
                                <img
                                    src={account.avatarUrl}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="w-20 h-20 rounded-full object-cover mb-3"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center mb-3">
                                    {account.loggedIn ? (
                                        <span className="text-on-primary text-3xl font-bold">
                                            {(account.name?.trim()?.[0] || account.email?.trim()?.[0] || '?').toUpperCase()}
                                        </span>
                                    ) : (
                                        <span className="material-symbols-outlined text-on-primary text-4xl">person</span>
                                    )}
                                </div>
                            )}
                            <h2 className="text-lg font-bold text-on-surface break-all">{account.loggedIn ? (account.name || account.email || 'Signed in') : 'User'}</h2>
                            {account.loggedIn && account.name && account.email && (
                                <p className="text-[11px] text-on-surface-variant break-all">{account.email}</p>
                            )}
                            <p className="text-xs text-on-surface-variant">{account.loggedIn ? (account.isPro ? 'Clip Pro' : 'Free plan') : 'Local Profile'}</p>
                            {account.loggedIn && (
                                <button
                                    type="button"
                                    disabled={authBusy}
                                    onClick={async () => {
                                        setAuthBusy(true);
                                        try {
                                            const s = await window.electronAPI.auth.logout();
                                            setAccount(s);
                                            showToast('info', 'Signed out.');
                                        } catch {
                                            showToast('error', 'Sign-out failed.');
                                        } finally {
                                            setAuthBusy(false);
                                        }
                                    }}
                                    className="mt-3 py-1.5 px-4 bg-surface-container-high text-on-surface rounded-lg text-xs font-semibold hover:brightness-110 transition-all border-0 disabled:opacity-60"
                                >
                                    {authBusy ? 'Working…' : 'Sign Out'}
                                </button>
                            )}
                        </div>

                        <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-primary text-sm">sync</span>
                                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Sync</span>
                            </div>

                            <div
                                className="flex items-center justify-between py-2"
                                style={{ opacity: account.loggedIn && account.isPro ? 1 : 0.5 }}
                            >
                                <div>
                                    <h3 className="font-medium text-on-surface text-sm">Cloud Sync</h3>
                                    <p className="text-[11px] text-on-surface-variant">Sync clipboard across devices</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={!!syncStatus?.enabled}
                                        disabled={!(account.loggedIn && account.isPro) || !!syncStatus?.syncing}
                                        onChange={(e) => { void handleToggleSync(e.target.checked); }}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {!account.loggedIn && (
                                <div className="p-3 bg-surface-container-high rounded-lg">
                                    <p className="text-xs text-on-surface-variant text-center">Sign in to enable cloud sync</p>
                                    <button
                                        type="button"
                                        disabled={authBusy}
                                        onClick={async () => {
                                            setAuthBusy(true);
                                            try {
                                                const s = await window.electronAPI.auth.login();
                                                setAccount(s);
                                                showToast('success', `Signed in as ${s.email ?? 'your account'}.`);
                                            } catch (e) {
                                                showToast('error', e instanceof Error ? e.message : 'Sign-in failed.');
                                            } finally {
                                                setAuthBusy(false);
                                            }
                                        }}
                                        className="w-full mt-2 py-2 px-3 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:brightness-110 transition-all border-0 disabled:opacity-60"
                                    >
                                        {authBusy ? 'Opening browser…' : 'Sign In'}
                                    </button>
                                </div>
                            )}

                            {account.loggedIn && !account.isPro && (
                                <div className="p-3 bg-surface-container-high rounded-lg">
                                    <p className="text-xs text-on-surface-variant text-center">Upgrade to Pro to sync across your devices.</p>
                                    <button
                                        type="button"
                                        onClick={() => window.electronAPI.openExternal('https://getclip.vercel.app/#pricing')}
                                        className="w-full mt-2 py-2 px-3 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:brightness-110 transition-all border-0"
                                    >
                                        Upgrade to Pro
                                    </button>
                                </div>
                            )}

                            {account.loggedIn && account.isPro && (
                                <div className="p-3 bg-surface-container-high rounded-lg space-y-2">
                                    {!syncStatus?.enabled && (
                                        <p className="text-xs text-on-surface-variant text-center">
                                            Turn on to sync your clipboard across devices, encrypted end to end.
                                        </p>
                                    )}
                                    {syncStatus?.enabled && !syncStatus?.unlocked && (
                                        <>
                                            <p className="text-xs text-on-surface-variant text-center">
                                                Locked on this device. Enter your passphrase to sync.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => openPassphrase('enter')}
                                                className="w-full py-2 px-3 bg-primary-container text-on-primary rounded-lg text-xs font-semibold border-0"
                                            >
                                                Unlock sync
                                            </button>
                                        </>
                                    )}
                                    {syncStatus?.enabled && syncStatus?.unlocked && (
                                        <>
                                            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                                                <span>
                                                    {syncStatus.usage
                                                        ? `${(syncStatus.usage.bytesUsed / 1048576).toFixed(1)} MB of ${(syncStatus.usage.limits.storageBytes / 1048576).toFixed(0)} MB`
                                                        : 'Encrypted sync active'}
                                                </span>
                                                <span>
                                                    {syncStatus.lastSync
                                                        ? `Synced ${new Date(syncStatus.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                        : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void syncNow()}
                                                    disabled={!!syncStatus.syncing}
                                                    className="flex-1 py-2 px-3 bg-primary-container text-on-primary rounded-lg text-xs font-semibold border-0 disabled:opacity-60"
                                                >
                                                    {syncStatus.syncing ? 'Syncing…' : 'Sync now'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openPassphrase('reset')}
                                                    className="py-2 px-2 bg-transparent text-on-surface-variant text-xs border-0 hover:underline"
                                                >
                                                    Reset passphrase
                                                </button>
                                            </div>
                                            {syncStatus.lastError && (
                                                <p className="text-[10px] text-center" style={{ color: '#ffb4ad' }}>{syncStatus.lastError}</p>
                                            )}
                                            <div className="mt-1 pt-2 border-t border-white/5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-on-surface-variant">Cloud backups</span>
                                                    <button type="button" onClick={() => void backupNow()} disabled={backupBusy} className="text-[11px] text-primary bg-transparent border-0 hover:underline disabled:opacity-60">
                                                        {backupBusy ? 'Working…' : 'Back up now'}
                                                    </button>
                                                </div>
                                                {cloudBackups.length === 0 ? (
                                                    <p className="text-[10px] text-on-surface-variant mt-1">No cloud backups yet.</p>
                                                ) : (
                                                    <ul className="mt-1 space-y-1">
                                                        {cloudBackups.map((b) => (
                                                            <li key={b.id} className="flex items-center justify-between gap-2 text-[10px] text-on-surface-variant">
                                                                <span className="truncate">{(b.deviceName || 'Device')} · {new Date(b.createdAt).toLocaleDateString()} · {(b.sizeBytes / 1024).toFixed(0)} KB</span>
                                                                <button type="button" onClick={() => void restoreCloudBackup(b.id)} disabled={backupBusy} className="shrink-0 text-primary bg-transparent border-0 hover:underline disabled:opacity-60">Restore</button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-primary text-sm">analytics</span>
                                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Statistics</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-surface-container-high rounded-lg text-center">
                                    <p className="text-2xl font-bold text-primary">{items.length}</p>
                                    <p className="text-[10px] text-on-surface-variant">Total Clips</p>
                                </div>
                                <div className="p-3 bg-surface-container-high rounded-lg text-center">
                                    <p className="text-2xl font-bold text-primary">{pinnedItemsCount}</p>
                                    <p className="text-[10px] text-on-surface-variant">Pinned</p>
                                </div>
                                <div className="p-3 bg-surface-container-high rounded-lg text-center">
                                    <p className="text-2xl font-bold text-primary">{estimatedStorageLabel.replace(' MB', '').replace(' KB', '')}</p>
                                    <p className="text-[10px] text-on-surface-variant">{estimatedStorageLabel.includes('MB') ? 'MB Used' : 'KB Used'}</p>
                                </div>
                                <div className="p-3 bg-surface-container-high rounded-lg text-center">
                                    <p className="text-2xl font-bold text-primary">{oldestItemAgeLabel}</p>
                                    <p className="text-[10px] text-on-surface-variant">Oldest Clip</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'About':
                return (
                    <div className="space-y-3 py-3">
                        <div className="bg-surface-container-low p-5 rounded-xl flex flex-col items-center text-center">
                            <div className="mb-3" style={{ filter: 'drop-shadow(0 10px 24px rgba(171, 204, 255, 0.25))' }}>
                                <svg width={72} height={72} viewBox="0 0 48 48" fill="none" role="img" aria-label="Clip logo">
                                    <defs>
                                        <linearGradient id="aboutClipGrad" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0" stopColor="#bfe4ff" />
                                            <stop offset="1" stopColor="#4682b4" />
                                        </linearGradient>
                                    </defs>
                                    <rect x="5" y="19" width="24" height="24" rx="6" fill="#1e2024" stroke="rgba(255,255,255,0.14)" />
                                    <rect x="11" y="13" width="24" height="24" rx="6" fill="#23262c" stroke="rgba(255,255,255,0.18)" />
                                    <rect x="19" y="5" width="24" height="24" rx="6" fill="url(#aboutClipGrad)" />
                                    <path d="M25 17.3l2.1 2.1 4.4-4.6" stroke="#06131f" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-on-surface" style={{ marginBottom: 0 }}>Clip</h2>
                            <p className="text-sm text-primary font-medium">Version 1.1.0</p>
                            <p className="text-xs text-on-surface-variant mt-1">Built by Sukarth Acharya</p>
                        </div>

                        <div className="bg-surface-container-low p-4 rounded-xl space-y-2">
                            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-all group bg-transparent border-0" type="button" onClick={() => window.electronAPI.openExternal('https://github.com/Sukarth/Clip/releases')}>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-on-surface-variant">description</span>
                                    <span className="text-sm text-on-surface">Release Notes</span>
                                </div>
                                <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
                            </button>

                            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-all group bg-transparent border-0" type="button" onClick={() => window.electronAPI.openExternal('https://github.com/Sukarth/Clip/blob/main/LICENSE')}>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-on-surface-variant">gavel</span>
                                    <span className="text-sm text-on-surface">License</span>
                                </div>
                                <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
                            </button>

                            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-all group bg-transparent border-0" type="button" onClick={() => window.electronAPI.openExternal('https://getclip.vercel.app/privacy')}>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-on-surface-variant">privacy_tip</span>
                                    <span className="text-sm text-on-surface">Privacy Policy</span>
                                </div>
                                <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
                            </button>

                            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-all group bg-transparent border-0" type="button" onClick={() => window.electronAPI.openExternal('https://github.com/Sukarth/Clip')}>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-on-surface-variant">code</span>
                                    <span className="text-sm text-on-surface">GitHub Repository</span>
                                </div>
                                <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
                            </button>
                        </div>

                        <div className="bg-surface-container-low p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-primary text-sm">favorite</span>
                                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Credits</span>
                            </div>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                                Made with ❤️ by Sukarth.
                                <br /><br />
                                Built with Electron, React, TypeScript, and better-sqlite3. Encrypted
                                cloud sync via Supabase and hash-wasm (Argon2id). Billing by Polar.
                                Icons by Material Symbols. Fonts used: Lexend and JetBrains Mono.
                            </p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    useEffect(() => {
        if (!showSettings || isSettingsDialogClosing) {
            return;
        }

        const modalElement = settingsModalRef.current;
        if (!modalElement) {
            return;
        }

        const previousFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

        const focusFirstElement = () => {
            const focusableElements = Array.from(modalElement.querySelectorAll<HTMLElement>(focusableSelector))
                .filter((element) => !element.hasAttribute('aria-hidden') && element.offsetParent !== null);
            (focusableElements[0] ?? modalElement).focus();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') {
                return;
            }

            const focusableElements = Array.from(modalElement.querySelectorAll<HTMLElement>(focusableSelector))
                .filter((element) => !element.hasAttribute('aria-hidden') && element.offsetParent !== null);

            if (focusableElements.length === 0) {
                event.preventDefault();
                modalElement.focus();
                return;
            }

            const firstFocusableElement = focusableElements[0];
            const lastFocusableElement = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement as HTMLElement | null;

            if (event.shiftKey) {
                if (!activeElement || !modalElement.contains(activeElement) || activeElement === firstFocusableElement) {
                    event.preventDefault();
                    lastFocusableElement.focus();
                }
                return;
            }

            if (!activeElement || !modalElement.contains(activeElement) || activeElement === lastFocusableElement) {
                event.preventDefault();
                firstFocusableElement.focus();
            }
        };

        const timer = window.setTimeout(focusFirstElement, 0);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown);
            previousFocusedElement?.focus();
        };
    }, [isSettingsDialogClosing, showSettings]);

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
                            setSettingsDraftState(null);
                            setIsSettingsDialogClosing(false);
                        }
                    }}>
                        <div
                            ref={settingsModalRef}
                            id="mainContainer"
                            className={`app-container bg-surface flex flex-col clip-settings-page ${isSettingsDialogClosing ? 'fade-out' : 'fade-in'}`}
                            tabIndex={-1}
                            style={{
                                width: `${settings.windowWidth}px`,
                                height: `${settings.windowHeight}px`,
                            }}
                        >
                            <header className="flex items-center justify-between px-5 py-3 bg-surface z-10" id="mainHeader">
                                <h1 className="text-xl font-bold text-on-surface tracking-tight">
                                    {settingsNavigationStack.length > 0 ? activeSettingsSection : 'Settings'}
                                </h1>
                                <button
                                    className="close-btn w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-all active:scale-95"
                                    onClick={handleSettingsBackOrClose}
                                    title={settingsNavigationStack.length > 0 ? 'Back' : 'Close settings'}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-on-surface-variant text-xl">
                                        {settingsNavigationStack.length > 0 ? 'arrow_back' : 'close'}
                                    </span>
                                </button>
                            </header>
                            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar clip-settings-scroll px-4 pb-20" id="contentArea">
                                <div key={activeSettingsSection} id="content-container">
                                    {renderSettingsSection()}
                                </div>
                            </div>
                            <nav className="absolute bottom-0 left-0 right-0 z-50 flex justify-around items-center px-2 py-2 bg-surface-container/90 backdrop-blur-xl rounded-t-xl border-t border-outline-variant/10">
                                {PRIMARY_SETTINGS_SECTIONS.map((section) => {
                                    const isActive = activeSettingsSection === section.key && settingsNavigationStack.length === 0;
                                    return (
                                    <button
                                        key={section.key}
                                        type="button"
                                        className={`nav-btn flex flex-col items-center justify-center px-3 py-1.5 transition-all active:scale-95 ${isActive ? 'text-primary bg-primary-container/20 rounded-xl' : 'text-on-surface-variant hover:text-on-surface'}`}
                                        data-section={section.key}
                                        onClick={() => navigateToSettingsSection(section.key)}
                                    >
                                        <span className="material-symbols-outlined text-base" style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}>{section.icon}</span>
                                        <span className="text-[9px] font-medium">{section.label}</span>
                                    </button>
                                    );
                                })}
                            </nav>
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
                    syncClearsAllDevices={!!(account.loggedIn && account.isPro && syncStatus?.enabled)}
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

                {showFirstRun && !account.loggedIn && (
                    <FirstRunDialog
                        settings={settings}
                        busy={authBusy}
                        onSignIn={async () => {
                            try { localStorage.setItem('clip.firstRunSeen', '1'); } catch { /* ignore */ }
                            // Dismiss the welcome immediately so the app isn't locked
                            // behind it during the browser sign-in (which can take up to
                            // its 5-min timeout); it continues in the background and the
                            // Profile tab reflects the result.
                            setShowFirstRun(false);
                            setAuthBusy(true);
                            try {
                                const s = await window.electronAPI.auth.login();
                                setAccount(s);
                                showToast('success', `Signed in as ${s.email ?? 'your account'}.`);
                            } catch (e) {
                                showToast('error', e instanceof Error ? e.message : 'Sign-in failed.');
                            } finally {
                                setAuthBusy(false);
                            }
                        }}
                        onContinueOffline={() => {
                            try { localStorage.setItem('clip.firstRunSeen', '1'); } catch { /* ignore */ }
                            setShowFirstRun(false);
                        }}
                    />
                )}

                {syncModal.open && (
                    <SyncPassphraseDialog
                        settings={settings}
                        mode={syncModal.mode}
                        busy={syncModal.busy}
                        error={syncModal.error}
                        onSubmit={(pp) => void submitPassphrase(pp)}
                        onForgot={() => setSyncModal({ open: true, mode: 'reset', busy: false, error: null })}
                        onCancel={() => setSyncModal({ open: false, mode: 'enter', busy: false, error: null })}
                    />
                )}
            </div>
        </ThemeProvider>
    );
};

export default App;
