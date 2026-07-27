import * as React from 'react';
import type { Settings } from '../app-types';
import Switch from './Switch';

interface SettingsBehaviorSectionProps {
    settingsDraft: Settings | null;
    settings: Settings;
    setSettingsDraft: React.Dispatch<React.SetStateAction<Settings | null>>;
    themeColors: {
        border: string;
        panelBackground: string;
        warning: string;
        danger: string;
        textSecondary: string;
        textPrimary: string;
    };
    onTogglePinning?: (value: boolean) => void;
}

const SettingsBehaviorSection: React.FC<SettingsBehaviorSectionProps> = ({
    settingsDraft,
    settings,
    setSettingsDraft,
    onTogglePinning,
}) => {
    const current = settingsDraft ?? settings;
    const update = React.useCallback((patch: Partial<Settings>) => {
        setSettingsDraft((prev) => ({ ...(prev ?? settings), ...patch }));
    }, [setSettingsDraft, settings]);

    return (
        <div className="space-y-3 py-3">
            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">notifications</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Notifications</span>
                </div>

                <div className="flex items-center justify-between py-2">
                    <div>
                        <h3 className="font-medium text-on-surface text-sm">Show Notifications</h3>
                        <p className="text-[11px] text-on-surface-variant">Notify on new clipboard items</p>
                    </div>
                    <Switch checked={current.showNotifications} onChange={(value) => update({ showNotifications: value })} accentColor="#abccff" />
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">content_copy</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Clipboard Behavior</span>
                </div>

                <div className="flex items-center justify-between py-2">
                    <div>
                        <h3 className="font-medium text-on-surface text-sm">Store Images</h3>
                        <p className="text-[11px] text-on-surface-variant">Save copied images to history. Changing this doesn't affect items already in your history.</p>
                    </div>
                    <Switch checked={current.storeImagesInClipboard} onChange={(value) => update({ storeImagesInClipboard: value })} accentColor="#abccff" />
                </div>

                <div className="flex items-center justify-between py-2">
                    <div>
                        <h3 className="font-medium text-on-surface text-sm">Pin Favorite Items</h3>
                        <p className="text-[11px] text-on-surface-variant">Allow pinning frequently used items. Existing items are unaffected when turning this on.</p>
                    </div>
                    <Switch
                        checked={current.pinFavoriteItems}
                        onChange={(value) => {
                            if (onTogglePinning) {
                                onTogglePinning(value);
                            } else {
                                update({ pinFavoriteItems: value });
                            }
                        }}
                        accentColor="#abccff"
                    />
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">help</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Confirmations</span>
                </div>

                <div className="flex items-center justify-between py-2">
                    <div>
                        <h3 className="font-medium text-on-surface text-sm">Delete Confirmation</h3>
                        <p className="text-[11px] text-on-surface-variant">Ask before deleting items</p>
                    </div>
                    <Switch checked={current.deleteConfirm} onChange={(value) => update({ deleteConfirm: value })} accentColor="#abccff" />
                </div>
            </div>
        </div>
    );
};

export default React.memo(SettingsBehaviorSection);
