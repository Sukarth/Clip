import * as React from 'react';
import type { Settings } from '../../app-types';

interface FirstRunDialogProps {
    settings: Settings;
    busy: boolean;
    onSignIn: () => void;
    onContinueOffline: () => void;
}

// One-time welcome shown on first launch: offer sync sign-in or stay offline.
// Dismissing (either choice) marks it seen so it never nags again.
const FirstRunDialog: React.FC<FirstRunDialogProps> = ({
    settings,
    busy,
    onSignIn,
    onContinueOffline,
}) => {
    const dark = settings.theme !== 'light';
    return (
        <div
            className="fade-in"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2100,
                borderRadius: settings.borderRadius,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Welcome to Clip"
                className="fade-in"
                style={{
                    background: dark ? '#222' : '#f0f0f0',
                    borderRadius: 12,
                    padding: 24,
                    maxWidth: 'min(380px, 80vw)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    boxShadow: '0 8px 28px #0009',
                    border: `1px solid ${dark ? '#444' : '#ccc'}`,
                }}
            >
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                    Welcome to Clip
                </div>
                <div
                    style={{
                        fontSize: 13.5,
                        opacity: 0.82,
                        marginBottom: 20,
                        lineHeight: 1.55,
                    }}
                >
                    Your clipboard history is saved locally and works fully offline.
                    Sign in to sync it across your devices with end-to-end encryption,
                    or keep it local for now.
                </div>
                <button
                    onClick={onSignIn}
                    disabled={busy}
                    style={{
                        display: 'block',
                        width: '100%',
                        background: settings.accentColor,
                        color: '#06131f',
                        border: 0,
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontWeight: 600,
                        marginBottom: 10,
                        cursor: busy ? 'default' : 'pointer',
                        opacity: busy ? 0.7 : 1,
                    }}
                >
                    {busy ? 'Opening browser…' : 'Sign in for sync'}
                </button>
                <button
                    data-dialog-autofocus
                    onClick={onContinueOffline}
                    style={{
                        display: 'block',
                        width: '100%',
                        background: 'transparent',
                        color: dark ? '#ccc' : '#333',
                        border: `1px solid ${dark ? '#444' : '#ccc'}`,
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Continue offline
                </button>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 14 }}>
                    You can sign in anytime from Settings → Profile.
                </div>
            </div>
        </div>
    );
};

export default React.memo(FirstRunDialog);
