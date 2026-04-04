import * as React from 'react';
import { BACKUP_INTERVALS, sectionHeaderStyle, subHeaderStyle } from '../app-constants';
import type { BackupEntry, Settings } from '../app-types';
import Switch from './Switch';
import BackupActionsPanel from './backups/BackupActionsPanel';
import BackupListPanel from './backups/BackupListPanel';

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
                <h2
                    style={{
                        ...sectionHeaderStyle,
                        color: '#e1e1e1',
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 16,
                        borderBottom: '1px solid rgba(255,255,255,0.12)',
                    }}
                >
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
                    <span style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>
                        Enable automatic database backups
                    </span>
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
                            onFocus={(e) =>
                                (e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor)
                            }
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
                            onChange={(e) => {
                                const parsed = Number(e.target.value);
                                const clamped = Math.max(1, Math.min(50, isNaN(parsed) ? 1 : parsed));
                                setSettingsDraft((s) => (s ? { ...s, maxBackups: clamped } : null));
                            }}
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
                            onFocus={(e) =>
                                (e.target.style.borderColor = settingsDraft?.accentColor ?? settings.accentColor)
                            }
                            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                        />
                    </label>
                </div>

                <BackupActionsPanel
                    settingsDraft={settingsDraft}
                    settings={settings}
                    isBackingUp={isBackingUp}
                    setIsBackingUp={setIsBackingUp}
                    setBackupList={setBackupList}
                    setSelectedBackup={setSelectedBackup}
                    showToast={showToast}
                    log={log}
                    selectedBackup={selectedBackup}
                    selectedBackups={selectedBackups}
                    setSelectedBackups={setSelectedBackups}
                    showBackupManagement={showBackupManagement}
                    setBackupDeleteAction={setBackupDeleteAction}
                />
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
                    <BackupListPanel
                        settingsDraft={settingsDraft}
                        settings={settings}
                        backupList={backupList}
                        showBackupManagement={showBackupManagement}
                        selectedBackups={selectedBackups}
                        setSelectedBackups={setSelectedBackups}
                        selectedBackup={selectedBackup}
                        setSelectedBackup={setSelectedBackup}
                        setBackupToDelete={setBackupToDelete}
                        setBackupDeleteAction={setBackupDeleteAction}
                    />
                </div>
            </div>
        </>
    );
};

export default React.memo(SettingsBackupsSection);
