"use client";
import { Checkbox, type CheckboxProps } from "react-aria-components";
import { cx } from "./cx";
export type CheckboxFieldProps = Omit<
  CheckboxProps,
  "children" | "className"
> & { label: string; description?: string; className?: string };
export function CheckboxField({
  label,
  description,
  className,
  ...props
}: CheckboxFieldProps) {
  return (
    <Checkbox
      {...props}
      className={cx(
        "cp-checkbox flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2 text-content data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus data-[disabled]:text-on-disabled",
        className,
      )}
    >
      <span className="cp-checkbox-mark mt-0.5" aria-hidden="true" />
      <span>
        <span className="block text-base font-bold">{label}</span>
        {description && (
          <span className="block text-sm leading-5 text-content-muted">
            {description}
          </span>
        )}
      </span>
    </Checkbox>
  );
}
