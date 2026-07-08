import * as React from 'react';
import { MAIN_KEY_OPTIONS, MODIFIER_OPTIONS } from '../app-constants';
import type { Settings } from '../app-types';
import { WINDOW_SIZE_LIMITS } from '../../theme-config';
import Switch from './Switch';
import PrototypeSelect from './PrototypeSelect';

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
    onNavigateToAbout: () => void;
}

const SettingsGeneralSection: React.FC<SettingsGeneralSectionProps> = ({
    settingsDraft,
    settings,
    setSettingsDraft,
    maxItemsInputValue,
    setMaxItemsInputValue,
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
    onNavigateToAbout,
}) => {
    const current = settingsDraft ?? settings;

    const [widthInputValue, setWidthInputValue] = React.useState<string | null>(null);
    const [heightInputValue, setHeightInputValue] = React.useState<string | null>(null);

    const update = React.useCallback((patch: Partial<Settings>) => {
        setSettingsDraft((prev) => ({ ...(prev ?? settings), ...patch }));
    }, [setSettingsDraft, settings]);

    const currentMaxItems = current.maxItems;

    const applyMaxItemsValue = React.useCallback((rawValue: number) => {
        const newValue = Math.trunc(rawValue);
        if (!Number.isInteger(newValue) || newValue < 10 || newValue > 500) {
            showToast('error', 'Max clipboard items must be between 10 and 500.');
            return;
        }

        if (newValue < currentMaxItems && itemsLength > newValue) {
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

        update({ maxItems: newValue });
        setMaxItemsInputValue(null);
        setHasMaxItemsChanges(false);
    }, [
        currentMaxItems,
        itemsLength,
        setBackupCreated,
        setHasMaxItemsChanges,
        setMaxItemsInputValue,
        setPendingMaxItems,
        setShowMaxItemsWarning,
        showToast,
        update,
    ]);

    const previewParts = [...shortcutModifiers, shortcutMainKey].filter(Boolean);

    return (
        <div className="space-y-3 py-3">
            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">computer</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Startup &amp; System</span>
                </div>

                <div className="flex items-center justify-between py-2">
                    <div>
                        <h3 className="font-medium text-on-surface text-sm">Start with Windows</h3>
                        <p className="text-[11px] text-on-surface-variant">Launch automatically on login</p>
                    </div>
                    <Switch checked={current.startWithSystem} onChange={(value) => update({ startWithSystem: value })} accentColor="#abccff" />
                </div>

                <div className="flex items-center justify-between py-2">
                    <div>
                        <h3 className="font-medium text-on-surface text-sm">Show in Taskbar</h3>
                        <p className="text-[11px] text-on-surface-variant">Display in Windows taskbar</p>
                    </div>
                    <Switch checked={current.showInTaskbar} onChange={(value) => update({ showInTaskbar: value })} accentColor="#abccff" />
                </div>

                <div className="space-y-2 py-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-on-surface text-sm">Window Hide Behavior</h3>
                            <p className="text-[11px] text-on-surface-variant">What happens when closed</p>
                        </div>
                    </div>
                    <PrototypeSelect
                        value={current.windowHideBehavior}
                        onChange={(value) => update({ windowHideBehavior: value })}
                        options={[
                            { value: 'hide', label: 'Hide completely' },
                            { value: 'tray', label: 'Minimize to system tray' },
                        ]}
                    />
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">content_paste</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Clipboard</span>
                </div>

                <div className="space-y-2 py-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-on-surface text-sm">Max Clipboard Items</h3>
                            <p className="text-[11px] text-on-surface-variant">10 - 500 items</p>
                        </div>
                        <div className="number-input-wrapper">
                            <button type="button" onClick={() => applyMaxItemsValue(Math.max(10, currentMaxItems - 10))}>
                                <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <input
                                type="number"
                                value={maxItemsInputValue ?? currentMaxItems}
                                min={10}
                                max={500}
                                onChange={(event) => {
                                    const value = Number(event.target.value);
                                    if (Number.isFinite(value)) {
                                        setMaxItemsInputValue(value);
                                        setHasMaxItemsChanges(value !== currentMaxItems);
                                        applyMaxItemsValue(value);
                                    }
                                }}
                            />
                            <button type="button" onClick={() => applyMaxItemsValue(Math.min(500, currentMaxItems + 10))}>
                                <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3" style={{ paddingBottom: '1.2rem', paddingTop: '1.2rem' }}>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm">aspect_ratio</span>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Window Size</span>
                    </div>
                    <button
                        className="px-2 py-2 bg-primary-container text-on-primary rounded-lg text-[10px] font-semibold hover:brightness-110 transition-all border-0"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            setWidthInputValue(null);
                            setHeightInputValue(null);
                            update({
                                windowWidth: WINDOW_SIZE_LIMITS.width.default,
                                windowHeight: WINDOW_SIZE_LIMITS.height.default,
                            });
                        }}>Reset to Default</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] text-on-surface-variant">Width ({WINDOW_SIZE_LIMITS.width.min}-{WINDOW_SIZE_LIMITS.width.max})</label>
                        <input className="input-field w-full" type="number" value={widthInputValue ?? current.windowWidth} min={WINDOW_SIZE_LIMITS.width.min} max={WINDOW_SIZE_LIMITS.width.max} onChange={(e) => setWidthInputValue(e.target.value)} onBlur={(e) => {
                            setWidthInputValue(null);
                            update({ windowWidth: clampWindowWidth(e.target.value) });
                        }} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] text-on-surface-variant">Height ({WINDOW_SIZE_LIMITS.height.min}-{WINDOW_SIZE_LIMITS.height.max})</label>
                        <input className="input-field w-full" type="number" value={heightInputValue ?? current.windowHeight} min={WINDOW_SIZE_LIMITS.height.min} max={WINDOW_SIZE_LIMITS.height.max} onChange={(e) => setHeightInputValue(e.target.value)} onBlur={(e) => {
                            setHeightInputValue(null);
                            update({ windowHeight: clampWindowHeight(e.target.value) });
                        }} />
                    </div>
                </div>
                {windowSizeError ? <p className="text-[11px] text-error">{windowSizeError}</p> : null}
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3" style={{ paddingBottom: '1.2rem', paddingTop: '1.2rem' }}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">keyboard</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Global Shortcut</span>
                </div>

                <div>
                    <p className="text-[11px] text-on-surface-variant mb-2">Select modifiers</p>
                    <div className="grid grid-cols-4 gap-2">
                        {MODIFIER_OPTIONS.map((option) => {
                            const prototypeValue = option.value === 'Windows' ? 'Super' : option.value;
                            const active = shortcutModifiers.includes(option.value);
                            return (
                                <button
                                    key={option.value}
                                    className={`shortcut-modifier-btn ${active ? 'active' : ''}`}
                                    data-modifier={prototypeValue}
                                    type="button"
                                    onClick={() => setShortcutModifiers((mods) => active ? mods.filter((modifier) => modifier !== option.value) : [...mods, option.value])}
                                >
                                    <span className="material-symbols-outlined text-xs">check</span>
                                    {option.value === 'Control' ? 'Ctrl' : option.value === 'Windows' ? 'Win' : option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <p className="text-[11px] text-on-surface-variant mb-2">Select main key</p>
                    <PrototypeSelect
                        value={shortcutMainKey}
                        onChange={(value) => setShortcutMainKey(value)}
                        options={[{ value: '', label: 'Select key...' }, ...MAIN_KEY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))]}
                    />
                </div>

                <div className="p-4 bg-surface-container rounded-xl">
                    <p className="text-[10px] text-on-surface-variant mb-3 uppercase tracking-wider">Current shortcut</p>
                    <div className="flex items-center gap-3 flex-wrap" id="shortcutPreview">
                        {previewParts.length === 0 ? (
                            <span className="text-sm text-on-surface-variant italic">No shortcut set</span>
                        ) : previewParts.map((part, index) => (
                            <React.Fragment key={`${part}-${index}`}>
                                <kbd>{part === 'Control' ? 'Ctrl' : part === 'Windows' ? 'Win' : part}</kbd>
                                {index < previewParts.length - 1 ? <span className="key-separator">+</span> : null}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className={`shortcut-warning ${shortcutModifiers.includes('Windows') ? '' : 'hidden'}`} id="shortcutWarning">
                    <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-warning text-base">warning</span>
                            <p className="text-xs text-warning font-medium m-0">Not all shortcuts with Windows key are supported.</p>
                        </div>
                        <button className="px-2 py-1.5 bg-warning/20 text-on-surface-variant rounded-lg text-[10px] font-semibold hover:bg-warning/30 transition-all border-0 ml-6" style={{ cursor: 'pointer' }} type="button" onClick={() => setShowShortcutInfo((v) => !v)}>More info</button>
                    </div>
                    <div className={`${showShortcutInfo ? '' : 'hidden'} mt-2 p-3 bg-surface-container-high rounded-lg text-xs text-on-surface-variant leading-relaxed`} id="shortcutInfoBox">
                        <p className="font-semibold text-on-surface mb-1">Why this limitation?</p>
                        <p>Windows reserves many shortcuts with the Windows key (like Win+V), so this app uses AutoHotkey to trigger the app directly.</p>
                        <p className="text-warning mt-2">However, some shortcuts (like Win+Shift+S) cannot be replaced and are reserved by Windows.</p>
                    </div>
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl">
                <button className="w-full flex items-center justify-between group bg-transparent border-0" type="button" onClick={onNavigateToAbout}>
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-lg">info</span>
                        <div className="text-left">
                            <h3 className="font-medium text-on-surface text-sm">About Clip</h3>
                            <p className="text-[11px] text-on-surface-variant">Version, licenses, and more</p>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
                </button>
            </div>
        </div>
    );
};

export default React.memo(SettingsGeneralSection);
