import { TextField } from "../../ui";

/** Exactamente el campo del código del dueño, compuesto para los cuatro usos del PIN. */
export function PinField({
  label,
  name,
  value,
  onChange,
  disabled,
  errorMessage,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  errorMessage?: string;
}) {
  return (
    <TextField
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      pattern="\d{6}"
      isRequired
      isDisabled={disabled}
      errorMessage={errorMessage}
    />
  );
}
