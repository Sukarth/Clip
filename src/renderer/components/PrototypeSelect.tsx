import * as React from 'react';

interface PrototypeSelectOption<T extends string | number> {
    value: T;
    label: string;
}

interface PrototypeSelectProps<T extends string | number> {
    value: T;
    options: PrototypeSelectOption<T>[];
    onChange: (value: T) => void;
    className?: string;
    triggerLabel?: string;
}

function PrototypeSelectInner<T extends string | number>({
    value,
    options,
    onChange,
    className,
    triggerLabel,
}: PrototypeSelectProps<T>) {
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const selected = options.find((option) => option.value === value);

    return (
        <div
            ref={rootRef}
            className={`custom-select ${open ? 'open' : ''} ${className || ''}`.trim()}
            data-value={String(value)}
        >
            <button type="button" className="custom-select-trigger" onClick={() => setOpen((current) => !current)}>
                <span>{triggerLabel ?? selected?.label ?? ''}</span>
                <span className="material-symbols-outlined">expand_more</span>
            </button>
            <div className="custom-select-options">
                {options.map((option) => (
                    <button
                        key={String(option.value)}
                        type="button"
                        className={`custom-select-option ${option.value === value ? 'selected' : ''}`}
                        onClick={() => {
                            onChange(option.value);
                            setOpen(false);
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

const PrototypeSelect = React.memo(PrototypeSelectInner) as typeof PrototypeSelectInner;

export default PrototypeSelect;
