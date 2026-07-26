import * as React from 'react';
import type { ToastMessage } from '../app-types';

interface ToastContainerProps {
    toasts: ToastMessage[];
    accentColor: string;
    onDismiss: (id: string) => void;
    onClearAll: () => void;
}

const Toast: React.FC<{
    message: ToastMessage;
    onDismiss: (id: string) => void;
    accentColor: string;
}> = ({ message, onDismiss }) => {
    let icon = 'info';
    let iconColor = '#abccff';

    switch (message.type) {
        case 'success':
            icon = 'check_circle';
            iconColor = '#9ad1a2';
            break;
        case 'error':
            icon = 'error';
            iconColor = '#ff9d94';
            break;
        default:
            icon = 'info';
            iconColor = '#abccff';
            break;
    }

    return (
        <div
            className={`toast-message ${message.isFadingOut ? 'removing' : ''}`}
            onClick={() => onDismiss(message.id)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                    if (event.key === ' ' || event.key === 'Spacebar') {
                        event.preventDefault();
                    }
                    onDismiss(message.id);
                }
            }}
            role="button"
            tabIndex={0}
            style={{
                background: '#242424',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e5e2e1',
                padding: '10px 14px',
                borderRadius: 10,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
                cursor: 'pointer',
                width: 'min(360px, 85vw)',
                boxSizing: 'border-box',
                textAlign: 'left',
                gap: 8,
                willChange: 'transform, opacity',
            }}
        >
            <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontSize: 18, color: iconColor, flexShrink: 0 }}
            >
                {icon}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word' }}>{message.message}</span>
        </div>
    );
};

const ToastContainer: React.FC<ToastContainerProps> = ({
    toasts,
    accentColor,
    onDismiss,
    onClearAll,
}) => {
    const activeToasts = React.useMemo(() => toasts.filter((toast) => !toast.isFadingOut), [toasts]);

    if (toasts.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 9999,
            }}
        >
            {activeToasts.length > 1 && (
                <div
                    onClick={onClearAll}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                            if (event.key === ' ' || event.key === 'Spacebar') {
                                event.preventDefault();
                            }
                            onClearAll();
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    style={{
                        fontSize: 12,
                        color: '#ccc',
                        padding: '4px 8px',
                        background: 'rgba(36,36,36,0.9)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 4,
                        marginBottom: 5,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(52,52,52,0.95)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(36,36,36,0.9)')}
                >
                    Clear all notifications
                </div>
            )}
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast}
                    onDismiss={onDismiss}
                    accentColor={accentColor}
                />
            ))}
        </div>
    );
};

export default React.memo(ToastContainer);
