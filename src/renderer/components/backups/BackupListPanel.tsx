import * as React from 'react';
import type { BackupEntry, Settings } from '../../app-types';
import { getRelativeTime } from '../../theme-utils';

interface BackupListPanelProps {
    settingsDraft: Settings | null;
    settings: Settings;
    backupList: BackupEntry[];
    showBackupManagement: boolean;
    selectedBackups: Set<string>;
    setSelectedBackups: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedBackup: string;
    setSelectedBackup: React.Dispatch<React.SetStateAction<string>>;
    setBackupToDelete: React.Dispatch<React.SetStateAction<string>>;
    setBackupDeleteAction: React.Dispatch<React.SetStateAction<'single' | 'multiple' | null>>;
}

const BackupListPanel: React.FC<BackupListPanelProps> = ({
    settingsDraft,
    settings,
    backupList,
    showBackupManagement,
    selectedBackups,
    setSelectedBackups,
    selectedBackup,
    setSelectedBackup,
    setBackupToDelete,
    setBackupDeleteAction,
}) => {
    if (backupList.length === 0) {
        return (
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
        );
    }

    return (
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
                    const isValidDate = !isNaN(date.getTime());
                    const isSelected = selectedBackup === backup.file;
                    const isChecked = selectedBackups.has(backup.file);
                    const formattedDate = isValidDate ? date.toLocaleDateString() : '—';
                    const formattedTime = isValidDate ? date.toLocaleTimeString() : '';
                    const relativeTime = isValidDate ? getRelativeTime(backup.time) : '';

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
                                    ? (settingsDraft?.accentColor ?? settings.accentColor) + '22'
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
                                tabIndex={0}
                                role="button"
                                aria-pressed={isSelected}
                                style={{
                                    flex: 1,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                }}
                                onClick={() => setSelectedBackup(isSelected ? '' : backup.file)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedBackup(isSelected ? '' : backup.file);
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected && !isChecked) {
                                        const parent = e.currentTarget.parentElement;
                                        if (parent) {
                                            parent.style.background = 'rgba(255,255,255,0.05)';
                                        }
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected && !isChecked) {
                                        const parent = e.currentTarget.parentElement;
                                        if (parent) {
                                            parent.style.background = 'transparent';
                                        }
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
                                        {isValidDate && formattedTime ? `${formattedDate} at ${formattedTime}` : formattedDate}
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
        </>
    );
};

export default React.memo(BackupListPanel);
