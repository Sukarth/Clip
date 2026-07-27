import * as React from 'react';
import type { Settings } from '../../app-types';
import type { ThemeProfile } from '../../../theme-config';

interface BackupRestoreDialogProps {
    settings: Settings;
    themeColors: ThemeProfile['colors'];
    kind: 'local' | 'cloud';
    label: string;
    busy: boolean;
    isClosing: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onConfirmRestore: () => void;
    onCancel: () => void;
}

const BackupRestoreDialog: React.FC<BackupRestoreDialogProps> = ({
    settings,
    themeColors,
    kind,
    label,
    busy,
    isClosing,
    dialogRef,
    onConfirmRestore,
    onCancel,
}) => {
    return (
        <div
            className={`fade-opacity-${isClosing ? 'out' : 'in'}`}
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2200,
                borderRadius: settings.borderRadius,
            }}
        >
            <div
                ref={dialogRef}
                className={`${isClosing ? 'fade-out' : 'fade-in'}`}
                role="dialog"
                aria-modal="true"
                aria-label="Backup restore confirmation"
                tabIndex={-1}
                style={{
                    background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                    borderRadius: 10,
                    padding: 24,
                    maxWidth: 'min(420px, 80vw)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    boxShadow: '0 2px 12px #0008',
                    border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                }}
            >
                <div
                    style={{
                        marginBottom: 18,
                        fontWeight: 600,
                        fontSize: 17,
                        lineHeight: 1.4,
                    }}
                >
                    Restore {kind === 'cloud' ? 'cloud backup' : 'backup'} "{label}"?
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 400,
                            color: themeColors.textSecondary,
                            marginTop: 8,
                        }}
                    >
                        Your current clipboard history will be replaced with this
                        backup's contents.
                        {kind === 'cloud' ? ' The backup is downloaded and decrypted on this device first.' : ''}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        style={{
                            flex: 1,
                            background: settings.accentColor,
                            color: '#06131f',
                            border: `1px solid ${settings.accentColor}`,
                            borderRadius: 8,
                            padding: '9px 16px',
                            fontWeight: 600,
                            cursor: busy ? 'wait' : 'pointer',
                            opacity: busy ? 0.7 : 1,
                        }}
                        disabled={busy}
                        onClick={onConfirmRestore}
                    >
                        {busy ? 'Restoring…' : 'Yes, Restore'}
                    </button>
                    <button
                        data-dialog-autofocus
                        style={{
                            flex: 1,
                            background: settings.theme === 'light' ? '#ffffff' : '#2a2a2a',
                            color: settings.theme === 'light' ? '#1c1e21' : '#fff',
                            border: `1px solid ${settings.theme === 'light' ? '#c9ced6' : '#444'}`,
                            borderRadius: 8,
                            padding: '9px 16px',
                            fontWeight: 600,
                            cursor: busy ? 'default' : 'pointer',
                        }}
                        disabled={busy}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(BackupRestoreDialog);
