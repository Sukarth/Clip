import * as React from 'react';

interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    isFadingOut?: boolean;
}

interface ToastContainerProps {
    toasts: ToastMessage[];
    accentColor: string;
    onDismiss: (id: string, type: 'manual' | 'auto') => void;
    onClearAll: () => void;
}

const Toast: React.FC<{
    message: ToastMessage;
    onDismiss: (id: string, type: 'manual' | 'auto') => void;
    accentColor: string;
}> = ({ message, onDismiss, accentColor }) => {
    let bgColor = '';
    let icon = '💬';

    switch (message.type) {
        case 'success':
            bgColor = accentColor;
            icon = '✅';
            break;
        case 'error':
            bgColor = '#ff4136';
            icon = '❌';
            break;
        default:
            bgColor = '#0074D9';
            icon = 'ℹ️';
            break;
    }

    return (
        <div
            className={`toast-message ${message.isFadingOut ? 'removing' : ''}`}
            onClick={() => onDismiss(message.id, 'manual')}
            style={{
                background: bgColor,
                color: '#fff',
                padding: '10px 16px',
                borderRadius: 8,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                maxWidth: '90%',
                gap: 8,
                willChange: 'transform, opacity',
            }}
        >
            <span style={{ fontSize: 18, marginRight: 4 }}>{icon}</span>
            <span>{message.message}</span>
        </div>
    );
};

const ToastContainer: React.FC<ToastContainerProps> = ({
    toasts,
    accentColor,
    onDismiss,
    onClearAll,
}) => {
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
            {toasts.length > 1 && (
                <div
                    onClick={onClearAll}
                    style={{
                        fontSize: 12,
                        color: '#ccc',
                        padding: '4px 8px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 4,
                        marginBottom: 5,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
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
