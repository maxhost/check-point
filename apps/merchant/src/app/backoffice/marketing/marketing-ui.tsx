"use client";
import Link from "next/link";
import { useId } from "react";
import {
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
  Text,
} from "react-aria-components";
import {
  ModuleHeader,
  Skeleton,
  SkeletonScreen,
  Toast,
} from "../../components/ui";
import { Alert, ApiError, Button } from "../../../ui";
import { MarketingApiError, errorText } from "./marketing-api";

export function MarketingShell({
  title,
  description,
  children,
  closeHref = "/backoffice",
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  closeHref?: string;
  onClose?: () => void;
}) {
  return (
    <main className="merchant-shell">
      <div className="brand-page marketing-page">
        <ModuleHeader
          eyebrow="Marketing"
          title={title}
          description={description}
          closeHref={closeHref}
          onClose={onClose}
        />
        {children}
      </div>
    </main>
  );
}

export function MarketingLoading({
  label = "Cargando marketing…",
}: {
  label?: string;
}) {
  return (
    <main className="merchant-shell">
      <SkeletonScreen label={label} className="brand-page marketing-page">
        <Skeleton height={16} width={130} />
        <Skeleton height={34} width="70%" />
        <Skeleton height={100} width="100%" />
        <Skeleton height={100} width="100%" />
      </SkeletonScreen>
    </main>
  );
}

export function MarketingError({
  error,
  retry,
  isOwner,
}: {
  error: MarketingApiError;
  retry?: () => void;
  isOwner: boolean;
}) {
  if (
    [
      "unauthorized",
      "not_owner",
      "email_not_verified",
      "business_suspended",
      "business_closed",
    ].includes(error.code ?? "")
  )
    return (
      <ApiError
        code={
          error.code as
            | "unauthorized"
            | "not_owner"
            | "email_not_verified"
            | "business_suspended"
            | "business_closed"
        }
        suspensionReason={isOwner ? error.suspensionReason : undefined}
        onLogin={() => window.location.assign("/")}
        onBack={() => window.location.assign("/backoffice/marketing")}
        onHome={() => window.location.assign("/backoffice")}
        onEmailVerified={retry}
      />
    );
  return (
    <Alert kind="error" title={errorText(error)}>
      {error.code === "not_member" || error.code === "missing_permission" ? (
        <Link href="/backoffice">Volver al Backoffice</Link>
      ) : (
        retry && (
          <Button variant="secondary" onPress={retry}>
            Reintentar
          </Button>
        )
      )}
    </Alert>
  );
}

export function MarketingToast({
  message,
  dismiss,
  kind = "success",
}: {
  message: string | null;
  dismiss: () => void;
  kind?: "success" | "error" | "info" | "warning";
}) {
  return <Toast message={message} kind={kind} onDismiss={dismiss} />;
}

export function MarketingConfirm({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const id = useId();
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !busy) onCancel();
      }}
      isDismissable={!busy}
      className="fixed inset-0 z-50 grid place-items-center bg-overlay p-4"
    >
      <Modal className="w-full max-w-lg rounded-lg border border-border bg-surface-raised p-5 text-content shadow-lg sm:p-6">
        <Dialog className="outline-none" aria-describedby={id}>
          <Heading slot="title" className="text-xl font-bold">
            {title}
          </Heading>
          <Text
            id={id}
            slot="description"
            className="my-5 block whitespace-pre-line text-base leading-6"
          >
            {description}
          </Text>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              autoFocus
              isDisabled={busy}
              onPress={onCancel}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={danger ? "danger" : "primary"}
              isLoading={busy}
              onPress={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function MarketingPanel({
  title,
  children,
  description,
}: {
  title: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4 text-content sm:p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      {description && <p className="mt-2 text-content-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
