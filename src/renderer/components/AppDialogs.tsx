import * as React from 'react';
import type { ClipboardItem, Settings } from '../app-types';

interface AppDialogsProps {
    settings: Settings;
    themeColors: {
        border: string;
        panelBackground: string;
        warning: string;
        danger: string;
        textSecondary: string;
        textPrimary: string;
        success: string;
    };
    itemsLength: number;

    deleteTarget: ClipboardItem | null;
    isDeleteDialogClosing: boolean;
    confirmDelete: (item: ClipboardItem) => void;
    handleDeleteDialogClose: () => void;

    dangerAction: 'clear' | 'reset' | null;
    isDangerDialogClosing: boolean;
    handleClearAll: () => void;
    resetSettings: () => void;
    closeDangerDialog: () => void;

    showRestartConfirm: boolean;
    isRestartDialogClosing: boolean;
    restartReason: 'import' | 'restore' | null;
    closeRestartDialog: () => void;
    restartApp: () => void;

    showUnsavedChangesConfirm: 'cancel' | 'quit' | null;
    isUnsavedChangesDialogClosing: boolean;
    handleUnsavedSave: () => void;
    handleUnsavedDontSave: () => void;
    handleUnsavedCancel: () => void;

    backupDeleteAction: 'single' | 'multiple' | null;
    isBackupDeleteDialogClosing: boolean;
    selectedBackupsSize: number;
    onConfirmBackupDelete: () => void | Promise<void>;
    onCancelBackupDelete: () => void;

    showThemeProfileResetConfirm: boolean;
    isThemeProfileResetDialogClosing: boolean;
    onConfirmThemeProfileReset: () => void;
    onCancelThemeProfileReset: () => void;

    showThemeProfileDeleteConfirm: boolean;
    isThemeProfileDeleteDialogClosing: boolean;
    activeThemeProfileName: string;
    onConfirmThemeProfileDelete: () => void | Promise<void>;
    onCancelThemeProfileDelete: () => void;

    showMaxItemsWarning: boolean;
    isMaxItemsWarningClosing: boolean;
    pendingMaxItems: number | null;
    currentMaxItems: number;
    backupCreated: boolean;
    onCreateBackupFirst: () => void | Promise<void>;
    onConfirmMaxItemsWarning: () => void | Promise<void>;
    onCancelMaxItemsWarning: () => void;
}

const AppDialogs: React.FC<AppDialogsProps> = ({
    settings,
    themeColors,
    itemsLength,
    deleteTarget,
    isDeleteDialogClosing,
    confirmDelete,
    handleDeleteDialogClose,
    dangerAction,
    isDangerDialogClosing,
    handleClearAll,
    resetSettings,
    closeDangerDialog,
    showRestartConfirm,
    isRestartDialogClosing,
    restartReason,
    closeRestartDialog,
    restartApp,
    showUnsavedChangesConfirm,
    isUnsavedChangesDialogClosing,
    handleUnsavedSave,
    handleUnsavedDontSave,
    handleUnsavedCancel,
    backupDeleteAction,
    isBackupDeleteDialogClosing,
    selectedBackupsSize,
    onConfirmBackupDelete,
    onCancelBackupDelete,
    showThemeProfileResetConfirm,
    isThemeProfileResetDialogClosing,
    onConfirmThemeProfileReset,
    onCancelThemeProfileReset,
    showThemeProfileDeleteConfirm,
    isThemeProfileDeleteDialogClosing,
    activeThemeProfileName,
    onConfirmThemeProfileDelete,
    onCancelThemeProfileDelete,
    showMaxItemsWarning,
    isMaxItemsWarningClosing,
    pendingMaxItems,
    currentMaxItems,
    backupCreated,
    onCreateBackupFirst,
    onConfirmMaxItemsWarning,
    onCancelMaxItemsWarning,
}) => {
    const isReducingMaxItems = pendingMaxItems !== null && pendingMaxItems < currentMaxItems;
    const itemsToDelete = pendingMaxItems !== null ? Math.max(0, itemsLength - pendingMaxItems) : 0;

    return (
        <>
            {deleteTarget && (
                <div
                    className={`fade-opacity-${isDeleteDialogClosing ? 'out' : 'in'}`}
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
                        zIndex: 2000,
                        borderRadius: settings.borderRadius,
                    }}
                >
                    <div
                        className={`delete-confirm-dialog ${isDeleteDialogClosing ? 'fade-out' : 'fade-in'}`}
                        style={{
                            background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                            borderRadius: 10,
                            padding: 24,
                            minWidth: 220,
                            textAlign: 'center',
                            boxShadow: '0 2px 12px #0008',
                            border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                        }}
                    >
                        <div
                            style={{
                                marginBottom: 18,
                                color: settings.theme === 'light' ? '#333' : '#fff',
                                fontWeight: 500,
                            }}
                        >
                            Delete this item?
                        </div>
                        <button
                            style={{
                                background: settings.accentColor,
                                color: '#fff',
                                border: `1px solid ${settings.accentColor}`,
                                borderRadius: 6,
                                padding: '6px 18px',
                                marginRight: 10,
                                fontWeight: 600,
                            }}
                            onClick={() => confirmDelete(deleteTarget)}
                        >
                            Yes
                        </button>
                        <button
                            className="no-btn"
                            style={{
                                background: '#ff4136',
                                color: '#fff !important',
                                border: '1px solid #ff4136',
                                borderRadius: 6,
                                padding: '6px 18px',
                                fontWeight: 600,
                            }}
                            onClick={handleDeleteDialogClose}
                        >
                            No
                        </button>
                    </div>
                </div>
            )}

            {dangerAction && (
                <div
                    className={`fade-opacity-${isDangerDialogClosing ? 'out' : 'in'}`}
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
                        zIndex: 2000,
                        borderRadius: settings.borderRadius,
                    }}
                >
                    <div
                        className={`delete-confirm-dialog ${isDangerDialogClosing ? 'fade-out' : 'fade-in'}`}
                        style={{
                            background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                            borderRadius: 10,
                            padding: 24,
                            minWidth: 280,
                            maxWidth: 280,
                            textAlign: 'center',
                            boxShadow: '0 2px 12px #0008',
                            border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                        }}
                    >
                        <div
                            style={{
                                marginBottom: 18,
                                color: dangerAction === 'clear' ? '#ff4136' : '#ffb300',
                                fontWeight: 600,
                                fontSize: 17,
                            }}
                        >
                            {dangerAction === 'clear'
                                ? 'Clear ALL clipboard history? This action cannot be undone.'
                                : 'Reset ALL settings to default?'}
                        </div>
                        <button
                            style={{
                                background: dangerAction === 'clear' ? '#ff4136' : '#ffb300',
                                color: '#222',
                                border: `1px solid ${dangerAction === 'clear' ? '#ff4136' : '#ffb300'}`,
                                borderRadius: 6,
                                padding: '6px 18px',
                                marginRight: 10,
                                fontWeight: 600,
                            }}
                            onClick={dangerAction === 'clear' ? handleClearAll : resetSettings}
                        >
                            Yes
                        </button>
                        <button
                            className="no-btn"
                            style={{
                                background: '#222',
                                color: dangerAction === 'clear' ? '#ff4136' : '#ffb300',
                                border: `1px solid ${dangerAction === 'clear' ? '#ff4136' : '#ffb300'}`,
                                borderRadius: 6,
                                padding: '6px 18px',
                                fontWeight: 600,
                            }}
                            onClick={closeDangerDialog}
                        >
                            No
                        </button>
                    </div>
                </div>
            )}

            {showRestartConfirm && (
                <div
                    className={`fade-opacity-${isRestartDialogClosing ? 'out' : 'in'}`}
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
                        zIndex: 2000,
                        borderRadius: settings.borderRadius,
                    }}
                >
                    <div
                        className={`${isRestartDialogClosing ? 'fade-out' : 'fade-in'}`}
                        style={{
                            background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                            borderRadius: 10,
                            padding: 24,
                            minWidth: 280,
                            maxWidth: 350,
                            textAlign: 'center',
                            boxShadow: '0 2px 12px #0008',
                            border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                        }}
                    >
                        <div style={{ marginBottom: 18, fontWeight: 600, fontSize: 17 }}>
                            {restartReason === 'import'
                                ? 'Database imported successfully! Do you want to restart the app now?'
                                : restartReason === 'restore'
                                ? 'Backup restored successfully! Do you want to restart the app now?'
                                : 'Operation successful! Do you want to restart the app now?'}
                        </div>
                        <button
                            style={{
                                background: settings.accentColor,
                                color: '#222',
                                border: `1px solid ${settings.accentColor}`,
                                borderRadius: 6,
                                padding: '6px 18px',
                                marginRight: 10,
                                fontWeight: 600,
                            }}
                            onClick={restartApp}
                        >
                            Yes, Restart Now
                        </button>
                        <button
                            style={{
                                background: '#222',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: 6,
                                padding: '6px 18px',
                                fontWeight: 600,
                            }}
                            onClick={closeRestartDialog}
                        >
                            Later
                        </button>
                    </div>
                </div>
            )}

            {showUnsavedChangesConfirm && (
                <div
                    className={`fade-opacity-${isUnsavedChangesDialogClosing ? 'out' : 'in'}`}
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
                        zIndex: 2100,
                        borderRadius: settings.borderRadius,
                    }}
                >
                    <div
                        className={`${isUnsavedChangesDialogClosing ? 'fade-out' : 'fade-in'}`}
                        style={{
                            background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                            borderRadius: 10,
                            padding: 24,
                            minWidth: 280,
                            maxWidth: 350,
                            textAlign: 'center',
                            boxShadow: '0 2px 12px #0008',
                            border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                        }}
                    >
                        <div style={{ marginBottom: 18, fontWeight: 600, fontSize: 17 }}>
                            You have unsaved changes. Do you want to save them?
                        </div>
                        <button
                            style={{
                                background: settings.accentColor,
                                color: '#222',
                                border: `1px solid ${settings.accentColor}`,
                                borderRadius: 6,
                                padding: '6px 18px',
                                marginRight: 10,
                                fontWeight: 600,
                            }}
                            onClick={handleUnsavedSave}
                        >
                            Save
                        </button>
                        <button
                            style={{
                                background: '#ff4136',
                                color: '#fff',
                                border: '1px solid #ff4136',
                                borderRadius: 6,
                                padding: '6px 18px',
                                marginRight: 10,
                                fontWeight: 600,
                            }}
                            onClick={handleUnsavedDontSave}
                        >
                            Don't Save
                        </button>
                        <button
                            style={{
                                background: '#222',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: 6,
                                padding: '6px 18px',
                                fontWeight: 600,
                            }}
                            onClick={handleUnsavedCancel}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {backupDeleteAction && (
                <div
                    className={`fade-opacity-${isBackupDeleteDialogClosing ? 'out' : 'in'}`}
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
                        className={`${isBackupDeleteDialogClosing ? 'fade-out' : 'fade-in'}`}
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
                            {backupDeleteAction === 'single'
                                ? 'Delete backup permanently?'
                                : `Delete ${selectedBackupsSize} backup${selectedBackupsSize !== 1 ? 's' : ''} permanently?`}
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 400,
                                    color: '#ccc',
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
                            onClick={() => {
                                void onConfirmBackupDelete();
                            }}
                        >
                            Yes, Delete
                        </button>
                        <button
                            style={{
                                background: '#222',
                                color: '#fff',
                                border: `1px solid ${themeColors.border}`,
                                borderRadius: 6,
                                padding: '8px 18px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                            onClick={onCancelBackupDelete}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showThemeProfileResetConfirm && (
                <div
                    className={`fade-opacity-${isThemeProfileResetDialogClosing ? 'out' : 'in'}`}
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
                        zIndex: 2350,
                        borderRadius: settings.borderRadius,
                    }}
                >
                    <div
                        className={`${isThemeProfileResetDialogClosing ? 'fade-out' : 'fade-in'}`}
                        style={{
                            background: themeColors.panelBackground,
                            borderRadius: 10,
                            padding: 24,
                            minWidth: 340,
                            maxWidth: 460,
                            textAlign: 'center',
                            boxShadow: '0 2px 12px #0008',
                            border: `1px solid ${themeColors.border}`,
                        }}
                    >
                        <div
                            style={{
                                marginBottom: 18,
                                color: themeColors.warning,
                                fontWeight: 700,
                                fontSize: 17,
                                lineHeight: 1.4,
                            }}
                        >
                            Reset this profile's theme to default?
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                color: themeColors.textSecondary,
                                marginBottom: 18,
                                lineHeight: 1.55,
                                textAlign: 'left',
                            }}
                        >
                            This will overwrite the selected profile's colors, typography, surface settings, and icons with
                            Clip's default theme values.
                            <br />
                            <br />
                            The profile name will stay the same.
                            <br />
                            <br />
                            <strong style={{ color: themeColors.danger }}>This cannot be undone.</strong>
                        </div>
                        <button
                            style={{
                                background: themeColors.warning,
                                color: '#222',
                                border: `1px solid ${themeColors.warning}`,
                                borderRadius: 6,
                                padding: '8px 18px',
                                marginRight: 10,
                                marginBottom: 8,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                            onClick={onConfirmThemeProfileReset}
                        >
                            Yes, Reset Profile
                        </button>
                        <button
                            style={{
                                background: '#222',
                                color: '#fff',
                                border: `1px solid ${themeColors.border}`,
                                borderRadius: 6,
                                padding: '8px 18px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                            onClick={onCancelThemeProfileReset}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showThemeProfileDeleteConfirm && (
                <div
                    className={`fade-opacity-${isThemeProfileDeleteDialogClosing ? 'out' : 'in'}`}
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
                        zIndex: 2351,
                        borderRadius: settings.borderRadius,
                    }}
                >
                    <div
                        className={`${isThemeProfileDeleteDialogClosing ? 'fade-out' : 'fade-in'}`}
                        style={{
                            background: themeColors.panelBackground,
                            borderRadius: 10,
                            padding: 24,
                            minWidth: 340,
                            maxWidth: 460,
                            textAlign: 'center',
                            boxShadow: '0 2px 12px #0008',
                            border: `1px solid ${themeColors.border}`,
                        }}
                    >
                        <div
                            style={{
                                marginBottom: 18,
                                color: themeColors.danger,
                                fontWeight: 700,
                                fontSize: 17,
                                lineHeight: 1.4,
                            }}
                        >
                            Delete this theme profile?
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                color: themeColors.textSecondary,
                                marginBottom: 18,
                                lineHeight: 1.55,
                                textAlign: 'left',
                            }}
                        >
                            This will permanently delete the active profile{' '}
                            <strong style={{ color: themeColors.textPrimary }}>{activeThemeProfileName}</strong>.
                            <br />
                            <br />
                            If you delete the current profile, Clip will switch to another available profile.
                            <br />
                            <br />
                            <strong style={{ color: themeColors.danger }}>This cannot be undone.</strong>
                        </div>
                        <button
                            style={{
                                background: themeColors.danger,
                                color: '#fff',
                                border: `1px solid ${themeColors.danger}`,
                                borderRadius: 6,
                                padding: '8px 18px',
                                marginRight: 10,
                                marginBottom: 8,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                            onClick={() => {
                                void onConfirmThemeProfileDelete();
                            }}
                        >
                            Yes, Delete Profile
                        </button>
                        <button
                            style={{
                                background: '#222',
                                color: '#fff',
                                border: `1px solid ${themeColors.border}`,
                                borderRadius: 6,
                                padding: '8px 18px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                            onClick={onCancelThemeProfileDelete}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showMaxItemsWarning && (
                <div
                    className={`fade-opacity-${isMaxItemsWarningClosing ? 'out' : 'in'}`}
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
                        className={`${isMaxItemsWarningClosing ? 'fade-out' : 'fade-in'}`}
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
                                onClick={() => {
                                    void onCreateBackupFirst();
                                }}
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
                            onClick={() => {
                                void onConfirmMaxItemsWarning();
                            }}
                        >
                            {isReducingMaxItems
                                ? backupCreated
                                    ? 'Continue'
                                    : 'Continue Anyway (not recommended)'
                                : 'Yes, Continue'}
                        </button>
                        <button
                            style={{
                                background: '#222',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: 6,
                                padding: '8px 18px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                            onClick={onCancelMaxItemsWarning}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default React.memo(AppDialogs);
