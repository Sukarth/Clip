import * as React from 'react';
import type { Settings } from '../../app-types';

interface RestartDialogProps {
    settings: Settings;
    isClosing: boolean;
    restartReason: 'import' | 'restore' | null;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onRestartNow: () => void;
    onRestartLater: () => void;
}

const RestartDialog: React.FC<RestartDialogProps> = ({
    settings,
    isClosing,
    restartReason,
    dialogRef,
    onRestartNow,
    onRestartLater,
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
                className={`${isClosing ? 'fade-out' : 'fade-in'}`}
                role="dialog"
                aria-modal="true"
                aria-label="Restart confirmation"
                tabIndex={-1}
                style={{
                    background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                    borderRadius: 10,
                    padding: 24,
                    maxWidth: 'min(350px, 80vw)',
                    boxSizing: 'border-box',
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
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        style={{
                            flex: 1,
                            background: settings.accentColor,
                            color: '#06131f',
                            border: `1px solid ${settings.accentColor}`,
                            borderRadius: 8,
                            padding: '9px 16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                        onClick={onRestartNow}
                    >
                        Yes, Restart Now
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
                        onClick={onRestartLater}
                    >
                        Later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(RestartDialog);
