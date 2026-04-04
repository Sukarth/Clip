import * as React from 'react';
import type { Settings } from '../../app-types';
import type { ThemeProfile } from '../../../theme-config';

interface MaxItemsWarningDialogProps {
    settings: Settings;
    themeColors: ThemeProfile['colors'];
    isClosing: boolean;
    pendingMaxItems: number | null;
    currentMaxItems: number;
    itemsLength: number;
    backupCreated: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onCreateBackupFirst: () => void;
    onConfirm: () => void;
    onCancel: () => void;
}

const MaxItemsWarningDialog: React.FC<MaxItemsWarningDialogProps> = ({
    settings,
    themeColors,
    isClosing,
    pendingMaxItems,
    currentMaxItems,
    itemsLength,
    backupCreated,
    dialogRef,
    onCreateBackupFirst,
    onConfirm,
    onCancel,
}) => {
    const isReducingMaxItems = pendingMaxItems !== null && pendingMaxItems < currentMaxItems;
    const itemsToDelete = pendingMaxItems !== null ? Math.max(0, itemsLength - pendingMaxItems) : 0;

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
                zIndex: 2300,
                borderRadius: settings.borderRadius,
            }}
        >
            <div
                ref={dialogRef}
                className={`${isClosing ? 'fade-out' : 'fade-in'}`}
                role="dialog"
                aria-modal="true"
                aria-label="Max items warning"
                tabIndex={-1}
                style={{
                    background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                    borderRadius: 10,
                    padding: 24,
                    minWidth: 320,
                    maxWidth: 450,
                    textAlign: 'center',
                    boxShadow: '0 2px 12px #0008',
                    border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                }}
            >
                <div
                    style={{
                        marginBottom: 18,
                        color: isReducingMaxItems ? themeColors.danger : themeColors.warning,
                        fontWeight: 600,
                        fontSize: 17,
                        lineHeight: 1.4,
                    }}
                >
                    {isReducingMaxItems ? 'Data Loss Warning' : 'Performance Warning'}
                </div>
                <div
                    style={{
                        fontSize: 14,
                        color: themeColors.textSecondary,
                        marginBottom: 18,
                        lineHeight: 1.5,
                    }}
                >
                    {isReducingMaxItems ? (
                        <>
                            You're decreasing the max items from <strong>{currentMaxItems}</strong> to{' '}
                            <strong>{pendingMaxItems}</strong>.
                            <br />
                            <br />
                            <span style={{ color: themeColors.danger, fontWeight: 600 }}>
                                ⚠️ This will immediately delete {itemsToDelete} clipboard items from the oldest entries.
                            </span>
                            <br />
                            <br />
                            <strong>This action is irreversible.</strong> Consider creating a backup first if you might
                            want to restore these items later.
                        </>
                    ) : (
                        <>
                            You're setting the max items to <strong>{pendingMaxItems}</strong>, which is significantly
                            higher than your current {itemsLength} items.
                            <br />
                            <br />
                            Large clipboard histories may impact performance. Are you sure you want to continue?
                        </>
                    )}
                </div>
                {isReducingMaxItems && !backupCreated && (
                    <button
                        style={{
                            background: themeColors.success,
                            color: '#fff',
                            border: `1px solid ${themeColors.success}`,
                            borderRadius: 6,
                            padding: '6px 16px',
                            marginBottom: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                            fontSize: 13,
                        }}
                        onClick={onCreateBackupFirst}
                    >
                        📦 Create Backup First
                    </button>
                )}
                <button
                    style={{
                        background: themeColors.success,
                        color: '#222',
                        border: `1px solid ${themeColors.success}`,
                        borderRadius: 6,
                        padding: '8px 18px',
                        marginRight: 10,
                        marginBottom: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                    onClick={onConfirm}
                >
                    {isReducingMaxItems
                        ? backupCreated
                            ? 'Continue'
                            : 'Continue Anyway (not recommended)'
                        : 'Yes, Continue'}
                </button>
                <button
                    data-dialog-autofocus
                    style={{
                        background: '#222',
                        color: '#fff',
                        border: '1px solid #444',
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

export default React.memo(MaxItemsWarningDialog);
