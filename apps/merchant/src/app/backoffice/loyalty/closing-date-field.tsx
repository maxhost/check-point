import { useId } from "react";
export function ClosingDateField({
  label,
  value,
  onChange,
  min,
  timezone,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  timezone: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="cp-field-label text-base font-bold text-content"
      >
        {label}
      </label>
      <input
        className="loyalty-date min-h-12 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3.5 text-base text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        id={id}
        type="datetime-local"
        value={value}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        aria-invalid={Boolean(error)}
      />
      <p id={`${id}-help`} className="text-sm text-content-muted">
        Zona horaria: {timezone}.
      </p>
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
