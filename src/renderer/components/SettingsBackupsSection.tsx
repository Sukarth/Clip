import * as React from 'react';
import { BACKUP_INTERVALS } from '../app-constants';
import type { BackupEntry, Settings } from '../app-types';
import Switch from './Switch';
import PrototypeSelect from './PrototypeSelect';
import { getRelativeTime } from '../theme-utils';

interface SettingsBackupsSectionProps {
    settingsDraft: Settings | null;
    settings: Settings;
    setSettingsDraft: React.Dispatch<React.SetStateAction<Settings | null>>;
    isBackingUp: boolean;
    setIsBackingUp: React.Dispatch<React.SetStateAction<boolean>>;
    setBackupList: React.Dispatch<React.SetStateAction<BackupEntry[]>>;
    setSelectedBackup: React.Dispatch<React.SetStateAction<string>>;
    showToast: (type: 'success' | 'error' | 'info', message: string) => void;
    log: { error: (...args: any[]) => void };
    refreshBackupList: () => void;
    showBackupManagement: boolean;
    setShowBackupManagement: React.Dispatch<React.SetStateAction<boolean>>;
    backupList: BackupEntry[];
    selectedBackups: Set<string>;
    setSelectedBackups: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedBackup: string;
    setBackupToDelete: React.Dispatch<React.SetStateAction<string>>;
    setBackupDeleteAction: React.Dispatch<React.SetStateAction<'single' | 'multiple' | null>>;
}

const SettingsBackupsSection: React.FC<SettingsBackupsSectionProps> = ({
    settingsDraft,
    settings,
    setSettingsDraft,
    isBackingUp,
    setIsBackingUp,
    setBackupList,
    setSelectedBackup,
    showToast,
    log,
    refreshBackupList,
    showBackupManagement,
    setShowBackupManagement,
    backupList,
    selectedBackups,
    selectedBackup,
    setBackupToDelete,
    setBackupDeleteAction,
}) => {
    const current = settingsDraft ?? settings;
    const update = React.useCallback((patch: Partial<Settings>) => {
        setSettingsDraft((prev) => ({ ...(prev ?? settings), ...patch }));
    }, [setSettingsDraft, settings]);

    const simpleBtnRef = React.useRef<HTMLButtonElement>(null);
    const advancedBtnRef = React.useRef<HTMLButtonElement>(null);
    const [indicatorStyle, setIndicatorStyle] = React.useState<{ width: number; translateX: number }>({ width: 58, translateX: 0 });

    React.useEffect(() => {
        const btn = showBackupManagement ? advancedBtnRef.current : simpleBtnRef.current;
        const container = btn?.parentElement;
        if (btn && container) {
            const btnRect = btn.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            setIndicatorStyle({
                width: btnRect.width,
                translateX: btnRect.left - containerRect.left - 3,
            });
        }
    }, [showBackupManagement]);

    const createBackup = React.useCallback(async () => {
        try {
            setIsBackingUp(true);
            const backupPath = await window.electronAPI?.createBackup?.();
            const list = (await window.electronAPI?.listBackups?.()) || [];
            setBackupList(list);
            setSelectedBackup('');
            if (backupPath) {
                showToast('success', `Backup created: ${backupPath.split(/[\\/]/).pop()}`);
            }
        } catch (error) {
            log.error('Backup error', error instanceof Error ? error.message : String(error));
            showToast('error', 'Backup failed');
        } finally {
            setIsBackingUp(false);
        }
    }, [log, setBackupList, setIsBackingUp, setSelectedBackup, showToast]);

    return (
        <div className="space-y-3 py-3">
            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Automatic Backups</span>
                </div>

                <div className="flex items-center justify-between py-2">
                    <div>
                        <h3 className="font-medium text-on-surface text-sm">Enable Backups</h3>
                        <p className="text-[11px] text-on-surface-variant">Auto backup clipboard database</p>
                    </div>
                    <Switch checked={current.enableBackups} onChange={(value) => update({ enableBackups: value })} accentColor="#abccff" />
                </div>

                <div className="space-y-2 py-2">
                    <h3 className="font-medium text-on-surface text-sm">Backup Interval</h3>
                    <PrototypeSelect
                        value={current.backupInterval}
                        onChange={(value) => update({ backupInterval: Number(value) })}
                        options={BACKUP_INTERVALS.map((option) => ({ value: option.value, label: option.label.replace(/^(\d)/, 'Every $1').replace(/^1 hour$/, 'Every hour').replace(/^1 day$/, 'Every day') }))}
                    />
                </div>

                <div className="space-y-2 py-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-on-surface text-sm">Max Backups to Keep</h3>
                            <p className="text-[11px] text-on-surface-variant">Older backups are auto-deleted</p>
                        </div>
                        <div className="number-input-wrapper" style={{ width: 'fit-content' }}>
                            <button type="button" onClick={() => update({ maxBackups: Math.max(1, current.maxBackups - 1) })}>
                                <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <input type="number" value={current.maxBackups} min={1} max={50} onChange={(e) => update({ maxBackups: Math.max(1, Math.min(50, Number(e.target.value))) })} />
                            <button type="button" onClick={() => update({ maxBackups: Math.min(50, current.maxBackups + 1) })}>
                                <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm">save</span>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Actions</span>
                    </div>
                </div>
                <button className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-container to-primary text-on-primary rounded-lg font-semibold text-sm hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2 border-0" type="button" onClick={() => { void createBackup(); }}>
                    <span className="material-symbols-outlined text-base">backup</span>
                    <span>{isBackingUp ? 'Creating...' : 'Create Backup Now'}</span>
                </button>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm">folder</span>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Backups</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-on-surface-variant hover:text-primary transition-colors bg-transparent border-0" type="button" onClick={refreshBackupList} style={{ marginTop: 5 }}>
                            <span className="material-symbols-outlined text-base" style={{ fontSize: '1.4rem' }}>refresh</span>
                        </button>
                        <div className="view-toggle-container" id="viewToggle">
                            <div className="view-toggle-indicator" id="viewToggleIndicator" style={{ width: indicatorStyle.width, transform: `translateX(${indicatorStyle.translateX}px)` }}></div>
                            <button ref={simpleBtnRef} className={`view-toggle-btn ${!showBackupManagement ? 'active' : ''}`} id="simpleViewBtn" type="button" onClick={() => setShowBackupManagement(false)}>Simple</button>
                            <button ref={advancedBtnRef} className={`view-toggle-btn ${showBackupManagement ? 'active' : ''}`} id="advancedViewBtn" type="button" onClick={() => setShowBackupManagement(true)}>Advanced</button>
                        </div>
                    </div>
                </div>

                <div className="space-y-2" id="backupsList">
                    {backupList.length === 0 ? (
                        <div className="flex items-center justify-center p-3 bg-surface-container-high rounded-lg">
                            <p className="text-xs text-on-surface-variant">No backups found. Create a backup first.</p>
                        </div>
                    ) : backupList.map((backup) => {
                        const selected = selectedBackup === backup.file;
                        return (
                            <div key={backup.file} className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg" style={{ outline: selected ? '1px solid #abccff' : 'none' }}>
                                <button className="flex items-center gap-3 bg-transparent border-0 w-full text-left" type="button" onClick={() => setSelectedBackup(selected ? '' : backup.file)}>
                                    <span className="material-symbols-outlined text-success text-base">check_circle</span>
                                    <div>
                                        <p className="text-xs font-medium text-on-surface">{backup.file}</p>
                                        <p className="text-[10px] text-on-surface-variant">{getRelativeTime(backup.time)}</p>
                                    </div>
                                </button>
                                <button className="text-on-surface-variant hover:text-error transition-colors bg-transparent border-0" type="button" onClick={() => {
                                    setBackupToDelete(backup.file);
                                    setBackupDeleteAction('single');
                                }}>
                                    <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default React.memo(SettingsBackupsSection);
