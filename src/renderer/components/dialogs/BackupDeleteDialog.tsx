import * as React from 'react';
import type { Settings } from '../../app-types';
import type { ThemeProfile } from '../../../theme-config';

interface BackupDeleteDialogProps {
    settings: Settings;
    themeColors: ThemeProfile['colors'];
    action: 'single' | 'multiple' | 'cloud';
    selectedBackupsSize: number;
    isClosing: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onConfirmDelete: () => void;
    onCancel: () => void;
}

const BackupDeleteDialog: React.FC<BackupDeleteDialogProps> = ({
    settings,
    themeColors,
    action,
    selectedBackupsSize,
    isClosing,
    dialogRef,
    onConfirmDelete,
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
                aria-label="Backup delete confirmation"
                tabIndex={-1}
                style={{
                    background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                    borderRadius: 10,
                    padding: 24,
                    maxWidth: 'min(400px, 80vw)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    boxShadow: '0 2px 12px #0008',
                    border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                }}
            >
                <div
                    style={{
                        marginBottom: 18,
                        color: '#c94f4f',
                        fontWeight: 600,
                        fontSize: 17,
                        lineHeight: 1.4,
                    }}
                >
                    {action === 'single'
                        ? 'Delete backup permanently?'
                        : action === 'cloud'
                            ? 'Delete cloud backup permanently?'
                            : `Delete ${selectedBackupsSize} backup${selectedBackupsSize !== 1 ? 's' : ''} permanently?`}
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 400,
                            color: themeColors.textSecondary,
                            marginTop: 8,
                        }}
                    >
                        This action cannot be undone.
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        style={{
                            flex: 1,
                            background: '#c94f4f',
                            color: '#fff',
                            border: '1px solid #c94f4f',
                            borderRadius: 8,
                            padding: '9px 16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                        onClick={onConfirmDelete}
                    >
                        Yes, Delete
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
                            cursor: 'pointer',
                        }}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(BackupDeleteDialog);
