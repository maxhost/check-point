"use client";

import { useId, type ReactNode } from "react";
import { Xmark } from "iconoir-react";
import {
  Dialog as AriaDialog,
  Heading as AriaHeading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { Button } from "./button";
import { Text } from "./text";

export type SheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  isDismissable?: boolean;
};

/** Bottom sheet with modal focus, scroll locking and an optional fixed footer. */
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  isDismissable = true,
}: SheetProps) {
  const descriptionId = useId();
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
      className="cp-sheet-overlay"
    >
      <Modal className="cp-sheet-panel">
        <AriaDialog
          aria-describedby={description ? descriptionId : undefined}
          className="cp-sheet-dialog"
        >
          <div className="cp-sheet-handle" aria-hidden="true" />
          <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-2">
            <div className="min-w-0">
              <AriaHeading
                slot="title"
                className="m-0 text-xl font-bold leading-7 text-content"
              >
                {title}
              </AriaHeading>
              {description && (
                <Text id={descriptionId} variant="muted" className="mt-1">
                  {description}
                </Text>
              )}
            </div>
            {isDismissable && (
              <Button
                variant="quiet"
                aria-label="Cerrar"
                className="size-11 shrink-0 p-0!"
                onPress={() => onOpenChange(false)}
              >
                <Xmark className="size-5" aria-hidden="true" />
              </Button>
            )}
          </header>
          <div className="cp-sheet-body">{children}</div>
          {footer && <footer className="cp-sheet-footer">{footer}</footer>}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
