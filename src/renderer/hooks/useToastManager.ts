import * as React from 'react';
import type { ToastMessage } from '../app-types';

type ToastType = 'success' | 'error' | 'info';

export function useToastManager() {
    const toastIdCounter = React.useRef(0);
    const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
    const toastTimersRef = React.useRef<Record<string, NodeJS.Timeout>>({});

    const showToast = React.useCallback((type: ToastType, messageText: string) => {
        toastIdCounter.current += 1;
        const id = `toast-${toastIdCounter.current}`;
        const newToast: ToastMessage = { id, type, message: messageText, isFadingOut: false };
        setToasts((prev) => [...prev, newToast]);

        // Keep toast stack compact and readable.
        setTimeout(() => {
            setToasts((currentToasts) => {
                if (currentToasts.length > 3) {
                    return currentToasts.slice(currentToasts.length - 3);
                }
                return currentToasts;
            });
        }, 100);
    }, []);

    const dismissToast = React.useCallback((id: string, _type: 'manual' | 'auto') => {
        setToasts((prevToasts) =>
            prevToasts.map((toast) =>
                toast.id === id ? { ...toast, isFadingOut: true } : toast,
            ),
        );

        if (toastTimersRef.current[id]) {
            clearTimeout(toastTimersRef.current[id]);
            delete toastTimersRef.current[id];
        }

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
    }, []);

    React.useEffect(() => {
        const newTimers: Record<string, NodeJS.Timeout> = { ...toastTimersRef.current };

        toasts.forEach((toast) => {
            if (!toast.isFadingOut && !newTimers[toast.id]) {
                newTimers[toast.id] = setTimeout(() => {
                    dismissToast(toast.id, 'auto');
                }, 3000);
            } else if (toast.isFadingOut && newTimers[toast.id]) {
                clearTimeout(newTimers[toast.id]);
                delete newTimers[toast.id];
            }
        });

        Object.keys(newTimers).forEach((toastId) => {
            if (!toasts.some((t) => t.id === toastId)) {
                clearTimeout(newTimers[toastId]);
                delete newTimers[toastId];
            }
        });

        toastTimersRef.current = newTimers;

        return () => {
            Object.values(toastTimersRef.current).forEach(clearTimeout);
            toastTimersRef.current = {};
        };
    }, [toasts, dismissToast]);

    const clearAllToasts = React.useCallback(() => {
        setToasts((prevToasts) =>
            prevToasts.map((toast) => ({ ...toast, isFadingOut: true })),
        );

        Object.values(toastTimersRef.current).forEach(clearTimeout);
        toastTimersRef.current = {};

        setTimeout(() => {
            setToasts([]);
        }, 300);
    }, []);

    return {
        toasts,
        showToast,
        dismissToast,
        clearAllToasts,
    };
}
