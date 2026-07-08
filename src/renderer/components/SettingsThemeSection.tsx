import * as React from 'react';
import type { Settings } from '../app-types';
import type { ThemeConfig, ThemeProfile } from '../../theme-config';
import PrototypeSelect from './PrototypeSelect';

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

const colorGroups: Array<{ title: string; icon: string; entries: Array<[keyof ThemeProfile['colors'], string]>; columns: string; }> = [
    { title: 'Surface Colors', icon: 'format_color_fill', columns: 'grid grid-cols-4 gap-x-3 gap-y-4', entries: [['appBackground', 'App BG'], ['panelBackground', 'Panel'], ['overlayBackground', 'Overlay'], ['itemBackground', 'Item'], ['itemHoverBackground', 'Hover'], ['inputBackground', 'Input BG'], ['inputBorder', 'Input Bdr'], ['border', 'Border']] },
    { title: 'Text & Accent', icon: 'text_format', columns: 'grid grid-cols-4 gap-x-3 gap-y-4', entries: [['textPrimary', 'Primary'], ['textSecondary', 'Secondary'], ['textMuted', 'Muted'], ['accent', 'Accent']] },
    { title: 'Status & UI', icon: 'info', columns: 'grid grid-cols-5 gap-x-3 gap-y-4', entries: [['danger', 'Danger'], ['warning', 'Warning'], ['success', 'Success'], ['scrollbarThumb', 'Scroll'], ['scrollbarTrack', 'Track']] },
];

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
    reloadThemeFromDisk,
    editorThemeProfile,
    settingsDraft,
    settings,
    setSettingsDraft,
    updateEditorActiveProfile,
    openThemeConfigInSystem,
    exportThemeJson,
    themePaths,
    copyTextToClipboard,
}) => {
    const getDisplayName = React.useCallback((value: string | null | undefined, fallback: string) => {
        if (!value) {
            return fallback;
        }

        const parts = value.split(/[\\/]/).filter(Boolean);
        return parts[parts.length - 1] || fallback;
    }, []);

    return (
        <div className="space-y-3 py-3">
            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">dark_mode</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Theme Mode</span>
                </div>
                <PrototypeSelect
                    value={settingsDraft?.theme ?? settings.theme}
                    onChange={(value) => setSettingsDraft((prev) => ({ ...(prev ?? settings), theme: value as Settings['theme'] }))}
                    options={[
                        { value: 'dark', label: 'Dark' },
                        { value: 'light', label: 'Light' },
                        { value: 'system', label: 'System' },
                    ]}
                />
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">palette</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Theme Profile</span>
                </div>

                <PrototypeSelect
                    value={activeThemeProfileKey}
                    onChange={(value) => { void switchThemeProfile(value); }}
                    options={Object.entries(themeEditorConfig.profiles).map(([key, profile]) => ({ value: key, label: profile.name || key }))}
                />

                <div className="flex gap-2">
                    <input type="text" placeholder="New profile name" className="input-field flex-1 text-xs" value={newThemeProfileName} onChange={(e) => setNewThemeProfileName(e.target.value)} />
                    <button className="px-3 py-2 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:brightness-110 transition-all border-0" type="button" onClick={() => { void createThemeProfileFromInput(); }}>Add</button>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <button className="px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded-lg text-[11px] font-medium hover:bg-surface-container-highest transition-all border-0" type="button" onClick={() => { setShowThemeProfileDeleteConfirm(true); setIsThemeProfileDeleteDialogClosing(false); }}>Delete Profile</button>
                    <button className="px-3 py-1.5 bg-warning/20 text-warning rounded-lg text-[11px] font-medium hover:bg-warning/30 transition-all border-0" type="button" onClick={() => { setShowThemeProfileResetConfirm(true); setIsThemeProfileResetDialogClosing(false); }}>Reset Profile</button>
                    <button className="px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded-lg text-[11px] font-medium hover:bg-surface-container-highest transition-all border-0" type="button" onClick={() => { void reloadThemeFromDisk(); }}>Reload</button>
                </div>
            </div>

            {colorGroups.map((group) => (
                <div key={group.title} className="bg-surface-container-low p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-sm">{group.icon}</span>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">{group.title}</span>
                    </div>
                    <div className={group.columns}>
                        {group.entries.map(([key, label]) => (
                            <div className="color-swatch" key={key}>
                                <input type="color" value={editorThemeProfile.colors[key].slice(0, 7)} title={label} onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, colors: { ...profile.colors, [key]: e.target.value } }))} />
                                <span className="color-swatch-label">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">text_fields</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Typography</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant">Font Family</label>
                        <input type="text" value={editorThemeProfile.typography.fontFamily} className="input-field w-full text-[11px]" onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, typography: { ...profile.typography, fontFamily: e.target.value } }))} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant">Mono Font</label>
                        <input type="text" value={editorThemeProfile.typography.monoFontFamily} className="input-field w-full text-[11px]" onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, typography: { ...profile.typography, monoFontFamily: e.target.value } }))} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant">Base Size</label>
                        <input type="number" value={editorThemeProfile.typography.baseFontSize} className="input-field w-full text-[11px]" onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, typography: { ...profile.typography, baseFontSize: Number(e.target.value) } }))} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant">Title Size</label>
                        <input type="number" value={editorThemeProfile.typography.titleFontSize} className="input-field w-full text-[11px]" onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, typography: { ...profile.typography, titleFontSize: Number(e.target.value) } }))} />
                    </div>
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">layers</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Surface</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant">Border Radius</label>
                        <input type="number" value={editorThemeProfile.surface.borderRadius} className="input-field w-full text-[11px]" onChange={(e) => {
                            const value = Number(e.target.value);
                            updateEditorActiveProfile((profile) => ({ ...profile, surface: { ...profile.surface, borderRadius: value } }));
                            setSettingsDraft((prev) => ({ ...(prev ?? settings), borderRadius: value }));
                        }} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant">Item Radius</label>
                        <input type="number" value={editorThemeProfile.surface.itemRadius} className="input-field w-full text-[11px]" onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, surface: { ...profile.surface, itemRadius: Number(e.target.value) } }))} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant">Transparency</label>
                        <input type="number" value={editorThemeProfile.surface.transparency} step="0.05" min="0.35" max="1" className="input-field w-full text-[11px]" onChange={(e) => {
                            const value = Number(e.target.value);
                            updateEditorActiveProfile((profile) => ({ ...profile, surface: { ...profile.surface, transparency: value } }));
                            setSettingsDraft((prev) => ({ ...(prev ?? settings), transparency: value }));
                        }} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant">Backdrop Blur</label>
                        <input type="number" value={editorThemeProfile.surface.backdropBlur} className="input-field w-full text-[11px]" onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, surface: { ...profile.surface, backdropBlur: Number(e.target.value) } }))} />
                    </div>
                    <div className="space-y-1" style={{ gridColumn: 'span 2' }}>
                        <label className="text-[10px] text-on-surface-variant">Panel Border Width</label>
                        <input type="number" value={editorThemeProfile.surface.panelBorderWidth} className="input-field w-full text-[11px]" onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, surface: { ...profile.surface, panelBorderWidth: Number(e.target.value) } }))} />
                    </div>
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">emoji_symbols</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Icons</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {([
                        ['delete', 'Delete'],
                        ['pin', 'Pin'],
                        ['pinFilled', 'Pin Filled'],
                        ['settings', 'Settings'],
                        ['close', 'Close'],
                        ['search', 'Search'],
                        ['confirm', 'Confirm'],
                        ['clipboard', 'Clipboard'],
                    ] as const).map(([key, label]) => (
                        <div className="space-y-1" key={key}>
                            <label className="text-[10px] text-on-surface-variant">{label}</label>
                            <input type="text" value={editorThemeProfile.icons[key]} className="input-field w-full text-[11px]" onChange={(e) => updateEditorActiveProfile((profile) => ({ ...profile, icons: { ...profile.icons, [key]: e.target.value } }))} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="json-file-card-header">
                    <div className="json-file-card-title">
                        <span className="material-symbols-outlined">code</span>
                        <div>
                            <h3>Theme JSON</h3>
                            <p>Review the theme file that powers the current color system and profiles.</p>
                        </div>
                    </div>
                </div>

                <button className="json-file-pill" type="button" title="Click to copy" onClick={() => themePaths?.configPath && void copyTextToClipboard(themePaths.configPath, 'Theme JSON path')}>
                    <span className="json-file-pill-main">
                        <span className="material-symbols-outlined">description</span>
                        <span className="json-file-pill-text">
                            <strong>{getDisplayName(themePaths?.configPath, 'clip-theme.json')}</strong>
                            <span>Main theme file</span>
                        </span>
                    </span>
                    <span className="json-file-pill-copy material-symbols-outlined">content_copy</span>
                </button>

                <button className="json-file-pill" type="button" title="Click to copy" onClick={() => themePaths?.schemaPath && void copyTextToClipboard(themePaths.schemaPath, 'Theme schema path')}>
                    <span className="json-file-pill-main">
                        <span className="material-symbols-outlined">schema</span>
                        <span className="json-file-pill-text">
                            <strong>{getDisplayName(themePaths?.schemaPath, 'clip-theme.schema.json')}</strong>
                            <span>Schema and color keys</span>
                        </span>
                    </span>
                    <span className="json-file-pill-copy material-symbols-outlined">content_copy</span>
                </button>

                <div className="json-actions-stack">
                    <button className="json-action-btn" type="button" onClick={() => { void openThemeConfigInSystem(); }}>Open Theme JSON</button>
                    <button className="json-action-btn" type="button" onClick={() => { void reloadThemeFromDisk(); }}>Reload Theme File</button>
                    <button className="json-action-btn" type="button" onClick={() => { void exportThemeJson(); }}>Export Theme JSON</button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(SettingsThemeSection);
