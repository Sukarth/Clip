import * as React from 'react';
import type { Settings } from '../app-types';

function getReadableTextColor(background: string): string {
    const value = background.trim();
    const shortHex = /^#([\da-fA-F]{3})$/;
    const longHex = /^#([\da-fA-F]{6})$/;

    const shortMatch = value.match(shortHex);
    const longMatch = value.match(longHex);

    let r = 255;
    let g = 179;
    let b = 0;

    if (shortMatch) {
        const [rs, gs, bs] = shortMatch[1].split('');
        r = parseInt(rs + rs, 16);
        g = parseInt(gs + gs, 16);
        b = parseInt(bs + bs, 16);
    } else if (longMatch) {
        const hex = longMatch[1];
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
    }

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 150 ? '#fff' : '#222';
}

interface SettingsModalFooterProps {
    settingsDraft: Settings | null;
    settings: Settings;
    onQuitRequest: () => void;
    onSave: () => void;
    onCancel: () => void;
}

const SettingsModalFooter: React.FC<SettingsModalFooterProps> = ({
    settingsDraft,
    settings,
    onQuitRequest,
    onSave,
    onCancel,
}) => {
    const accentColor = settingsDraft?.accentColor ?? settings.accentColor;
    const saveTextColor = getReadableTextColor(accentColor);

    return (
        <div
            style={{
                padding: '12px 24px',
                borderTop: '1px solid #333',
                flexShrink: 0,
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
                alignItems: 'center',
            }}
        >
            <button
                style={{
                    background: '#ff4136',
                    border: '1px solid #ff4136',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 15,
                    marginRight: 'auto',
                    transition: 'background 0.2s, border 0.2s',
                }}
                onClick={onQuitRequest}
            >
                Quit App
            </button>
            <button
                className="clip-settings-save-btn"
                style={{
                    background: accentColor,
                    border: `1px solid ${accentColor}`,
                    borderRadius: 8,
                    color: saveTextColor,
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 15,
                }}
                onClick={onSave}
            >
                Save
            </button>
            <button
                className="clip-settings-cancel-btn"
                style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid #444',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 15,
                }}
                onClick={onCancel}
            >
                Cancel
            </button>
        </div>
    );
};

export default React.memo(SettingsModalFooter);