import * as React from 'react';
import { MODIFIER_OPTIONS } from '../app-constants';
import type { Settings } from '../app-types';

interface UseShortcutDraftArgs {
    settingsDraft: Settings | null;
    settings: Settings;
    setSettingsDraft: React.Dispatch<React.SetStateAction<Settings | null>>;
}

export function useShortcutDraft({ settingsDraft, settings, setSettingsDraft }: UseShortcutDraftArgs) {
    const [shortcutModifiers, setShortcutModifiers] = React.useState<string[]>(() => {
        const shortcut = settingsDraft?.globalShortcut ?? settings.globalShortcut;
        return shortcut
            .split('+')
            .filter((k) => MODIFIER_OPTIONS.some((opt) => opt.value.toLowerCase() === k.toLowerCase()));
    });

    const [shortcutMainKey, setShortcutMainKey] = React.useState<string>(() => {
        const shortcut = settingsDraft?.globalShortcut ?? settings.globalShortcut;
        const parts = shortcut.split('+');
        return parts[parts.length - 1] || '';
    });

    const [showShortcutInfo, setShowShortcutInfo] = React.useState(false);

    React.useEffect(() => {
        const shortcut = settingsDraft?.globalShortcut ?? settings.globalShortcut;
        const parts = shortcut.split('+');
        setShortcutModifiers(parts.slice(0, -1));
        setShortcutMainKey(parts[parts.length - 1] || '');
    }, [settingsDraft?.globalShortcut, settings.globalShortcut]);

    React.useEffect(() => {
        const composed = [...shortcutModifiers, shortcutMainKey].filter(Boolean).join('+');
        setSettingsDraft((s) => (s ? { ...s, globalShortcut: composed } : null));
    }, [shortcutModifiers, shortcutMainKey, setSettingsDraft]);

    return {
        shortcutModifiers,
        setShortcutModifiers,
        shortcutMainKey,
        setShortcutMainKey,
        showShortcutInfo,
        setShowShortcutInfo,
    };
}
