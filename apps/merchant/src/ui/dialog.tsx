"use client";

import {
  Dialog as AriaDialog,
  Heading as AriaHeading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useId, type ReactNode } from "react";
import { Button } from "./button";
import { FormActions } from "./form";

export type DialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  /** `ReactNode`: la baja de suscripcion lleva un link en la descripcion. */
  description?: ReactNode;
  role?: "dialog" | "alertdialog";
  isDismissable?: boolean;
  tourAnchor?: string;
  children?: ReactNode;
};

/** Modal del kit (spec 0160). Escape y clic afuera cierran si `isDismissable`. */
export function Dialog({
  isOpen,
  onOpenChange,
  title,
  description,
  role = "dialog",
  isDismissable = true,
  tourAnchor,
  children,
}: DialogProps) {
  const descriptionId = useId();
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
      className="fixed inset-0 z-50 grid place-items-center bg-overlay p-4"
    >
      <Modal className="w-full max-w-lg rounded-lg border border-border bg-surface-raised p-6 text-content shadow-lg">
        <AriaDialog
          role={role}
          data-tour={tourAnchor}
          aria-describedby={description ? descriptionId : undefined}
          className="outline-none"
        >
          {/* Las clases del `Heading` nivel 2 y del `Text` muted del kit. */}
          <AriaHeading
            slot="title"
            level={2}
            className="m-0 text-xl font-bold leading-7 text-content"
          >
            {title}
          </AriaHeading>
          {description && (
            <p
              id={descriptionId}
              className="m-0 mt-2 whitespace-pre-line text-base font-normal leading-6 text-content-muted"
            >
              {description}
            </p>
          )}
          {children && <div className="mt-5">{children}</div>}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

export type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  intent?: "primary" | "danger";
  /** Mientras confirma: ni Escape ni clic afuera cierran, y «Cancelar» queda deshabilitado. */
  isBusy?: boolean;
  confirmDisabled?: boolean;
  tourAnchor?: string;
  confirmTourAnchor?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  intent = "primary",
  isBusy = false,
  confirmDisabled = false,
  tourAnchor,
  confirmTourAnchor,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isBusy) onCancel();
      }}
      title={title}
      description={description}
      role="alertdialog"
      isDismissable={!isBusy}
      tourAnchor={tourAnchor}
    >
      <FormActions>
        <Button
          variant="secondary"
          autoFocus
          isDisabled={isBusy}
          onPress={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={intent}
          isLoading={isBusy}
          isDisabled={confirmDisabled}
          data-tour={confirmTourAnchor}
          onPress={onConfirm}
        >
          {confirmLabel}
        </Button>
      </FormActions>
    </Dialog>
  );
}
