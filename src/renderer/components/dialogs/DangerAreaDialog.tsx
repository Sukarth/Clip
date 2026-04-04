import * as React from 'react';
import type { Settings } from '../../app-types';

interface DangerAreaDialogProps {
    settings: Settings;
    dangerAction: 'clear' | 'reset';
    isClosing: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onConfirmClearAll: () => void;
    onConfirmResetSettings: () => void;
    onClose: () => void;
}

const DangerAreaDialog: React.FC<DangerAreaDialogProps> = ({
    settings,
    dangerAction,
    isClosing,
    dialogRef,
    onConfirmClearAll,
    onConfirmResetSettings,
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
                aria-label="Danger action confirmation"
                tabIndex={-1}
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
                    onClick={dangerAction === 'clear' ? onConfirmClearAll : onConfirmResetSettings}
                >
                    Yes
                </button>
                <button
                    className="no-btn"
                    data-dialog-autofocus
                    style={{
                        background: '#222',
                        color: dangerAction === 'clear' ? '#ff4136' : '#ffb300',
                        border: `1px solid ${dangerAction === 'clear' ? '#ff4136' : '#ffb300'}`,
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

export default React.memo(DangerAreaDialog);
