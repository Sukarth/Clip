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
    disabled,
    accentColor = '#2ecc40',
}) => (
    <span
        style={{
            display: 'inline-block',
            width: 38,
            height: 22,
            borderRadius: 22,
            background: checked ? accentColor : '#444',
            position: 'relative',
            transition: 'background 0.2s',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            verticalAlign: 'middle',
        }}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(event) => {
            if (disabled) {
                return;
            }
            if (
                event.key === 'Enter' ||
                event.key === ' ' ||
                event.key === 'Spacebar'
            ) {
                event.preventDefault();
                onChange(!checked);
            }
        }}
        tabIndex={disabled ? -1 : 0}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
    >
        <span
            style={{
                position: 'absolute',
                left: checked ? 18 : 2,
                top: 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px #0002',
                transition: 'left 0.2s ease, background 0.2s ease',
            }}
        />
    </span>
);

export default React.memo(Switch);
