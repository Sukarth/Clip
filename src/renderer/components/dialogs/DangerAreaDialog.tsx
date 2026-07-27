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
    /** When true, clearing also propagates to the user's other synced devices. */
    syncClearsAllDevices?: boolean;
}

const DangerAreaDialog: React.FC<DangerAreaDialogProps> = ({
    settings,
    dangerAction,
    isClosing,
    dialogRef,
    onConfirmClearAll,
    onConfirmResetSettings,
    onClose,
    syncClearsAllDevices,
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
                    maxWidth: 'min(300px, 80vw)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    boxShadow: '0 2px 12px #0008',
                    border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                }}
            >
                <div
                    style={{
                        marginBottom: 18,
                        color: dangerAction === 'clear'
                            ? '#c94f4f'
                            : settings.theme === 'light' ? '#8a6d00' : '#ffb300',
                        fontWeight: 600,
                        fontSize: 17,
                    }}
                >
                    {dangerAction === 'clear' ? (
                        <>
                            Clear ALL clipboard history? This action cannot be undone.
                            {syncClearsAllDevices && (
                                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 10, color: settings.theme === 'light' ? '#8a6d00' : '#ffb300' }}>
                                    Cloud sync is on, so this also clears your synced clipboard
                                    history on every device you&apos;re signed in to.
                                </div>
                            )}
                        </>
                    ) : (
                        'Reset ALL settings to default?'
                    )}
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
                        onClick={dangerAction === 'clear' ? onConfirmClearAll : onConfirmResetSettings}
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

export default React.memo(DangerAreaDialog);
