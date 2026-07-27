import * as React from 'react';
import type { Settings } from '../../app-types';

interface SyncPassphraseDialogProps {
    settings: Settings;
    mode: 'enter' | 'reset';
    busy: boolean;
    error: string | null;
    onSubmit: (passphrase: string) => void;
    onForgot: () => void;
    onCancel: () => void;
}

const SyncPassphraseDialog: React.FC<SyncPassphraseDialogProps> = ({
    settings,
    mode,
    busy,
    error,
    onSubmit,
    onForgot,
    onCancel,
}) => {
    const dark = settings.theme !== 'light';
    const [pp, setPp] = React.useState('');
    const [pp2, setPp2] = React.useState('');
    const [localError, setLocalError] = React.useState<string | null>(null);

    const submit = () => {
        setLocalError(null);
        if (pp.length < 8) {
            setLocalError('Use at least 8 characters.');
            return;
        }
        if (mode === 'reset' && pp !== pp2) {
            setLocalError('Passphrases do not match.');
            return;
        }
        onSubmit(pp);
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        boxSizing: 'border-box',
        background: dark ? '#1a1a1a' : '#fff',
        color: dark ? '#f3f6f9' : '#111',
        border: `1px solid ${dark ? '#444' : '#ccc'}`,
        borderRadius: 8,
        padding: '9px 12px',
        fontSize: 14,
        marginTop: 6,
    };

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
                aria-label="Cloud sync passphrase"
                className="fade-in"
                style={{
                    background: dark ? '#222' : '#f0f0f0',
                    borderRadius: 12,
                    padding: 24,
                    width: 360,
                    maxWidth: 'min(420px, 80vw)',
                    boxSizing: 'border-box',
                    boxShadow: '0 8px 28px #0009',
                    border: `1px solid ${dark ? '#444' : '#ccc'}`,
                }}
            >
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>
                    {mode === 'reset' ? 'Reset sync passphrase' : 'Cloud sync passphrase'}
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.82, lineHeight: 1.5, marginBottom: 14 }}>
                    {mode === 'reset'
                        ? 'This wipes your synced clips from the cloud and re-uploads this device’s clips under a new passphrase. Your local history is untouched.'
                        : 'Your clips are encrypted with this passphrase before they leave your device. It is never sent to our servers and cannot be recovered, so if you lose it, use "Forgot passphrase".'}
                </div>

                <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>
                    {mode === 'reset' ? 'New passphrase' : 'Passphrase'}
                    <input
                        type="password"
                        value={pp}
                        autoFocus
                        disabled={busy}
                        onChange={(e) => setPp(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && mode === 'enter') submit(); }}
                        style={inputStyle}
                        placeholder="At least 8 characters"
                    />
                </label>

                {mode === 'reset' && (
                    <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, display: 'block', marginTop: 12 }}>
                        Confirm new passphrase
                        <input
                            type="password"
                            value={pp2}
                            disabled={busy}
                            onChange={(e) => setPp2(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                            style={inputStyle}
                            placeholder="Re-enter passphrase"
                        />
                    </label>
                )}

                {(localError || error) && (
                    <div style={{ color: '#ff6b6b', fontSize: 12.5, marginTop: 12 }}>
                        {localError || error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                    <button
                        onClick={submit}
                        disabled={busy}
                        style={{
                            flex: 1,
                            background: settings.accentColor,
                            color: '#06131f',
                            border: 0,
                            borderRadius: 8,
                            padding: '9px 16px',
                            fontWeight: 600,
                            cursor: busy ? 'default' : 'pointer',
                            opacity: busy ? 0.7 : 1,
                        }}
                    >
                        {busy ? 'Working…' : mode === 'reset' ? 'Reset & re-sync' : 'Continue'}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        style={{
                            flex: 1,
                            background: dark ? '#2a2a2a' : '#ffffff',
                            color: dark ? '#fff' : '#1c1e21',
                            border: `1px solid ${dark ? '#444' : '#c9ced6'}`,
                            borderRadius: 8,
                            padding: '9px 16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                </div>

                {mode === 'enter' && (
                    <button
                        onClick={onForgot}
                        disabled={busy}
                        style={{
                            background: 'none',
                            border: 0,
                            color: dark ? '#8fd0ff' : '#2f5f86',
                            fontSize: 12,
                            marginTop: 12,
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        Forgot passphrase?
                    </button>
                )}
            </div>
        </div>
    );
};

export default React.memo(SyncPassphraseDialog);
