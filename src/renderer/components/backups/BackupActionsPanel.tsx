import * as React from 'react';
import type { BackupEntry, Settings } from '../../app-types';

interface BackupActionsPanelProps {
    settingsDraft: Settings | null;
    settings: Settings;
    isBackingUp: boolean;
    setIsBackingUp: React.Dispatch<React.SetStateAction<boolean>>;
    setBackupList: React.Dispatch<React.SetStateAction<BackupEntry[]>>;
    setSelectedBackup: React.Dispatch<React.SetStateAction<string>>;
    showToast: (type: 'success' | 'error' | 'info', message: string) => void;
    log: { error: (...args: any[]) => void };
    selectedBackup: string;
    selectedBackups: Set<string>;
    setSelectedBackups: React.Dispatch<React.SetStateAction<Set<string>>>;
    showBackupManagement: boolean;
    setBackupDeleteAction: React.Dispatch<React.SetStateAction<'single' | 'multiple' | null>>;
}

const BackupActionsPanel: React.FC<BackupActionsPanelProps> = ({
    settingsDraft,
    settings,
    isBackingUp,
    setIsBackingUp,
    setBackupList,
    setSelectedBackup,
    showToast,
    log,
    selectedBackup,
    selectedBackups,
    setSelectedBackups,
    showBackupManagement,
    setBackupDeleteAction,
}) => {
    const [isRestoring, setIsRestoring] = React.useState(false);

    const handleCreateBackup = React.useCallback(async () => {
        try {
            setIsBackingUp(true);
            const backupPath = await window.electronAPI?.createBackup?.();
            const newList = (await window.electronAPI?.listBackups?.()) || [];
            setBackupList(newList);
            setSelectedBackup('');

            if (backupPath) {
                const filename = backupPath.split(/[\\/]/).pop() || 'backup';
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
    }, [log, setBackupList, setIsBackingUp, setSelectedBackup, showToast]);

    const handleRestoreSelected = React.useCallback(async () => {
        if (!selectedBackup || isRestoring) {
            return;
        }

        setIsRestoring(true);
        try {
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
            showToast('error', `Restore failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsRestoring(false);
        }
    }, [isRestoring, log, selectedBackup, setBackupList, setSelectedBackup, showToast]);

    return (
        <>
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
                onClick={() => {
                    void handleCreateBackup();
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
                        cursor: selectedBackup && !isRestoring ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        fontSize: 15,
                        transition: 'all 0.2s',
                        opacity: selectedBackup && !isRestoring ? 1 : 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }}
                    disabled={!selectedBackup || isRestoring}
                    onClick={() => {
                        void handleRestoreSelected();
                    }}
                >
                    {isRestoring
                        ? 'Restoring...'
                        : selectedBackup
                            ? '↻ Restore Selected'
                            : 'Select backup to restore'}
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

            {showBackupManagement && selectedBackups.size > 0 && (
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 4,
                            color: '#ccc',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: 11,
                        }}
                        onClick={() => setSelectedBackups(new Set())}
                    >
                        Clear Selection
                    </button>
                </div>
            )}
        </>
    );
};

export default React.memo(BackupActionsPanel);
