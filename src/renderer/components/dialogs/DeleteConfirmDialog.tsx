import * as React from 'react';
import type { ClipboardItem, Settings } from '../../app-types';

interface DeleteConfirmDialogProps {
    settings: Settings;
    deleteTarget: ClipboardItem;
    isClosing: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onConfirmDelete: (item: ClipboardItem) => void;
    onClose: () => void;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    settings,
    deleteTarget,
    isClosing,
    dialogRef,
    onConfirmDelete,
    onClose,
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
                zIndex: 2000,
                borderRadius: settings.borderRadius,
            }}
        >
            <div
                ref={dialogRef}
                className={`delete-confirm-dialog ${isClosing ? 'fade-out' : 'fade-in'}`}
                role="dialog"
                aria-modal="true"
                aria-label="Delete item confirmation"
                tabIndex={-1}
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
                    onClick={() => onConfirmDelete(deleteTarget)}
                >
                    Yes
                </button>
                <button
                    className="no-btn"
                    data-dialog-autofocus
                    style={{
                        background: '#ff4136',
                        color: '#fff',
                        border: '1px solid #ff4136',
                        borderRadius: 6,
                        padding: '6px 18px',
                        fontWeight: 600,
                    }}
                    onClick={onClose}
                >
                    No
                </button>
            </div>
        </div>
    );
};

export default React.memo(DeleteConfirmDialog);
