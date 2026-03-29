import * as React from 'react';
import { MAIN_KEY_OPTIONS, MODIFIER_OPTIONS, sectionHeaderStyle } from '../app-constants';
import type { Settings } from '../app-types';
import { WINDOW_SIZE_LIMITS } from '../../theme-config';
import Switch from './Switch';

interface SettingsGeneralSectionProps {
    settingsDraft: Settings | null;
    settings: Settings;
    setSettingsDraft: React.Dispatch<React.SetStateAction<Settings | null>>;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    persistSettings: (nextSettings: Settings, persistDraft?: boolean) => void;
    maxItemsInputValue: number | null;
    setMaxItemsInputValue: React.Dispatch<React.SetStateAction<number | null>>;
    hasMaxItemsChanges: boolean;
    setHasMaxItemsChanges: React.Dispatch<React.SetStateAction<boolean>>;
    setPendingMaxItems: React.Dispatch<React.SetStateAction<number | null>>;
    setBackupCreated: React.Dispatch<React.SetStateAction<boolean>>;
    setShowMaxItemsWarning: React.Dispatch<React.SetStateAction<boolean>>;
    itemsLength: number;
    shortcutModifiers: string[];
    setShortcutModifiers: React.Dispatch<React.SetStateAction<string[]>>;
    shortcutMainKey: string;
    setShortcutMainKey: React.Dispatch<React.SetStateAction<string>>;
    showShortcutInfo: boolean;
    setShowShortcutInfo: React.Dispatch<React.SetStateAction<boolean>>;
    clampWindowWidth: (value: unknown) => number;
    clampWindowHeight: (value: unknown) => number;
    windowSizeError: string;
    showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const SettingsGeneralSection: React.FC<SettingsGeneralSectionProps> = ({
    settingsDraft,
    settings,
    setSettingsDraft,
    setSettings,
    persistSettings,
    maxItemsInputValue,
    setMaxItemsInputValue,
    hasMaxItemsChanges,
    setHasMaxItemsChanges,
    setPendingMaxItems,
    setBackupCreated,
    setShowMaxItemsWarning,
    itemsLength,
    shortcutModifiers,
    setShortcutModifiers,
    shortcutMainKey,
    setShortcutMainKey,
    showShortcutInfo,
    setShowShortcutInfo,
    clampWindowWidth,
    clampWindowHeight,
    windowSizeError,
    showToast,
}) => {
    const accentColor = settingsDraft?.accentColor ?? settings.accentColor;
    const currentMaxItems = settingsDraft?.maxItems ?? settings.maxItems;

    const applyMaxItemsValue = () => {
        if (maxItemsInputValue === null) {
            return;
        }

        const newValue = maxItemsInputValue;
        if (newValue < currentMaxItems) {
            setPendingMaxItems(newValue);
            setBackupCreated(false);
            setShowMaxItemsWarning(true);
            return;
        }

        if (newValue > currentMaxItems && itemsLength > 0 && newValue > itemsLength + 50) {
            setPendingMaxItems(newValue);
            setBackupCreated(false);
            setShowMaxItemsWarning(true);
            return;
        }

        const newSettings = settingsDraft
            ? { ...settingsDraft, maxItems: newValue }
            : { ...settings, maxItems: newValue };

        setSettingsDraft(newSettings);
        setSettings(newSettings);
        persistSettings(newSettings);
        setMaxItemsInputValue(null);
        setHasMaxItemsChanges(false);
    };

    return (
        <>
            <div>
                <h2 style={{ ...sectionHeaderStyle, marginBlockStart: 0, color: '#e1e1e1', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                    General
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Max clipboard items</span>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="settings-input"
                                type="number"
                                min={10}
                                max={500}
                                value={maxItemsInputValue ?? currentMaxItems}
                                onChange={(e) => {
                                    const newValue = Number(e.target.value);
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
                                    boxSizing: 'border-box',
                                }}
                                onFocus={(e) => (e.target.style.borderColor = accentColor)}
                                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                            />
                            {hasMaxItemsChanges && (
                                <button
                                    style={{
                                        position: 'absolute',
                                        right: 8,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: accentColor,
                                        border: 'none',
                                        borderRadius: 4,
                                        color: '#fff',
                                        padding: '4px 8px',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: 0.9,
                                    }}
                                    onClick={applyMaxItemsValue}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.9')}
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
                            onChange={(e) =>
                                setSettingsDraft((s) =>
                                    s ? { ...s, windowHideBehavior: e.target.value as Settings['windowHideBehavior'] } : null,
                                )
                            }
                            style={{
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                padding: '10px 12px',
                                fontSize: 14,
                                transition: 'border-color 0.2s, background 0.2s',
                                outline: 'none',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = accentColor)}
                            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                        >
                            <option value="hide">Hide (completely hidden)</option>
                            <option value="tray">Minimize to tray (tray icon only)</option>
                        </select>
                    </label>
                    <label
                        className="settings-container"
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Show clipboard window in taskbar</span>
                        <Switch
                            checked={settingsDraft?.showInTaskbar ?? settings.showInTaskbar}
                            onChange={(v) => setSettingsDraft((s) => (s ? { ...s, showInTaskbar: v } : null))}
                            accentColor={accentColor}
                        />
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Shortcut to open clipboard</span>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                {MODIFIER_OPTIONS.map((opt) => (
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
                                                ? accentColor
                                                : 'rgba(255,255,255,0.05)',
                                            borderRadius: 6,
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            border: shortcutModifiers.includes(opt.value)
                                                ? `1px solid ${accentColor}`
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
                                            onChange={(e) => {
                                                setShortcutModifiers((mods) =>
                                                    e.target.checked
                                                        ? [...mods, opt.value]
                                                        : mods.filter((m) => m !== opt.value),
                                                );
                                            }}
                                            style={{
                                                accentColor,
                                                margin: 0,
                                                width: 14,
                                                height: 14,
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
                            onChange={(e) => setShortcutMainKey(e.target.value)}
                            style={{
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                padding: '10px 12px',
                                fontSize: 14,
                                transition: 'border-color 0.2s, background 0.2s',
                                outline: 'none',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = accentColor)}
                            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                        >
                            <option value="">Select key...</option>
                            {MAIN_KEY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <div
                            className="settings-display-box"
                            style={{
                                fontSize: 12,
                                color: '#888',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 6,
                                border: '1px solid rgba(255,255,255,0.08)',
                                fontFamily: 'monospace',
                            }}
                        >
                            {shortcutModifiers.concat(shortcutMainKey).filter(Boolean).join('+') || 'No shortcut set'}
                        </div>
                        {shortcutModifiers.includes('Super') && (
                            <div
                                style={{
                                    fontSize: 12,
                                    color: '#e67e22',
                                    padding: '8px 12px',
                                    background: 'rgba(230, 126, 34, 0.1)',
                                    borderRadius: 6,
                                    border: '1px solid rgba(230, 126, 34, 0.2)',
                                }}
                            >
                                ⚠️ Not all shortcuts with Windows key are supported.
                                <span
                                    style={{
                                        color: '#888',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        marginLeft: 4,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowShortcutInfo((v) => !v);
                                    }}
                                >
                                    {showShortcutInfo ? 'Hide info' : 'More info'}
                                </span>
                            </div>
                        )}
                        {shortcutModifiers.includes('Super') && showShortcutInfo && (
                            <div
                                style={{
                                    padding: 12,
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: '#bbb',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    lineHeight: 1.4,
                                }}
                            >
                                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 6 }}>Why this limitation?</div>
                                Windows reserves many shortcuts with the Windows key (like Win+V), so this app uses AutoHotkey to trigger the app directly.
                                <br />
                                <br />
                                <span style={{ color: '#e67e22' }}>
                                    However, some shortcuts (like Win+Shift+S) cannot be replaced and are reserved by Windows.
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <h2 style={{ ...sectionHeaderStyle, color: '#e1e1e1', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                    Window Size
                </h2>
                <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Width (px)</span>
                        <input
                            className="settings-input"
                            type="number"
                            min={WINDOW_SIZE_LIMITS.width.min}
                            max={WINDOW_SIZE_LIMITS.width.max}
                            value={settingsDraft?.windowWidth ?? settings.windowWidth}
                            onChange={(e) =>
                                setSettingsDraft((s) => (s ? { ...s, windowWidth: clampWindowWidth(e.target.value) } : null))
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
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Height (px)</span>
                        <input
                            className="settings-input"
                            type="number"
                            min={WINDOW_SIZE_LIMITS.height.min}
                            max={WINDOW_SIZE_LIMITS.height.max}
                            value={settingsDraft?.windowHeight ?? settings.windowHeight}
                            onChange={(e) =>
                                setSettingsDraft((s) =>
                                    s ? { ...s, windowHeight: clampWindowHeight(e.target.value) } : null,
                                )
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
                </div>
                <div
                    style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: windowSizeError ? '#ff4136' : '#888',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span>
                        {windowSizeError ||
                            `Allowed: ${WINDOW_SIZE_LIMITS.width.min}-${WINDOW_SIZE_LIMITS.width.max}px width, ${WINDOW_SIZE_LIMITS.height.min}-${WINDOW_SIZE_LIMITS.height.max}px height.`}
                    </span>
                    <button
                        onClick={() => {
                            setSettingsDraft((s) =>
                                s
                                    ? {
                                        ...s,
                                        windowWidth: WINDOW_SIZE_LIMITS.width.default,
                                        windowHeight: WINDOW_SIZE_LIMITS.height.default,
                                    }
                                    : null,
                            );
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
                            gap: 4,
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
        </>
    );
};

export default React.memo(SettingsGeneralSection);