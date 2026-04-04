import * as React from 'react';
import type { Settings } from '../../app-types';

interface UnsavedChangesDialogProps {
    settings: Settings;
    isClosing: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onSave: () => void;
    onDontSave: () => void;
    onCancel: () => void;
}

const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
    settings,
    isClosing,
    dialogRef,
    onSave,
    onDontSave,
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
                zIndex: 2100,
                borderRadius: settings.borderRadius,
            }}
        >
            <div
                ref={dialogRef}
                className={`${isClosing ? 'fade-out' : 'fade-in'}`}
                role="dialog"
                aria-modal="true"
                aria-label="Unsaved changes confirmation"
                tabIndex={-1}
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
                    onClick={onSave}
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
                    onClick={onDontSave}
                >
                    Don't Save
                </button>
                <button
                    data-dialog-autofocus
                    style={{
                        background: '#222',
                        color: '#fff',
                        border: '1px solid #444',
                        borderRadius: 6,
                        padding: '6px 18px',
                        fontWeight: 600,
                    }}
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default React.memo(UnsavedChangesDialog);
