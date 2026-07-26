import * as React from 'react';
import { BACKUP_INTERVALS } from '../app-constants';
import type { BackupEntry, Settings } from '../app-types';
import Switch from './Switch';
import PrototypeSelect from './PrototypeSelect';
import { getRelativeTime } from '../theme-utils';

// Auto-created backups are named clip-backup-<ISO timestamp>.db; anything else
// is a user-renamed backup and shows its custom name instead of a date.
const AUTO_BACKUP_FILE_RE = /^clip-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db$/;

function localBackupLabel(backup: BackupEntry): string {
    if (AUTO_BACKUP_FILE_RE.test(backup.file)) {
        const date = new Date(backup.time);
        if (!isNaN(date.getTime())) {
            return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
    }
    return backup.file.replace(/^clip-backup-/, '').replace(/\.db$/, '');
}

function formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface RenamingState {
    kind: 'local' | 'cloud';
    id: string; // filename (local) or backup id (cloud)
    value: string;
}

interface SettingsBackupsSectionProps {
    settingsDraft: Settings | null;
    settings: Settings;
    setSettingsDraft: React.Dispatch<React.SetStateAction<Settings | null>>;
    isBackingUp: boolean;
    setIsBackingUp: React.Dispatch<React.SetStateAction<boolean>>;
    setBackupList: React.Dispatch<React.SetStateAction<BackupEntry[]>>;
    showToast: (type: 'success' | 'error' | 'info', message: string) => void;
    log: { error: (...args: any[]) => void };
    refreshBackupList: () => void;
    backupList: BackupEntry[];
    selectedBackups: Set<string>;
    setSelectedBackups: React.Dispatch<React.SetStateAction<Set<string>>>;
    setBackupToDelete: React.Dispatch<React.SetStateAction<string>>;
    setBackupDeleteAction: React.Dispatch<React.SetStateAction<'single' | 'multiple' | 'cloud' | null>>;
    onRequestRestore: (kind: 'local' | 'cloud', id: string, label: string) => void;
    // Cloud state
    loggedIn: boolean;
    isPro: boolean;
    syncEnabled: boolean;
    syncUnlocked: boolean;
    cloudBackups: { id: string; deviceName: string | null; sizeBytes: number; createdAt: string }[];
    cloudBusy: boolean;
    onCloudBackupNow: () => void;
    onRefreshCloudBackups: () => void;
    onNavigateToAccount: () => void;
}

const rowActionBtnClass = 'text-on-surface-variant hover:text-primary transition-colors bg-transparent border-0 p-0 flex items-center';

const SettingsBackupsSection: React.FC<SettingsBackupsSectionProps> = ({
    settingsDraft,
    settings,
    setSettingsDraft,
    isBackingUp,
    setIsBackingUp,
    setBackupList,
    showToast,
    log,
    refreshBackupList,
    backupList,
    selectedBackups,
    setSelectedBackups,
    setBackupToDelete,
    setBackupDeleteAction,
    onRequestRestore,
    loggedIn,
    isPro,
    syncEnabled,
    syncUnlocked,
    cloudBackups,
    cloudBusy,
    onCloudBackupNow,
    onRefreshCloudBackups,
    onNavigateToAccount,
}) => {
    const current = settingsDraft ?? settings;
    const update = React.useCallback((patch: Partial<Settings>) => {
        setSettingsDraft((prev) => ({ ...(prev ?? settings), ...patch }));
    }, [setSettingsDraft, settings]);

    const [renaming, setRenaming] = React.useState<RenamingState | null>(null);
    const [renameBusy, setRenameBusy] = React.useState(false);

    const createBackup = React.useCallback(async () => {
        try {
            setIsBackingUp(true);
            const backupPath = await window.electronAPI?.createBackup?.();
            const list = (await window.electronAPI?.listBackups?.()) || [];
            setBackupList(list);
            if (backupPath) {
                showToast('success', 'Backup created.');
            }
        } catch (error) {
            log.error('Backup error', error instanceof Error ? error.message : String(error));
            showToast('error', 'Backup failed');
        } finally {
            setIsBackingUp(false);
        }
    }, [log, setBackupList, setIsBackingUp, showToast]);

    const commitRename = React.useCallback(async () => {
        if (!renaming || renameBusy) return;
        const name = renaming.value.trim();
        if (!name) {
            setRenaming(null);
            return;
        }
        setRenameBusy(true);
        try {
            if (renaming.kind === 'local') {
                const r = await window.electronAPI?.renameBackup?.(renaming.id, name);
                if (r?.ok) {
                    showToast('success', 'Backup renamed. Renamed backups are never auto-deleted.');
                    setSelectedBackups(new Set());
                    refreshBackupList();
                    setRenaming(null);
                } else {
                    showToast('error', r?.error ?? 'Rename failed.');
                }
            } else {
                const r = await window.electronAPI.sync.renameBackup(renaming.id, name);
                if (r.ok) {
                    showToast('success', 'Cloud backup renamed.');
                    onRefreshCloudBackups();
                    setRenaming(null);
                } else {
                    showToast('error', r.error ?? 'Rename failed.');
                }
            }
        } catch (error) {
            log.error('Rename backup error', error instanceof Error ? error.message : String(error));
            showToast('error', 'Rename failed.');
        } finally {
            setRenameBusy(false);
        }
    }, [renaming, renameBusy, showToast, setSelectedBackups, refreshBackupList, onRefreshCloudBackups, log]);

    const renameEditor = (
        <div className="flex items-center gap-2 w-full">
            <input
                type="text"
                value={renaming?.value ?? ''}
                autoFocus
                disabled={renameBusy}
                maxLength={64}
                placeholder="New name"
                onChange={(e) => setRenaming((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename();
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        setRenaming(null);
                    }
                }}
                className="flex-1 min-w-0 bg-surface-container-low text-on-surface text-xs rounded-lg px-2.5 py-1.5 border border-white/10 outline-none focus:border-primary"
            />
            <button
                type="button"
                className={rowActionBtnClass}
                title="Save name"
                disabled={renameBusy}
                onClick={() => void commitRename()}
            >
                <span className="material-symbols-outlined text-base">check</span>
            </button>
            <button
                type="button"
                className={rowActionBtnClass}
                title="Cancel"
                disabled={renameBusy}
                onClick={() => setRenaming(null)}
            >
                <span className="material-symbols-outlined text-base">close</span>
            </button>
        </div>
    );

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
                    <p className="text-[11px] text-on-surface-variant">Automatic backups run in the background and can take up to a minute after the interval to appear. Use the refresh icon to update the list.</p>
                </div>

                <div className="space-y-2 py-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-on-surface text-sm">Max Backups to Keep</h3>
                            <p className="text-[11px] text-on-surface-variant">Older backups are auto-deleted; renamed ones are kept</p>
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
                {loggedIn && isPro && syncEnabled && syncUnlocked && (
                    <p className="text-[10px] text-on-surface-variant text-center">
                        An encrypted copy is also uploaded to the cloud while sync is on.
                    </p>
                )}
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm">folder</span>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">On This Device</span>
                    </div>
                    <button className="text-on-surface-variant hover:text-primary transition-colors bg-transparent border-0 flex items-center" type="button" title="Refresh list" onClick={refreshBackupList}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>refresh</span>
                    </button>
                </div>

                <div className="space-y-2">
                    {backupList.length === 0 ? (
                        <div className="flex items-center justify-center p-3 bg-surface-container-high rounded-lg">
                            <p className="text-xs text-on-surface-variant">No backups found. Create a backup first.</p>
                        </div>
                    ) : backupList.map((backup) => {
                        const isRenaming = renaming?.kind === 'local' && renaming.id === backup.file;
                        const isChecked = selectedBackups.has(backup.file);
                        return (
                            <div key={backup.file} className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    aria-label={`Select ${localBackupLabel(backup)}`}
                                    onChange={(e) => {
                                        setSelectedBackups((prev) => {
                                            const next = new Set(prev);
                                            if (e.target.checked) next.add(backup.file);
                                            else next.delete(backup.file);
                                            return next;
                                        });
                                    }}
                                    style={{ accentColor: current.accentColor, width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                                />
                                {isRenaming ? renameEditor : (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-on-surface truncate" title={backup.file}>{localBackupLabel(backup)}</p>
                                            <p className="text-[10px] text-on-surface-variant">{getRelativeTime(backup.time)}{backup.size ? ` · ${formatSize(backup.size)}` : ''}</p>
                                        </div>
                                        <button className={rowActionBtnClass} type="button" title="Restore this backup" onClick={() => onRequestRestore('local', backup.file, localBackupLabel(backup))}>
                                            <span className="material-symbols-outlined text-base">settings_backup_restore</span>
                                        </button>
                                        <button className={rowActionBtnClass} type="button" title="Rename this backup" onClick={() => setRenaming({ kind: 'local', id: backup.file, value: localBackupLabel(backup) })}>
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                        <button className="text-on-surface-variant hover:text-error transition-colors bg-transparent border-0 p-0 flex items-center" type="button" title="Delete this backup" onClick={() => {
                                            setBackupToDelete(backup.file);
                                            setBackupDeleteAction('single');
                                        }}>
                                            <span className="material-symbols-outlined text-base">delete</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {selectedBackups.size > 0 && (
                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            className="text-[11px] text-on-surface-variant bg-transparent border-0 hover:underline"
                            onClick={() => setSelectedBackups(new Set())}
                        >
                            Clear selection
                        </button>
                        <button
                            type="button"
                            className="py-1.5 px-3 rounded-lg text-[11px] font-semibold border-0"
                            style={{ background: '#ff4136', color: '#fff' }}
                            onClick={() => setBackupDeleteAction('multiple')}
                        >
                            Delete selected ({selectedBackups.size})
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm">cloud</span>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Cloud Backups</span>
                    </div>
                    {loggedIn && isPro && syncEnabled && syncUnlocked && (
                        <div className="flex items-center gap-3">
                            <button className="text-on-surface-variant hover:text-primary transition-colors bg-transparent border-0 flex items-center" type="button" title="Refresh cloud backups" onClick={onRefreshCloudBackups}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>refresh</span>
                            </button>
                            <button
                                type="button"
                                className="text-[11px] text-primary bg-transparent border-0 hover:underline disabled:opacity-60"
                                disabled={cloudBusy}
                                onClick={onCloudBackupNow}
                            >
                                {cloudBusy ? 'Working…' : 'Back up now'}
                            </button>
                        </div>
                    )}
                </div>

                {!loggedIn || !isPro ? (
                    <div className="flex items-center justify-center p-3 bg-surface-container-high rounded-lg" style={{ opacity: 0.6 }}>
                        <p className="text-xs text-on-surface-variant">Cloud backups are part of Clip Pro.</p>
                    </div>
                ) : !syncEnabled ? (
                    <button
                        type="button"
                        className="w-full flex items-center justify-center p-3 bg-surface-container-high rounded-lg border-0 cursor-pointer"
                        onClick={onNavigateToAccount}
                    >
                        <p className="text-xs text-on-surface-variant">Turn on Encrypted Sync in your Profile to back up to the cloud.</p>
                    </button>
                ) : !syncUnlocked ? (
                    <button
                        type="button"
                        className="w-full flex items-center justify-center p-3 bg-surface-container-high rounded-lg border-0 cursor-pointer"
                        onClick={onNavigateToAccount}
                    >
                        <p className="text-xs text-on-surface-variant">Sync is locked. Unlock it in your Profile to manage cloud backups.</p>
                    </button>
                ) : (
                    <>
                        <div className="space-y-2">
                            {cloudBackups.length === 0 ? (
                                <div className="flex items-center justify-center p-3 bg-surface-container-high rounded-lg">
                                    <p className="text-xs text-on-surface-variant">No cloud backups yet.</p>
                                </div>
                            ) : cloudBackups.map((backup) => {
                                const isRenaming = renaming?.kind === 'cloud' && renaming.id === backup.id;
                                const created = new Date(backup.createdAt);
                                const label = backup.deviceName || 'Backup';
                                return (
                                    <div key={backup.id} className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
                                        {isRenaming ? renameEditor : (
                                            <>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-on-surface truncate">{label}</p>
                                                    <p className="text-[10px] text-on-surface-variant">
                                                        {isNaN(created.getTime()) ? '' : `${created.toLocaleDateString()} at ${created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                        {backup.sizeBytes ? ` · ${formatSize(backup.sizeBytes)}` : ''}
                                                    </p>
                                                </div>
                                                <button className={`${rowActionBtnClass} disabled:opacity-60`} type="button" title="Restore this cloud backup" disabled={cloudBusy} onClick={() => onRequestRestore('cloud', backup.id, label)}>
                                                    <span className="material-symbols-outlined text-base">settings_backup_restore</span>
                                                </button>
                                                <button className={rowActionBtnClass} type="button" title="Rename this cloud backup" onClick={() => setRenaming({ kind: 'cloud', id: backup.id, value: label })}>
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>
                                                <button className="text-on-surface-variant hover:text-error transition-colors bg-transparent border-0 p-0 flex items-center" type="button" title="Delete this cloud backup" onClick={() => {
                                                    setBackupToDelete(backup.id);
                                                    setBackupDeleteAction('cloud');
                                                }}>
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-on-surface-variant text-center">
                            Backups are encrypted with your sync passphrase. The 3 newest are kept in the cloud.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default React.memo(SettingsBackupsSection);
