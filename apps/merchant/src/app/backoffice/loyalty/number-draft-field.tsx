import { NumberField, type NumberFieldProps } from "../../../ui";
/** NumberField commits on blur. Capture the draft while typing so submit validates
 * the value the user sees, including an empty input, before the blur commit. */
export function NumberDraftField(
  props: NumberFieldProps & { onChange: (value: number) => void },
) {
  return (
    <div
      className="loyalty-number-draft"
      onInputCapture={(event) => {
        const input = event.target;
        if (input instanceof HTMLInputElement)
          props.onChange(input.value.trim() === "" ? NaN : Number(input.value));
      }}
    >
      <NumberField
        {...props}
        formatOptions={{ ...props.formatOptions, useGrouping: false }}
        clampOnBlur={false}
      />
    </div>
  );
}
