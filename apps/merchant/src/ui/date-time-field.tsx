"use client";

import { parseDateTime } from "@internationalized/date";
import {
  Calendar as CalendarIcon,
  NavArrowLeft,
  NavArrowRight,
} from "iconoir-react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
  Text,
} from "react-aria-components";
import { cx } from "./cx";
import {
  fieldBox,
  fieldDescription,
  fieldError,
  fieldLabel,
  segmentClasses,
} from "./field-classes";

export type DateTimeFieldProps = {
  label: string;
  /** `"YYYY-MM-DDTHH:mm"`, como un `input type="datetime-local"`; `""` = vacio. */
  value: string;
  onChange: (value: string) => void;
  /** Minimo, en el mismo formato. */
  min?: string;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  name?: string;
  /** El calendario abierto al montar (capturas del harness). */
  defaultOpen?: boolean;
  tourAnchor?: string;
  className?: string;
};

function toDateTime(value: string | undefined) {
  try {
    return value ? parseDateTime(value) : null;
  } catch {
    return null;
  }
}

const iconButton =
  "grid shrink-0 place-items-center rounded-sm text-content outline-none data-hovered:bg-primary-soft data-focus-visible:outline-2 data-focus-visible:outline-focus disabled:text-on-disabled";

/**
 * Spec 0161. Segmentos de React Aria + calendario (owner, 2026-10-05). `es-419` y 24 h fijos; el
 * valor sigue siendo texto sin zona, como el input nativo que reemplaza.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  min,
  description,
  errorMessage,
  tourAnchor,
  className,
  ...props
}: DateTimeFieldProps) {
  return (
    <I18nProvider locale="es-419">
      <DatePicker
        {...props}
        value={toDateTime(value)}
        minValue={toDateTime(min)}
        onChange={(date) => onChange(date ? date.toString().slice(0, 16) : "")}
        granularity="minute"
        hourCycle={24}
        validationBehavior="aria"
        isInvalid={errorMessage ? true : undefined}
        data-tour={tourAnchor}
        className={cx("grid gap-1.5", className)}
      >
        <Label className={fieldLabel}>{label}</Label>
        <Group
          className={({ isInvalid, isFocusVisible, isDisabled }) =>
            cx(
              fieldBox({ isInvalid, isFocusVisible, isDisabled }),
              "flex items-center justify-between gap-2 py-1 pr-1.5",
            )
          }
        >
          <DateInput className="flex flex-wrap items-center py-1.5">
            {(segment) => (
              <DateSegment segment={segment} className={segmentClasses} />
            )}
          </DateInput>
          <Button
            aria-label="Abrir calendario"
            className={cx(iconButton, "size-9")}
          >
            <CalendarIcon className="size-5" aria-hidden="true" />
          </Button>
        </Group>
        {description && (
          <Text slot="description" className={fieldDescription}>
            {description}
          </Text>
        )}
        <FieldError className={fieldError}>{errorMessage}</FieldError>
        <Popover className="rounded-lg border border-border bg-surface-raised p-4 text-content shadow-lg outline-none">
          <Dialog className="outline-none">
            <Calendar>
              <header className="mb-2 flex items-center justify-between gap-2">
                <Button
                  slot="previous"
                  aria-label="Mes anterior"
                  className={cx(iconButton, "size-11")}
                >
                  <NavArrowLeft className="size-5" aria-hidden="true" />
                </Button>
                <Heading className="m-0 text-base font-bold leading-6 text-content" />
                <Button
                  slot="next"
                  aria-label="Mes siguiente"
                  className={cx(iconButton, "size-11")}
                >
                  <NavArrowRight className="size-5" aria-hidden="true" />
                </Button>
              </header>
              <CalendarGrid className="border-collapse">
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={({
                      isSelected,
                      isToday,
                      isDisabled,
                      isUnavailable,
                      isOutsideMonth,
                      isFocusVisible,
                      isHovered,
                    }) =>
                      cx(
                        "grid size-11 place-items-center rounded-md border text-base text-content outline-none",
                        isToday && !isSelected
                          ? "border-primary"
                          : "border-transparent",
                        isOutsideMonth && "hidden",
                        isHovered && !isSelected && "bg-primary-soft",
                        isSelected && "bg-primary text-on-primary",
                        (isDisabled || isUnavailable) &&
                          "cursor-not-allowed bg-transparent text-on-disabled",
                        isFocusVisible &&
                          "outline-2 outline-offset-2 outline-focus",
                      )
                    }
                  />
                )}
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </DatePicker>
    </I18nProvider>
  );
}
