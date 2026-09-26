import { useId } from "react";
import {
  ModalOverlay,
  Modal,
  Dialog,
  Heading,
  Text,
} from "react-aria-components";
import { Button } from "../../../ui";
export function LoyaltyConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const descriptionId = useId();
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) onCancel();
      }}
      isDismissable
      className="loyalty-dialog-overlay fixed inset-0 z-50 grid place-items-center bg-overlay p-4"
    >
      <Modal className="w-full max-w-lg rounded-lg border border-border bg-surface-raised p-6 text-content shadow-lg">
        <Dialog className="outline-none" aria-describedby={descriptionId}>
          <Heading slot="title" className="text-xl font-bold">
            {title}
          </Heading>
          <Text
            id={descriptionId}
            slot="description"
            className="my-5 whitespace-pre-line text-base"
          >
            {description}
          </Text>
          <div className="loyalty-actions">
            <Button variant="secondary" autoFocus onPress={onCancel}>
              Cancelar
            </Button>
            <Button variant="danger" onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
