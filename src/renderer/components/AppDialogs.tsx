import * as React from 'react';
import type { ClipboardItem, Settings } from '../app-types';
import type { ThemeProfile } from '../../theme-config';
import BackupDeleteDialog from './dialogs/BackupDeleteDialog';
import DangerAreaDialog from './dialogs/DangerAreaDialog';
import DeleteConfirmDialog from './dialogs/DeleteConfirmDialog';
import MaxItemsWarningDialog from './dialogs/MaxItemsWarningDialog';
import RestartDialog from './dialogs/RestartDialog';
import ThemeProfileDialog from './dialogs/ThemeProfileDialog';
import UnsavedChangesDialog from './dialogs/UnsavedChangesDialog';

interface AppDialogsProps {
    settings: Settings;
    themeColors: ThemeProfile['colors'];
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
    const activeDialogRef = React.useRef<HTMLDivElement | null>(null);
    const previousFocusedElementRef = React.useRef<HTMLElement | null>(null);

    const closeActiveDialog = React.useCallback(() => {
        if (showThemeProfileDeleteConfirm) {
            onCancelThemeProfileDelete();
            return;
        }
        if (showThemeProfileResetConfirm) {
            onCancelThemeProfileReset();
            return;
        }
        if (backupDeleteAction) {
            onCancelBackupDelete();
            return;
        }
        if (showUnsavedChangesConfirm) {
            handleUnsavedCancel();
            return;
        }
        if (showRestartConfirm) {
            closeRestartDialog();
            return;
        }
        if (dangerAction) {
            closeDangerDialog();
            return;
        }
        if (deleteTarget) {
            handleDeleteDialogClose();
            return;
        }
        if (showMaxItemsWarning) {
            onCancelMaxItemsWarning();
        }
    }, [
        backupDeleteAction,
        closeDangerDialog,
        closeRestartDialog,
        dangerAction,
        deleteTarget,
        handleDeleteDialogClose,
        handleUnsavedCancel,
        onCancelBackupDelete,
        onCancelMaxItemsWarning,
        onCancelThemeProfileDelete,
        onCancelThemeProfileReset,
        showMaxItemsWarning,
        showRestartConfirm,
        showThemeProfileDeleteConfirm,
        showThemeProfileResetConfirm,
        showUnsavedChangesConfirm,
    ]);

    const isAnyDialogOpen = Boolean(
        deleteTarget ||
        dangerAction ||
        showRestartConfirm ||
        showUnsavedChangesConfirm ||
        backupDeleteAction ||
        showThemeProfileResetConfirm ||
        showThemeProfileDeleteConfirm ||
        showMaxItemsWarning,
    );

    React.useEffect(() => {
        if (!isAnyDialogOpen) {
            return;
        }

        previousFocusedElementRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const dialog = activeDialogRef.current;
        if (dialog) {
            const autofocusTarget = dialog.querySelector<HTMLElement>('[data-dialog-autofocus]');
            (autofocusTarget ?? dialog).focus();
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const dialogElement = activeDialogRef.current;
            if (!dialogElement) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                closeActiveDialog();
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusable = Array.from(
                dialogElement.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);

            if (focusable.length === 0) {
                event.preventDefault();
                dialogElement.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement as HTMLElement | null;

            if (event.shiftKey) {
                if (!active || active === first || !dialogElement.contains(active)) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (!active || active === last || !dialogElement.contains(active)) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (previousFocusedElementRef.current) {
                previousFocusedElementRef.current.focus();
            }
        };
    }, [closeActiveDialog, isAnyDialogOpen]);

    return (
        <>
            {deleteTarget && (
                <DeleteConfirmDialog
                    settings={settings}
                    deleteTarget={deleteTarget}
                    isClosing={isDeleteDialogClosing}
                    dialogRef={activeDialogRef}
                    onConfirmDelete={confirmDelete}
                    onClose={handleDeleteDialogClose}
                />
            )}

            {dangerAction && (
                <DangerAreaDialog
                    settings={settings}
                    dangerAction={dangerAction}
                    isClosing={isDangerDialogClosing}
                    dialogRef={activeDialogRef}
                    onConfirmClearAll={handleClearAll}
                    onConfirmResetSettings={resetSettings}
                    onClose={closeDangerDialog}
                />
            )}

            {showRestartConfirm && (
                <RestartDialog
                    settings={settings}
                    isClosing={isRestartDialogClosing}
                    restartReason={restartReason}
                    dialogRef={activeDialogRef}
                    onRestartNow={restartApp}
                    onRestartLater={closeRestartDialog}
                />
            )}

            {showUnsavedChangesConfirm && (
                <UnsavedChangesDialog
                    settings={settings}
                    isClosing={isUnsavedChangesDialogClosing}
                    dialogRef={activeDialogRef}
                    onSave={handleUnsavedSave}
                    onDontSave={handleUnsavedDontSave}
                    onCancel={handleUnsavedCancel}
                />
            )}

            {backupDeleteAction && (
                <BackupDeleteDialog
                    settings={settings}
                    themeColors={themeColors}
                    action={backupDeleteAction}
                    selectedBackupsSize={selectedBackupsSize}
                    isClosing={isBackupDeleteDialogClosing}
                    dialogRef={activeDialogRef}
                    onConfirmDelete={() => {
                        void onConfirmBackupDelete();
                    }}
                    onCancel={onCancelBackupDelete}
                />
            )}

            {showThemeProfileResetConfirm && (
                <ThemeProfileDialog
                    settings={settings}
                    themeColors={themeColors}
                    mode="reset"
                    isClosing={isThemeProfileResetDialogClosing}
                    dialogRef={activeDialogRef}
                    onConfirm={onConfirmThemeProfileReset}
                    onCancel={onCancelThemeProfileReset}
                />
            )}

            {showThemeProfileDeleteConfirm && (
                <ThemeProfileDialog
                    settings={settings}
                    themeColors={themeColors}
                    mode="delete"
                    activeThemeProfileName={activeThemeProfileName}
                    isClosing={isThemeProfileDeleteDialogClosing}
                    dialogRef={activeDialogRef}
                    onConfirm={() => {
                        void onConfirmThemeProfileDelete();
                    }}
                    onCancel={onCancelThemeProfileDelete}
                />
            )}

            {showMaxItemsWarning && (
                <MaxItemsWarningDialog
                    settings={settings}
                    themeColors={themeColors}
                    isClosing={isMaxItemsWarningClosing}
                    pendingMaxItems={pendingMaxItems}
                    currentMaxItems={currentMaxItems}
                    itemsLength={itemsLength}
                    backupCreated={backupCreated}
                    dialogRef={activeDialogRef}
                    onCreateBackupFirst={() => {
                        void onCreateBackupFirst();
                    }}
                    onConfirm={() => {
                        void onConfirmMaxItemsWarning();
                    }}
                    onCancel={onCancelMaxItemsWarning}
                />
            )}
        </>
    );
};

export default React.memo(AppDialogs);
