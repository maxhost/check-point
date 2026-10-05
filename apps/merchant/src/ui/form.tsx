"use client";

import {
  Form as AriaForm,
  type FormProps as AriaFormProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Heading } from "./heading";
import { Text } from "./text";

export type FormProps = Omit<AriaFormProps, "children" | "className"> & {
  className?: string;
  children: ReactNode;
};

/** `validationErrors` (errores del servidor por `name`) pasa tal cual a React Aria. */
export function Form({ className, children, ...props }: FormProps) {
  return (
    <AriaForm
      {...props}
      validationBehavior={props.validationBehavior ?? "aria"}
      className={cx("grid gap-5", className)}
    >
      {children}
    </AriaForm>
  );
}

export type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** `fieldset` con `legend`: da el nombre accesible del grupo. */
export function FormSection({
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    <fieldset className="m-0 grid min-w-0 gap-5 border-0 p-0">
      <legend className="mb-4 p-0">
        <Heading level={2}>{title}</Heading>
        {description && <Text variant="small">{description}</Text>}
      </legend>
      {children}
    </fieldset>
  );
}

/** En movil la accion principal (la ultima) queda arriba y a todo el ancho. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}
