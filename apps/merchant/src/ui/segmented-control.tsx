"use client";

import {
  ToggleButton,
  ToggleButtonGroup,
  type Key,
} from "react-aria-components";
import { cx } from "./cx";

export type SegmentedControlProps = {
  "aria-label": string;
  options: { id: Key; label: string }[];
  selectedKey: Key;
  onSelectionChange: (id: Key) => void;
  isDisabled?: boolean;
  fullWidth?: boolean;
  tourAnchor?: string;
};

/** Spec 0160: una opcion entre pocas. Roles `radiogroup`/`radio` + `aria-checked` (React Aria). */
export function SegmentedControl({
  options,
  selectedKey,
  onSelectionChange,
  isDisabled,
  fullWidth = false,
  tourAnchor,
  ...props
}: SegmentedControlProps) {
  return (
    <ToggleButtonGroup
      aria-label={props["aria-label"]}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[selectedKey]}
      onSelectionChange={(keys) => {
        const [next] = keys;
        if (next !== undefined) onSelectionChange(next);
      }}
      isDisabled={isDisabled}
      data-tour={tourAnchor}
      className={cx(
        "inline-flex gap-1 rounded-md border border-border-strong bg-surface p-1",
        fullWidth ? "w-full" : "w-fit",
      )}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className={({ isSelected, isFocusVisible, isDisabled }) =>
            cx(
              "min-h-10 cursor-pointer rounded-sm px-4 text-base font-bold outline-none transition-colors duration-[var(--duration-fast)]",
              fullWidth && "min-w-0 flex-1",
              isSelected
                ? "bg-primary text-on-primary"
                : "bg-transparent text-content hover:bg-surface-subtle",
              isFocusVisible && "outline-2 outline-offset-2 outline-focus",
              isDisabled && "cursor-not-allowed text-content-disabled",
            )
          }
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
