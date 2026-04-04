import * as React from 'react';
import type { Settings } from '../../app-types';
import type { ThemeProfile } from '../../../theme-config';

interface BackupDeleteDialogProps {
    settings: Settings;
    themeColors: ThemeProfile['colors'];
    action: 'single' | 'multiple';
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
                    minWidth: 280,
                    maxWidth: 400,
                    textAlign: 'center',
                    boxShadow: '0 2px 12px #0008',
                    border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                }}
            >
                <div
                    style={{
                        marginBottom: 18,
                        color: '#ff4136',
                        fontWeight: 600,
                        fontSize: 17,
                        lineHeight: 1.4,
                    }}
                >
                    {action === 'single'
                        ? 'Delete backup permanently?'
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
                <button
                    style={{
                        background: '#ff4136',
                        color: '#fff',
                        border: '1px solid #ff4136',
                        borderRadius: 6,
                        padding: '8px 18px',
                        marginRight: 10,
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
                        background: '#222',
                        color: '#fff',
                        border: `1px solid ${themeColors.border}`,
                        borderRadius: 6,
                        padding: '8px 18px',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default React.memo(BackupDeleteDialog);
