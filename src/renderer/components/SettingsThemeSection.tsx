import * as React from 'react';
import { sectionHeaderStyle } from '../app-constants';
import type { Settings } from '../app-types';
import ColorSettingField from './ColorSettingField';
import type { ThemeConfig, ThemeProfile } from '../../theme-config';

interface SettingsThemeSectionProps {
    activeThemeProfileKey: string;
    switchThemeProfile: (key: string) => void | Promise<void>;
    themeEditorConfig: ThemeConfig;
    newThemeProfileName: string;
    setNewThemeProfileName: React.Dispatch<React.SetStateAction<string>>;
    createThemeProfileFromInput: () => void | Promise<void>;
    setShowThemeProfileDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
    setIsThemeProfileDeleteDialogClosing: React.Dispatch<React.SetStateAction<boolean>>;
    setShowThemeProfileResetConfirm: React.Dispatch<React.SetStateAction<boolean>>;
    setIsThemeProfileResetDialogClosing: React.Dispatch<React.SetStateAction<boolean>>;
    themeColors: ThemeProfile['colors'];
    reloadThemeFromDisk: () => void | Promise<void>;
    editorThemeProfile: ThemeProfile;
    settingsDraft: Settings | null;
    settings: Settings;
    setSettingsDraft: React.Dispatch<React.SetStateAction<Settings | null>>;
    updateEditorActiveProfile: (updater: (profile: ThemeProfile) => ThemeProfile) => void;
    isThemeSaving: boolean;
    saveThemeEditorConfig: () => void | Promise<void>;
    openThemeConfigInSystem: () => void | Promise<void>;
    exportThemeJson: () => void | Promise<void>;
    themePaths: { configPath: string; schemaPath: string } | null;
    copyTextToClipboard: (text: string, label: string) => void | Promise<void>;
    themeSchema: any;
}

const SettingsThemeSection: React.FC<SettingsThemeSectionProps> = ({
    activeThemeProfileKey,
    switchThemeProfile,
    themeEditorConfig,
    newThemeProfileName,
    setNewThemeProfileName,
    createThemeProfileFromInput,
    setShowThemeProfileDeleteConfirm,
    setIsThemeProfileDeleteDialogClosing,
    setShowThemeProfileResetConfirm,
    setIsThemeProfileResetDialogClosing,
    themeColors,
    reloadThemeFromDisk,
    editorThemeProfile,
    settingsDraft,
    settings,
    setSettingsDraft,
    updateEditorActiveProfile,
    isThemeSaving,
    saveThemeEditorConfig,
    openThemeConfigInSystem,
    exportThemeJson,
    themePaths,
    copyTextToClipboard,
    themeSchema,
}) => {
    return (
        <>
            <div>
                <h2 style={sectionHeaderStyle}>Theme Profiles</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Active profile</span>
                        <select
                            className="settings-select"
                            value={activeThemeProfileKey}
                            onChange={(e) => {
                                void switchThemeProfile(e.target.value);
                            }}
                            style={{
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                padding: '10px 12px',
                                fontSize: 14,
                                outline: 'none',
                            }}
                        >
                            {Object.entries(themeEditorConfig.profiles).map(([key, profile]) => (
                                <option key={key} value={key}>
                                    {profile.name || key}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            className="settings-input"
                            type="text"
                            value={newThemeProfileName}
                            onChange={(e) => setNewThemeProfileName(e.target.value)}
                            placeholder="New profile name"
                            style={{
                                flex: 1,
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                padding: '10px 12px',
                                fontSize: 14,
                                outline: 'none',
                            }}
                        />
                        <button
                            className="settings-button"
                            style={{
                                background: themeColors.accent,
                                border: `1px solid ${themeColors.accent}`,
                                borderRadius: 8,
                                color: '#111',
                                padding: '10px 12px',
                                cursor: newThemeProfileName.trim() ? 'pointer' : 'not-allowed',
                                fontWeight: 600,
                                opacity: newThemeProfileName.trim() ? 1 : 0.6,
                            }}
                            disabled={!newThemeProfileName.trim()}
                            onClick={() => {
                                void createThemeProfileFromInput();
                            }}
                        >
                            Add Profile
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="settings-button"
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 8,
                                color: '#fff',
                                padding: '8px 12px',
                                cursor:
                                    Object.keys(themeEditorConfig.profiles).length > 1 ? 'pointer' : 'not-allowed',
                                opacity: Object.keys(themeEditorConfig.profiles).length > 1 ? 1 : 0.6,
                                fontWeight: 600,
                            }}
                            disabled={Object.keys(themeEditorConfig.profiles).length <= 1}
                            onClick={() => {
                                setShowThemeProfileDeleteConfirm(true);
                                setIsThemeProfileDeleteDialogClosing(false);
                            }}
                        >
                            Delete Profile
                        </button>
                        <button
                            className="settings-button"
                            style={{
                                background: themeColors.warning,
                                border: `1px solid ${themeColors.warning}`,
                                borderRadius: 8,
                                color: '#222',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontWeight: 700,
                            }}
                            onClick={() => {
                                setShowThemeProfileResetConfirm(true);
                                setIsThemeProfileResetDialogClosing(false);
                            }}
                        >
                            Reset Profile Theme
                        </button>
                        <button
                            className="settings-button"
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 8,
                                color: '#fff',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                            onClick={() => {
                                void reloadThemeFromDisk();
                            }}
                        >
                            Reload Theme File
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <h2 style={sectionHeaderStyle}>Full Theme</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Profile display name</span>
                        <input
                            className="settings-input"
                            type="text"
                            value={editorThemeProfile.name}
                            onChange={(e) =>
                                updateEditorActiveProfile((profile) => ({ ...profile, name: e.target.value.slice(0, 60) }))
                            }
                            style={{
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                padding: '10px 12px',
                                fontSize: 14,
                                outline: 'none',
                            }}
                        />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: '#aaa' }}>Theme mode</span>
                            <select
                                className="settings-select"
                                value={settingsDraft?.theme ?? settings.theme}
                                onChange={(e) =>
                                    setSettingsDraft((s) =>
                                        s
                                            ? { ...s, theme: e.target.value as Settings['theme'] }
                                            : { ...settings, theme: e.target.value as Settings['theme'] },
                                    )
                                }
                                style={{
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#fff',
                                    padding: '8px 10px',
                                    fontSize: 12,
                                    outline: 'none',
                                    width: '100%',
                                    minWidth: 0,
                                }}
                            >
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                                <option value="system">System</option>
                            </select>
                        </label>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: '#aaa' }}>Accent color (quick)</span>
                            <ColorSettingField
                                label="Accent color"
                                value={editorThemeProfile.colors.accent}
                                onChange={(nextValue) => {
                                    updateEditorActiveProfile((profile) => ({
                                        ...profile,
                                        colors: {
                                            ...profile.colors,
                                            accent: nextValue,
                                        },
                                    }));
                                    setSettingsDraft((s) => (s ? { ...s, accentColor: nextValue } : { ...settings, accentColor: nextValue }));
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                            ['appBackground', 'App background'],
                            ['panelBackground', 'Panel background'],
                            ['overlayBackground', 'Overlay background'],
                            ['itemBackground', 'Item background'],
                            ['itemHoverBackground', 'Item hover'],
                            ['inputBackground', 'Input background'],
                            ['inputBorder', 'Input border'],
                            ['border', 'Border'],
                            ['textPrimary', 'Text primary'],
                            ['textSecondary', 'Text secondary'],
                            ['textMuted', 'Text muted'],
                            ['accent', 'Accent'],
                            ['danger', 'Danger'],
                            ['warning', 'Warning'],
                            ['success', 'Success'],
                            ['scrollbarThumb', 'Scrollbar thumb'],
                            ['scrollbarTrack', 'Scrollbar track'],
                        ].map(([key, label]) => {
                            const colorKey = key as keyof ThemeProfile['colors'];
                            return (
                                <ColorSettingField
                                    key={key}
                                    label={String(label)}
                                    value={editorThemeProfile.colors[colorKey]}
                                    onChange={(nextValue) => {
                                        updateEditorActiveProfile((profile) => ({
                                            ...profile,
                                            colors: {
                                                ...profile.colors,
                                                [colorKey]: nextValue,
                                            },
                                        }));
                                    }}
                                />
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                            ['fontFamily', 'Font family'],
                            ['monoFontFamily', 'Mono font'],
                        ].map(([key, label]) => {
                            const typographyKey = key as keyof ThemeProfile['typography'];
                            return (
                                <label
                                    key={key}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 6,
                                        flex: 1,
                                        minWidth: 160,
                                    }}
                                >
                                    <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
                                    <input
                                        className="settings-input"
                                        type="text"
                                        value={String(editorThemeProfile.typography[typographyKey])}
                                        onChange={(e) => {
                                            const nextValue = e.target.value;
                                            updateEditorActiveProfile((profile) => ({
                                                ...profile,
                                                typography: {
                                                    ...profile.typography,
                                                    [typographyKey]: nextValue,
                                                },
                                            }));
                                        }}
                                        style={{
                                            borderRadius: 8,
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#fff',
                                            padding: '8px 10px',
                                            fontSize: 12,
                                            outline: 'none',
                                        }}
                                    />
                                </label>
                            );
                        })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, width: '100%' }}>
                        {[
                            ['baseFontSize', 'Base size'],
                            ['titleFontSize', 'Title size'],
                            ['borderRadius', 'Border radius'],
                            ['itemRadius', 'Item radius'],
                            ['transparency', 'Transparency'],
                            ['backdropBlur', 'Backdrop blur'],
                        ].map(([key, label]) => {
                            const value =
                                key in editorThemeProfile.surface
                                    ? (editorThemeProfile.surface as any)[key]
                                    : (editorThemeProfile.typography as any)[key];
                            return (
                                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                                    <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
                                    <input
                                        className="settings-input"
                                        type="number"
                                        value={value}
                                        onChange={(e) => {
                                            const parsed = Number(e.target.value);
                                            if (!Number.isFinite(parsed)) {
                                                return;
                                            }
                                            updateEditorActiveProfile((profile) => {
                                                if (key in profile.surface) {
                                                    return {
                                                        ...profile,
                                                        surface: {
                                                            ...profile.surface,
                                                            [key]: parsed,
                                                        },
                                                    };
                                                }

                                                return {
                                                    ...profile,
                                                    typography: {
                                                        ...profile.typography,
                                                        [key]: parsed,
                                                    },
                                                };
                                            });
                                        }}
                                        style={{
                                            borderRadius: 8,
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#fff',
                                            padding: '8px 10px',
                                            fontSize: 12,
                                            outline: 'none',
                                            width: '100%',
                                            minWidth: 0,
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                </label>
                            );
                        })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                            ['delete', 'Delete icon'],
                            ['pin', 'Pin icon'],
                            ['pinFilled', 'Pin filled icon'],
                            ['settings', 'Settings icon'],
                            ['close', 'Close icon'],
                            ['search', 'Search icon'],
                            ['confirm', 'Confirm icon'],
                            ['clipboard', 'Clipboard icon'],
                        ].map(([key, label]) => {
                            const iconKey = key as keyof ThemeProfile['icons'];
                            return (
                                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
                                    <input
                                        className="settings-input"
                                        type="text"
                                        value={editorThemeProfile.icons[iconKey]}
                                        onChange={(e) => {
                                            const nextValue = e.target.value;
                                            updateEditorActiveProfile((profile) => ({
                                                ...profile,
                                                icons: {
                                                    ...profile.icons,
                                                    [iconKey]: nextValue,
                                                },
                                            }));
                                        }}
                                        style={{
                                            borderRadius: 8,
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#fff',
                                            padding: '8px 10px',
                                            fontSize: 12,
                                            outline: 'none',
                                        }}
                                    />
                                </label>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            className="settings-button"
                            style={{
                                background: themeColors.accent,
                                border: `1px solid ${themeColors.accent}`,
                                borderRadius: 8,
                                color: '#111',
                                padding: '9px 12px',
                                cursor: isThemeSaving ? 'wait' : 'pointer',
                                fontWeight: 700,
                                flex: 1,
                                opacity: isThemeSaving ? 0.7 : 1,
                            }}
                            disabled={isThemeSaving}
                            onClick={() => {
                                void saveThemeEditorConfig();
                            }}
                        >
                            {isThemeSaving ? 'Saving...' : 'Save Theme JSON'}
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
                                void openThemeConfigInSystem();
                            }}
                        >
                            Open Theme JSON
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
                                void exportThemeJson();
                            }}
                        >
                            Export Theme JSON
                        </button>
                    </div>

                    <div style={{ fontSize: 12, color: '#8f8f8f', lineHeight: 1.5 }}>
                        Theme file path:{' '}
                        <code
                            style={{ color: '#cfcfcf', cursor: 'pointer', textDecoration: 'underline' }}
                            title="click to copy"
                            onClick={() => {
                                if (!themePaths?.configPath) return;
                                void copyTextToClipboard(themePaths.configPath, 'Theme file path');
                            }}
                        >
                            {themePaths?.configPath || 'AppData/clip-theme.json'}
                        </code>
                        <br />
                        Backup schema path:{' '}
                        <code
                            style={{ color: '#cfcfcf', cursor: 'pointer', textDecoration: 'underline' }}
                            title="click to copy"
                            onClick={() => {
                                if (!themePaths?.schemaPath) return;
                                void copyTextToClipboard(themePaths.schemaPath, 'Theme schema path');
                            }}
                        >
                            {themePaths?.schemaPath || 'AppData/clip-theme.schema.json'}
                        </code>
                        {themeSchema?.notes?.length ? (
                            <>
                                <br />
                                {String(themeSchema.notes[0])}
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
};

export default React.memo(SettingsThemeSection);
