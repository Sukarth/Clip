import * as React from 'react';
import { BACKUP_INTERVALS, sectionHeaderStyle, subHeaderStyle } from '../app-constants';
import type { BackupEntry, Settings } from '../app-types';
import Switch from './Switch';
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
    setSelectedBackups,
    selectedBackup,
    setBackupToDelete,
    setBackupDeleteAction,
}) => {
    return (
        <>
            <div>
                <h2 style={{ ...sectionHeaderStyle, color: '#e1e1e1', fontSize: 16, fontWeight: 600, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                    Backups
                </h2>
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
                        marginBottom: 16,
                    }}
                >
                    <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Enable automatic database backups</span>
                    <Switch
                        checked={settingsDraft?.enableBackups ?? settings.enableBackups}
                        onChange={(v) => setSettingsDraft((s) => (s ? { ...s, enableBackups: v } : null))}
                        accentColor={settingsDraft?.accentColor ?? settings.accentColor}
                    />
                </label>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 12,
                        opacity: settingsDraft?.enableBackups ?? settings.enableBackups ? 1 : 0.5,
                        transition: 'opacity 0.2s',
                        marginBottom: 16,
                    }}
                >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Backup interval</span>
                        <select
                            className="settings-select"
                            value={settingsDraft?.backupInterval ?? settings.backupInterval}
                            onChange={(e) =>
                                setSettingsDraft((s) => (s ? { ...s, backupInterval: Number(e.target.value) } : null))
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
                            disabled={!(settingsDraft?.enableBackups ?? settings.enableBackups)}
                            onFocus={(e) => (e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor)}
                            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                        >
                            {BACKUP_INTERVALS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 100 }}>
                        <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>Max backups</span>
                        <input
                            className="settings-input"
                            type="number"
                            min={1}
                            max={50}
                            value={settingsDraft?.maxBackups ?? settings.maxBackups}
                            onChange={(e) =>
                                setSettingsDraft((s) => (s ? { ...s, maxBackups: Number(e.target.value) } : null))
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
                            disabled={!(settingsDraft?.enableBackups ?? settings.enableBackups)}
                            onFocus={(e) => (e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor)}
                            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                        />
                    </label>
                </div>
                <button
                    className="settings-button"
                    style={{
                        background: isBackingUp ? `${settingsDraft?.accentColor ?? settings.accentColor}44` : '#23252a',
                        border: isBackingUp
                            ? `1px solid ${settingsDraft?.accentColor ?? settings.accentColor}`
                            : '1px solid #444',
                        marginBottom: 15,
                        borderRadius: 8,
                        width: '100%',
                        color: '#fff',
                        padding: '7px 18px',
                        cursor: isBackingUp ? 'wait' : 'pointer',
                        fontWeight: 600,
                        fontSize: 15,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: isBackingUp ? 0.9 : 1,
                    }}
                    disabled={isBackingUp}
                    onClick={async () => {
                        try {
                            setIsBackingUp(true);
                            const backupPath = await window.electronAPI?.createBackup?.();
                            const newList = (await window.electronAPI?.listBackups?.()) || [];
                            setBackupList(newList);
                            setSelectedBackup('');

                            if (backupPath) {
                                const filename = backupPath.split('\\').pop() || 'backup';
                                showToast('success', `Backup created successfully: ${filename}`);
                            } else {
                                showToast('error', 'Could not create backup');
                            }
                        } catch (error) {
                            log.error('Backup error', error instanceof Error ? error.message : String(error));
                            showToast('error', `Backup failed: ${error instanceof Error ? error.message : String(error)}`);
                        } finally {
                            setIsBackingUp(false);
                        }
                    }}
                >
                    {isBackingUp ? (
                        <>
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: '#fff',
                                    animation: 'spin 1s linear infinite',
                                }}
                            ></span>
                            Creating...
                        </>
                    ) : (
                        'Create Backup Now'
                    )}
                </button>
            </div>

            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ ...subHeaderStyle, margin: 0 }}>Backup Management</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            className="settings-button"
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 6,
                                color: '#fff',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 500,
                                transition: 'background 0.2s',
                            }}
                            onClick={refreshBackupList}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        >
                            Refresh
                        </button>
                        <button
                            className="settings-button"
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 6,
                                color: '#fff',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 500,
                                transition: 'background 0.2s',
                            }}
                            onClick={() => setShowBackupManagement(!showBackupManagement)}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        >
                            {showBackupManagement ? 'Simple View' : 'Advanced'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                    {backupList.length === 0 ? (
                        <div
                            className="settings-display-box"
                            style={{
                                padding: 16,
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.08)',
                                textAlign: 'center',
                                color: '#888',
                                fontSize: 14,
                            }}
                        >
                            No backups found. Create a backup first.
                        </div>
                    ) : (
                        <>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: '#aaa',
                                    marginBottom: 8,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <span>
                                    Found {backupList.length} backup{backupList.length !== 1 ? 's' : ''}
                                </span>
                                {showBackupManagement && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 4,
                                                color: '#ccc',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontSize: 11,
                                                transition: 'all 0.2s',
                                            }}
                                            onClick={() => setSelectedBackups(new Set(backupList.map((b) => b.file)))}
                                        >
                                            Select All
                                        </button>
                                        <button
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 4,
                                                color: '#ccc',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontSize: 11,
                                                transition: 'all 0.2s',
                                            }}
                                            onClick={() => setSelectedBackups(new Set())}
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div
                                className="settings-display-box"
                                style={{
                                    maxHeight: 200,
                                    overflowY: 'auto',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 8,
                                    background: 'rgba(255,255,255,0.03)',
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#444 transparent',
                                }}
                            >
                                {backupList.map((backup, index) => {
                                    const date = new Date(backup.time);
                                    const isSelected = selectedBackup === backup.file;
                                    const isChecked = selectedBackups.has(backup.file);
                                    const formattedDate = date.toLocaleDateString();
                                    const formattedTime = date.toLocaleTimeString();
                                    const relativeTime = getRelativeTime(backup.time);

                                    return (
                                        <div
                                            key={backup.file}
                                            style={{
                                                padding: '12px 16px',
                                                borderBottom:
                                                    index < backupList.length - 1
                                                        ? '1px solid rgba(255,255,255,0.06)'
                                                        : 'none',
                                                background: isSelected
                                                    ? settingsDraft?.accentColor + '22'
                                                    : isChecked
                                                        ? 'rgba(255,255,255,0.08)'
                                                        : 'transparent',
                                                borderLeft: isSelected
                                                    ? `3px solid ${settingsDraft?.accentColor ?? settings.accentColor}`
                                                    : '3px solid transparent',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                            }}
                                        >
                                            {showBackupManagement && (
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const newSelected = new Set(selectedBackups);
                                                        if (e.target.checked) {
                                                            newSelected.add(backup.file);
                                                        } else {
                                                            newSelected.delete(backup.file);
                                                        }
                                                        setSelectedBackups(newSelected);
                                                    }}
                                                    style={{
                                                        accentColor: settingsDraft?.accentColor ?? settings.accentColor,
                                                        width: 16,
                                                        height: 16,
                                                        cursor: 'pointer',
                                                    }}
                                                />
                                            )}

                                            <div
                                                style={{
                                                    flex: 1,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 4,
                                                }}
                                                onClick={() => setSelectedBackup(isSelected ? '' : backup.file)}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected && !isChecked) {
                                                        e.currentTarget.parentElement!.style.background =
                                                            'rgba(255,255,255,0.05)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected && !isChecked) {
                                                        e.currentTarget.parentElement!.style.background = 'transparent';
                                                    }
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontWeight: 500,
                                                            fontSize: 14,
                                                            color: isSelected ? '#fff' : '#ccc',
                                                        }}
                                                    >
                                                        {formattedDate} at {formattedTime}
                                                    </div>
                                                    {isSelected && (
                                                        <div
                                                            style={{
                                                                fontSize: 12,
                                                                color: settingsDraft?.accentColor ?? settings.accentColor,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            SELECTED
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>
                                                    {relativeTime}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: '#666',
                                                        fontFamily: 'monospace',
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {backup.file}
                                                </div>
                                            </div>

                                            <button
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#ff4136',
                                                    cursor: 'pointer',
                                                    padding: '4px 8px',
                                                    borderRadius: 4,
                                                    fontSize: 18,
                                                    lineHeight: 1,
                                                    transition: 'background 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    minWidth: 32,
                                                    height: 32,
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setBackupToDelete(backup.file);
                                                    setBackupDeleteAction('single');
                                                }}
                                                onMouseEnter={(e) =>
                                                    (e.currentTarget.style.background = 'rgba(255,65,54,0.15)')
                                                }
                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                                title="Delete this backup"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    className="settings-button"
                                    style={{
                                        background: selectedBackup
                                            ? settingsDraft?.accentColor ?? settings.accentColor
                                            : '#23252a',
                                        border: selectedBackup
                                            ? `1px solid ${settingsDraft?.accentColor ?? settings.accentColor}`
                                            : '1px solid #444',
                                        flex: 1,
                                        borderRadius: 8,
                                        color: selectedBackup ? '#000' : '#fff',
                                        padding: '12px 18px',
                                        cursor: selectedBackup ? 'pointer' : 'not-allowed',
                                        fontWeight: 600,
                                        fontSize: 15,
                                        transition: 'all 0.2s',
                                        opacity: selectedBackup ? 1 : 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                    }}
                                    disabled={!selectedBackup}
                                    onClick={async () => {
                                        if (selectedBackup) {
                                            const button = document.activeElement as HTMLButtonElement;
                                            const originalText = button.textContent;

                                            try {
                                                button.textContent = 'Restoring...';
                                                button.style.opacity = '0.7';
                                                button.disabled = true;

                                                const success = await window.electronAPI?.restoreBackup?.(selectedBackup);

                                                if (success) {
                                                    showToast('success', 'Backup restored successfully!');
                                                    setSelectedBackup('');
                                                    const newList = (await window.electronAPI?.listBackups?.()) || [];
                                                    setBackupList(newList);
                                                } else {
                                                    showToast('error', 'Failed to restore backup.');
                                                }
                                            } catch (error) {
                                                log.error('Restore error', error instanceof Error ? error.message : String(error));
                                                showToast(
                                                    'error',
                                                    `Restore failed: ${error instanceof Error ? error.message : String(error)}`,
                                                );
                                            } finally {
                                                button.textContent = originalText;
                                                button.style.opacity = '1';
                                                button.disabled = false;
                                            }
                                        }
                                    }}
                                >
                                    {selectedBackup ? '↻ Restore Selected' : 'Select backup to restore'}
                                </button>

                                {showBackupManagement && selectedBackups.size > 0 && (
                                    <button
                                        className="settings-button"
                                        style={{
                                            background: '#ff4136',
                                            border: '1px solid #ff4136',
                                            borderRadius: 8,
                                            color: '#fff',
                                            padding: '12px 18px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: 15,
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8,
                                            minWidth: 140,
                                        }}
                                        onClick={() => setBackupDeleteAction('multiple')}
                                    >
                                        🗑️ Delete {selectedBackups.size}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default React.memo(SettingsBackupsSection);
