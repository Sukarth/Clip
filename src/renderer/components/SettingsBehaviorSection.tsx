import * as React from 'react';
import { sectionHeaderStyle } from '../app-constants';
import type { Settings } from '../app-types';
import Switch from './Switch';

const behaviorLabelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
};

function colorWithAlpha(color: string, alpha: number) {
    const normalizedAlpha = Math.min(1, Math.max(0, alpha));
    const percentage = Math.round(normalizedAlpha * 100);
    return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
}

interface SettingsBehaviorSectionProps {
    settingsDraft: Settings | null;
    settings: Settings;
    setSettingsDraft: React.Dispatch<React.SetStateAction<Settings | null>>;
    settingsPaths: { configPath: string; schemaPath: string } | null;
    copyTextToClipboard: (value: string, label: string) => void | Promise<void>;
    openSettingsConfigInSystem: () => void | Promise<void>;
    reloadSettingsFromDisk: () => void | Promise<void>;
    setDangerAction: React.Dispatch<React.SetStateAction<null | 'clear' | 'reset'>>;
    themeColors: {
        border: string;
        panelBackground: string;
        warning: string;
        danger: string;
        textSecondary: string;
        textPrimary: string;
    };
}

const SettingsBehaviorSection: React.FC<SettingsBehaviorSectionProps> = ({
    settingsDraft,
    settings,
    setSettingsDraft,
    settingsPaths,
    copyTextToClipboard,
    openSettingsConfigInSystem,
    reloadSettingsFromDisk,
    setDangerAction,
    themeColors,
}) => {
    const accentColor = settingsDraft?.accentColor ?? settings.accentColor;
    const actionButtonStyle: React.CSSProperties = {
        background: themeColors.panelBackground,
        border: `1px solid ${themeColors.border}`,
        borderRadius: 8,
        color: themeColors.textPrimary,
        padding: '9px 12px',
        cursor: 'pointer',
        fontWeight: 600,
    };

    return (
        <>
            <div>
                <h2 style={sectionHeaderStyle}>Behavior Settings</h2>

                <label style={behaviorLabelStyle}>
                    Show notifications for new clips
                    <Switch
                        checked={settingsDraft?.showNotifications ?? settings.showNotifications}
                        onChange={(v) => setSettingsDraft((s) => ({ ...(s ?? settings), showNotifications: v }))}
                        accentColor={accentColor}
                    />
                </label>

                <label style={behaviorLabelStyle}>
                    Start with system
                    <Switch
                        checked={settingsDraft?.startWithSystem ?? settings.startWithSystem}
                        onChange={(v) => setSettingsDraft((s) => ({ ...(s ?? settings), startWithSystem: v }))}
                        accentColor={accentColor}
                    />
                </label>

                <label style={behaviorLabelStyle}>
                    Store images in clipboard history
                    <Switch
                        checked={settingsDraft?.storeImagesInClipboard ?? settings.storeImagesInClipboard}
                        onChange={(v) => setSettingsDraft((s) => ({ ...(s ?? settings), storeImagesInClipboard: v }))}
                        accentColor={accentColor}
                    />
                </label>

                <label style={behaviorLabelStyle}>
                    Allow pinning favorite items
                    <Switch
                        checked={settingsDraft?.pinFavoriteItems ?? settings.pinFavoriteItems}
                        onChange={(v) => setSettingsDraft((s) => ({ ...(s ?? settings), pinFavoriteItems: v }))}
                        accentColor={accentColor}
                    />
                </label>

                <label style={behaviorLabelStyle}>
                    Ask before deleting items
                    <Switch
                        checked={settingsDraft?.deleteConfirm ?? settings.deleteConfirm}
                        onChange={(v) => setSettingsDraft((s) => ({ ...(s ?? settings), deleteConfirm: v }))}
                        accentColor={accentColor}
                    />
                </label>
            </div>

            <div
                style={{
                    marginTop: 10,
                    padding: 14,
                    border: `1px solid ${themeColors.border}`,
                    borderRadius: 12,
                    background: themeColors.panelBackground,
                }}
            >
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
                        style={actionButtonStyle}
                        onClick={() => {
                            void openSettingsConfigInSystem();
                        }}
                    >
                        Open Settings JSON
                    </button>
                    <button
                        className="settings-button"
                        style={actionButtonStyle}
                        onClick={() => {
                            void reloadSettingsFromDisk();
                        }}
                    >
                        Reload Settings From Disk
                    </button>
                </div>
            </div>

            <div
                style={{
                    marginTop: 32,
                    padding: 18,
                    border: `2px solid ${themeColors.danger}`,
                    borderRadius: 12,
                    background: colorWithAlpha(themeColors.danger, 0.08),
                    color: themeColors.danger,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                }}
            >
                <h2 id="danger-area" style={{ fontSize: 18, fontWeight: 700, color: themeColors.danger, margin: 0, marginBottom: 8 }}>
                    Danger Area
                </h2>
                <div style={{ fontSize: 15, color: themeColors.danger, marginBottom: 8 }}>
                    These actions are irreversible. Please proceed with caution.
                </div>
                <button
                    style={{
                        background: themeColors.danger,
                        border: `1px solid ${themeColors.danger}`,
                        borderRadius: 8,
                        color: '#fff',
                        padding: '8px 18px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 15,
                    }}
                    onClick={() => setDangerAction('clear')}
                >
                    Clear All Clipboard History
                </button>
                <div style={{ fontSize: 13, color: themeColors.danger, marginBottom: 8, marginTop: -8 }}>
                    This will permanently delete all clipboard items.
                </div>
                <button
                    style={{
                        background: themeColors.warning,
                        border: `1px solid ${themeColors.warning}`,
                        borderRadius: 8,
                        color: '#222',
                        padding: '8px 18px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 15,
                    }}
                    onClick={() => setDangerAction('reset')}
                >
                    Reset Settings to Default
                </button>
                <div id="reset-settings-warning" style={{ fontSize: 13, color: themeColors.warning, marginTop: -8 }}>
                    This will reset all settings to their original defaults.
                </div>
            </div>
        </>
    );
};

export default React.memo(SettingsBehaviorSection);