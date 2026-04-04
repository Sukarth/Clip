import * as React from 'react';
import type { ToastMessage } from '../app-types';

type ToastType = 'success' | 'error' | 'info';

export function useToastManager() {
    const toastIdCounter = React.useRef(0);
    const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
    const toastTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const removalTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const clearAllTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearAutoTimer = React.useCallback((id: string) => {
        if (toastTimersRef.current[id]) {
            clearTimeout(toastTimersRef.current[id]);
            delete toastTimersRef.current[id];
        }
    }, []);

    const clearRemovalTimer = React.useCallback((id: string) => {
        if (removalTimersRef.current[id]) {
            clearTimeout(removalTimersRef.current[id]);
            delete removalTimersRef.current[id];
        }
    }, []);

    const showToast = React.useCallback((type: ToastType, messageText: string) => {
        toastIdCounter.current += 1;
        const id = `toast-${toastIdCounter.current}`;
        const newToast: ToastMessage = { id, type, message: messageText, isFadingOut: false };
        setToasts((prev) => {
            const updated = [...prev, newToast];
            // Keep toast stack compact and readable - trim synchronously
            if (updated.length > 3) {
                const removed = updated.slice(0, updated.length - 3);
                removed.forEach((toast) => {
                    clearAutoTimer(toast.id);
                    clearRemovalTimer(toast.id);
                });
                return updated.slice(updated.length - 3);
            }
            return updated;
        });
    }, [clearAutoTimer, clearRemovalTimer]);

    const dismissToast = React.useCallback((id: string) => {
        setToasts((prevToasts) =>
            prevToasts.map((toast) =>
                toast.id === id ? { ...toast, isFadingOut: true } : toast,
            ),
        );

        clearAutoTimer(id);
        clearRemovalTimer(id);

        removalTimersRef.current[id] = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            clearRemovalTimer(id);
        }, 300);
    }, [clearAutoTimer, clearRemovalTimer]);

    React.useEffect(() => {
        const newTimers: Record<string, ReturnType<typeof setTimeout>> = { ...toastTimersRef.current };

        toasts.forEach((toast) => {
            if (!toast.isFadingOut && !newTimers[toast.id]) {
                newTimers[toast.id] = setTimeout(() => {
                    dismissToast(toast.id);
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
    }, [toasts, dismissToast]);

    React.useEffect(() => {
        return () => {
            Object.values(toastTimersRef.current).forEach(clearTimeout);
            toastTimersRef.current = {};
            Object.values(removalTimersRef.current).forEach(clearTimeout);
            removalTimersRef.current = {};
            if (clearAllTimerRef.current) {
                clearTimeout(clearAllTimerRef.current);
                clearAllTimerRef.current = null;
            }
        };
    }, []);

    const clearAllToasts = React.useCallback(() => {
        const toastIdsToRemove = toasts.map((toast) => toast.id);
        if (toastIdsToRemove.length === 0) {
            return;
        }

        const idsSnapshot = new Set(toastIdsToRemove);

        setToasts((prevToasts) =>
            prevToasts.map((toast) =>
                idsSnapshot.has(toast.id) ? { ...toast, isFadingOut: true } : toast,
            ),
        );

        Object.values(toastTimersRef.current).forEach(clearTimeout);
        toastTimersRef.current = {};

        toastIdsToRemove.forEach((id) => {
            clearAutoTimer(id);
            clearRemovalTimer(id);
        });

        if (clearAllTimerRef.current) {
            clearTimeout(clearAllTimerRef.current);
        }

        clearAllTimerRef.current = setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => !idsSnapshot.has(toast.id)));
            toastIdsToRemove.forEach((id) => clearRemovalTimer(id));
            clearAllTimerRef.current = null;
        }, 300);
    }, [clearAutoTimer, clearRemovalTimer, toasts]);

    return {
        toasts,
        showToast,
        dismissToast,
        clearAllToasts,
    };
}
