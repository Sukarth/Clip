import * as React from 'react';
import { getActiveThemeProfile } from '../theme-utils';
import {
    createDefaultThemeConfig,
    normalizeThemeProfileKey,
    sanitizeThemeConfig,
    type ThemeConfig,
    type ThemeProfile,
} from '../../theme-config';

interface UseThemeConfigManagerArgs {
    showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function useThemeConfigManager({ showToast }: UseThemeConfigManagerArgs) {
    const [themeConfig, setThemeConfig] = React.useState<ThemeConfig>(() => createDefaultThemeConfig());
    const [themeEditorConfig, setThemeEditorConfig] = React.useState<ThemeConfig>(() => createDefaultThemeConfig());
    const [themeSchema, setThemeSchema] = React.useState<any>(null);
    const [themePaths, setThemePaths] = React.useState<{ configPath: string; schemaPath: string } | null>(null);
    const [settingsPaths, setSettingsPaths] = React.useState<{ configPath: string; schemaPath: string } | null>(null);
    const [newThemeProfileName, setNewThemeProfileName] = React.useState('');
    const [isThemeSaving, setIsThemeSaving] = React.useState(false);
    const hasHydratedRef = React.useRef(false);
    const autosaveTimeoutRef = React.useRef<number | null>(null);
    // Snapshot of the persisted theme config captured when the theme editor opens.
    // Because edits autosave to disk after ~220ms, "close without saving" needs a
    // pre-edit baseline to revert to.
    const openThemeSnapshotRef = React.useRef<ThemeConfig | null>(null);

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

    const editorThemeProfile = React.useMemo(() => getActiveThemeProfile(themeEditorConfig), [themeEditorConfig]);

    const saveThemeEditorConfig = React.useCallback(async () => {
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
    }, [themeEditorConfig, showToast]);

    // Capture the currently persisted theme config as the baseline to revert to
    // if the user later closes the editor without saving. Call this when the
    // settings/theme editor opens.
    const captureThemeEditorSnapshot = React.useCallback(() => {
        openThemeSnapshotRef.current = JSON.parse(JSON.stringify(themeConfig));
    }, [themeConfig]);

    // Discard the current editor edits and restore the snapshot captured when the
    // editor opened. Since edits are autosaved to disk, this writes the snapshot
    // back to disk so autosaved-but-cancelled changes are actually reverted.
    const revertThemeEditorToSnapshot = React.useCallback(async () => {
        const snapshot = openThemeSnapshotRef.current;
        if (!snapshot) return;
        openThemeSnapshotRef.current = null;

        // Cancel any pending autosave so it can't re-persist the discarded edits.
        if (autosaveTimeoutRef.current !== null) {
            window.clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;
        }

        const sanitizedSnapshot = sanitizeThemeConfig(snapshot);
        const driftedOnDisk = JSON.stringify(sanitizeThemeConfig(themeConfig)) !== JSON.stringify(sanitizedSnapshot);

        if (!driftedOnDisk) {
            // Disk already matches the baseline; just drop any uncommitted editor edits.
            setThemeEditorConfig(sanitizedSnapshot);
            return;
        }

        try {
            const saved = await window.electronAPI?.saveThemeConfig?.(sanitizedSnapshot);
            const next = saved ? sanitizeThemeConfig(saved) : sanitizedSnapshot;
            setThemeConfig(next);
            setThemeEditorConfig(next);
        } catch (error) {
            // Even if the disk write fails, revert in-memory state so the UI
            // reflects the discard.
            setThemeConfig(sanitizedSnapshot);
            setThemeEditorConfig(sanitizedSnapshot);
            showToast('error', `Failed to revert theme changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [showToast, themeConfig]);

    // Whether the persisted theme config has diverged from the baseline captured
    // when the editor opened. Because theme edits autosave to disk, comparing the
    // live editor against the last-persisted config would almost always report
    // "no changes"; comparing against the open-time snapshot lets the close flow
    // detect edits that were autosaved but not explicitly kept.
    const hasThemeEditorChangesSinceOpen = React.useCallback(() => {
        const snapshot = openThemeSnapshotRef.current;
        if (!snapshot) return false;
        return (
            JSON.stringify(sanitizeThemeConfig(themeConfig)) !== JSON.stringify(sanitizeThemeConfig(snapshot))
            || JSON.stringify(sanitizeThemeConfig(themeEditorConfig)) !== JSON.stringify(sanitizeThemeConfig(snapshot))
        );
    }, [themeConfig, themeEditorConfig]);

    const updateEditorActiveProfile = React.useCallback((updater: (profile: ThemeProfile) => ThemeProfile) => {
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

    const loadThemeFromMain = React.useCallback(async () => {
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
    }, [showToast]);

    const switchThemeProfile = React.useCallback(async (profileKey: string) => {
        const previousEditorConfig = themeEditorConfig;

        try {
            const key = normalizeThemeProfileKey(profileKey);
            setThemeEditorConfig((prev) => ({ ...prev, activeProfile: key }));
            const next = await window.electronAPI?.setActiveThemeProfile?.(key);
            if (next) {
                const sanitized = sanitizeThemeConfig(next);
                setThemeConfig(sanitized);
                setThemeEditorConfig(sanitized);
            }
        } catch (error) {
            setThemeEditorConfig(previousEditorConfig);
            showToast('error', `Failed to switch profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [showToast, themeEditorConfig]);

    const createThemeProfileFromInput = React.useCallback(async () => {
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
    }, [newThemeProfileName, showToast]);

    const deleteActiveThemeProfile = React.useCallback(async () => {
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
    }, [activeThemeProfileKey, showToast]);

    const resetActiveThemeProfileToDefault = React.useCallback(async () => {
        try {
            const profileKey = normalizeThemeProfileKey(themeEditorConfig.activeProfile);
            const currentProfile = themeEditorConfig.profiles[profileKey] || editorThemeProfile;
            const defaultProfile = createDefaultThemeConfig().profiles.default;
            const nextConfig = sanitizeThemeConfig({
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

            const saved = await window.electronAPI?.saveThemeConfig?.(nextConfig);
            if (!saved) {
                throw new Error('Theme config save did not return a result.');
            }

            const sanitized = sanitizeThemeConfig(saved);
            setThemeConfig(sanitized);
            setThemeEditorConfig(sanitized);
            showToast('success', 'Theme profile reset to default.');
        } catch (error) {
            showToast('error', `Failed to reset profile theme: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [editorThemeProfile, showToast, themeEditorConfig]);

    const reloadThemeFromDisk = React.useCallback(async () => {
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
    }, [showToast]);

    const exportThemeJson = React.useCallback(async () => {
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
    }, [showToast]);

    const openThemeConfigInSystem = React.useCallback(async () => {
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
    }, [showToast]);

    const openSettingsConfigInSystem = React.useCallback(async () => {
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
    }, [showToast]);

    React.useEffect(() => {
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

    React.useEffect(() => {
        if (!hasHydratedRef.current) {
            hasHydratedRef.current = true;
            return;
        }

        if (JSON.stringify(themeEditorConfig) === JSON.stringify(themeConfig)) {
            return;
        }

        if (autosaveTimeoutRef.current !== null) {
            window.clearTimeout(autosaveTimeoutRef.current);
        }

        autosaveTimeoutRef.current = window.setTimeout(async () => {
            try {
                setIsThemeSaving(true);
                const saved = await window.electronAPI?.saveThemeConfig?.(themeEditorConfig);
                if (!saved) {
                    throw new Error('Theme config save did not return a result.');
                }

                const sanitized = sanitizeThemeConfig(saved);
                setThemeConfig(sanitized);
                setThemeEditorConfig(sanitized);
            } catch (error) {
                showToast('error', `Failed to autosave theme config: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsThemeSaving(false);
            }
        }, 220);

        return () => {
            if (autosaveTimeoutRef.current !== null) {
                window.clearTimeout(autosaveTimeoutRef.current);
                autosaveTimeoutRef.current = null;
            }
        };
    }, [themeConfig, themeEditorConfig, showToast]);

    return {
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
        activeThemeProfile,
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
    };
}
