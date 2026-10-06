"use client";

import { useContext, useEffect, useRef } from "react";
import {
  ComboBox,
  ComboBoxStateContext,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  type Key,
} from "react-aria-components";
import { cx } from "./cx";

export type ComboboxItem = { id: Key; label: string; description?: string };

export type ComboboxProps = {
  label: string;
  /** Controlados: el filtrado o la busqueda los hace quien lo usa. */
  items: ComboboxItem[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSelectionChange: (id: Key | null) => void;
  placeholder?: string;
  description?: string;
  /** Estado de una busqueda («Buscando…», «Sin resultados»): se anuncia al cambiar. */
  status?: string;
  /** Errores de red de un combobox asincrono: se anuncian (`role="alert"`). */
  errorMessage?: string;
  isDisabled?: boolean;
  name?: string;
  tourAnchor?: string;
  className?: string;
};

/**
 * React Aria abre la lista solo cuando cambia el texto; en una busqueda asincrona las opciones
 * llegan despues (medido con Places: la lista no se abria). Abre cuando llegan opciones NUEVAS
 * con el foco en el campo; un Escape con las mismas opciones no la reabre.
 */
function OpenWhenItemsArrive({ items }: { items: ComboboxItem[] }) {
  const state = useContext(ComboBoxStateContext);
  const ids = items.map((item) => String(item.id)).join("\u0000");
  const last = useRef(ids);
  useEffect(() => {
    if (ids === last.current) return;
    last.current = ids;
    if (state && items.length > 0 && state.isFocused && !state.isOpen)
      state.open(null, "input");
  }, [ids, items.length, state]);
  return null;
}

export function Combobox({
  label,
  items,
  inputValue,
  onInputChange,
  onSelectionChange,
  placeholder,
  description,
  status,
  errorMessage,
  isDisabled,
  name,
  tourAnchor,
  className,
}: ComboboxProps) {
  return (
    <ComboBox
      items={items}
      inputValue={inputValue}
      onInputChange={onInputChange}
      onChange={onSelectionChange}
      menuTrigger="input"
      name={name}
      isDisabled={isDisabled}
      isInvalid={errorMessage ? true : undefined}
      validationBehavior="aria"
      data-tour={tourAnchor}
      className={cx("grid gap-1.5", className)}
    >
      <OpenWhenItemsArrive items={items} />
      <Label className="cp-field-label text-base font-bold leading-5 text-content">
        {label}
      </Label>
      {/* Las clases del input de `TextField`. */}
      <Input
        placeholder={placeholder}
        className={({ isDisabled, isInvalid, isFocusVisible }) =>
          cx(
            "min-h-12 w-full rounded-md border bg-surface px-3.5 py-2.5 text-base text-content outline-none",
            "placeholder:text-content-muted",
            isInvalid ? "border-danger" : "border-border-strong",
            isFocusVisible && "outline-2 outline-offset-2 outline-focus",
            isDisabled &&
              "cursor-not-allowed border-disabled bg-disabled text-on-disabled",
          )
        }
      />
      {description && (
        <Text
          slot="description"
          className="text-sm leading-5 text-content-muted"
        >
          {description}
        </Text>
      )}
      {/* Siempre montadas (una region viva tiene que existir antes de cambiar); vacias, no
          ocupan lugar en la grilla. */}
      <p
        role="status"
        className="m-0 text-sm leading-5 text-content-muted empty:sr-only"
      >
        {status}
      </p>
      <div role="alert" className="empty:sr-only">
        <FieldError className="text-sm font-semibold leading-5 text-danger">
          {errorMessage}
        </FieldError>
      </div>
      {/* La lista del `SelectField`. */}
      <Popover className="w-[var(--trigger-width)] rounded-md border border-border bg-surface-raised p-1 shadow-lg outline-none">
        <ListBox className="max-h-72 overflow-auto outline-none">
          {(item: ComboboxItem) => (
            <ListBoxItem
              textValue={item.label}
              className={({ isFocused, isSelected, isDisabled }) =>
                cx(
                  "grid min-h-11 cursor-default rounded-sm px-3 py-2 text-base text-content outline-none",
                  (isFocused || isSelected) && "bg-primary-soft text-content",
                  isDisabled && "text-content-disabled",
                )
              }
            >
              <span className="font-semibold">{item.label}</span>
              {item.description && (
                <span className="text-sm text-content-muted">
                  {item.description}
                </span>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
