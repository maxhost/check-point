"use client";

import { useRef, type ReactNode } from "react";
import { Button, type ButtonProps } from "./button";

export type FileButtonProps = {
  onSelect: (files: File[]) => void;
  /** Tipos aceptados, separados por comas (`"image/png,image/jpeg"`). */
  accept?: string;
  multiple?: boolean;
  /** Abre la camara trasera en celulares (`capture="environment"`). */
  camera?: boolean;
  /** `aria-label` del input oculto: el gancho de `setInputFiles` en los e2e. */
  inputLabel?: string;
  isDisabled?: boolean;
  variant?: ButtonProps["variant"];
  icon?: ReactNode;
  tourAnchor?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Spec 0161. Un `Button` del kit que abre un input de archivo oculto, vaciado antes de cada clic
 * (elegir el mismo archivo otra vez vuelve a llamar a `onSelect`), como `FileTrigger` de React
 * Aria. No se usa `FileTrigger`: descarta el `aria-label` del input (`filterDOMProps` sin
 * `labelable`, medido en 1.21.1) y los e2e lo ubican por esa etiqueta.
 */
export function FileButton({
  onSelect,
  accept,
  multiple,
  camera,
  inputLabel,
  isDisabled,
  variant = "secondary",
  icon,
  tourAnchor,
  className,
  children,
}: FileButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        aria-label={inputLabel}
        accept={accept}
        multiple={multiple}
        capture={camera ? "environment" : undefined}
        disabled={isDisabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onSelect(files);
        }}
      />
      <Button
        variant={variant}
        isDisabled={isDisabled}
        data-tour={tourAnchor}
        className={className}
        onPress={() => {
          if (!input.current) return;
          input.current.value = "";
          input.current.click();
        }}
      >
        {icon && (
          <span className="contents [&>svg]:size-5" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </Button>
    </>
  );
}
