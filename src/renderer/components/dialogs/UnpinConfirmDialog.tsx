import * as React from 'react';
import type { Settings } from '../../app-types';
import type { ThemeProfile } from '../../../theme-config';

interface UnpinConfirmDialogProps {
    settings: Settings;
    themeColors: ThemeProfile['colors'];
    count: number;
    isClosing: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onConfirm: () => void;
    onCancel: () => void;
}

const UnpinConfirmDialog: React.FC<UnpinConfirmDialogProps> = ({
    settings,
    themeColors,
    count,
    isClosing,
    dialogRef,
    onConfirm,
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
                aria-label="Turn off pinning confirmation"
                tabIndex={-1}
                style={{
                    background: settings.theme === 'light' ? '#f0f0f0' : '#222',
                    borderRadius: 10,
                    padding: 24,
                    maxWidth: 'min(400px, 80vw)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    boxShadow: '0 2px 12px #0008',
                    border: `1px solid ${settings.theme === 'light' ? '#ccc' : '#444'}`,
                }}
            >
                <div
                    style={{
                        marginBottom: 18,
                        fontWeight: 600,
                        fontSize: 17,
                        lineHeight: 1.4,
                    }}
                >
                    Turn off pinning?
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 400,
                            color: themeColors.textSecondary,
                            marginTop: 8,
                        }}
                    >
                        This will unpin your {count} pinned item{count !== 1 ? 's' : ''}. The items stay in your
                        history but will no longer be kept at the top.
                    </div>
                </div>
                <button
                    style={{
                        background: '#c94f4f',
                        color: '#fff',
                        border: '1px solid #c94f4f',
                        borderRadius: 8,
                        padding: '8px 18px',
                        marginRight: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                    onClick={onConfirm}
                >
                    Unpin and turn off
                </button>
                <button
                    data-dialog-autofocus
                    style={{
                        background: '#2a2a2a',
                        color: '#fff',
                        border: '1px solid #444',
                        borderRadius: 8,
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

export default React.memo(UnpinConfirmDialog);
