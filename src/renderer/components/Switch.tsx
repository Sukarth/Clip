import * as React from 'react';

interface SwitchProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
    accentColor?: string;
}

const Switch: React.FC<SwitchProps> = ({
    checked,
    onChange,
    disabled = false,
}) => {
    return (
        <label className="toggle-switch" style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
            />
            <span className="toggle-slider"></span>
        </label>
    );
};

export default React.memo(Switch);
