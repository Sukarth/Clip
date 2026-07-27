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
                    maxWidth: 'min(340px, 80vw)',
                    boxSizing: 'border-box',
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
                        onClick={() => onConfirmDelete(deleteTarget)}
                    >
                        Yes
                    </button>
                    <button
                        className="no-btn"
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
                        onClick={onClose}
                    >
                        No
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(DeleteConfirmDialog);
