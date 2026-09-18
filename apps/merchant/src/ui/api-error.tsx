"use client";

import { useState } from "react";
import { Alert } from "./feedback";
import { Button } from "./button";
import { cx } from "./cx";

export type OwnerGateErrorCode =
  | "unauthorized"
  | "not_owner"
  | "email_not_verified"
  | "business_suspended"
  | "business_closed";

type ErrorAction = "login" | "back" | "verify-email" | "contact" | "home";

type ErrorPresentation = {
  title: string;
  description: string;
  action: ErrorAction;
  actionLabel: string;
};

export const ownerGateErrors: Record<OwnerGateErrorCode, ErrorPresentation> = {
  unauthorized: {
    title: "Tu sesión terminó",
    description: "Volvé a ingresar para continuar de forma segura.",
    action: "login",
    actionLabel: "Volver a ingresar",
  },
  not_owner: {
    title: "Esta acción es solo para propietarios",
    description: "Tu cuenta no tiene permiso para administrar este negocio.",
    action: "back",
    actionLabel: "Volver",
  },
  email_not_verified: {
    title: "Verificá tu email para continuar",
    description:
      "Te enviaremos un enlace para confirmar que tenés acceso a esa dirección.",
    action: "verify-email",
    actionLabel: "Enviar enlace",
  },
  business_suspended: {
    title: "La cuenta del negocio está suspendida",
    description:
      "La suspensión la gestiona CheckPass. Contactanos si necesitás ayuda.",
    action: "contact",
    actionLabel: "Contactar a CheckPass",
  },
  business_closed: {
    title: "Este negocio está cerrado",
    description: "La cuenta ya no admite operaciones ni nuevos ingresos.",
    action: "home",
    actionLabel: "Ir al inicio",
  },
};

export type ApiErrorProps = {
  code: OwnerGateErrorCode;
  suspensionReason?: string | null;
  onLogin?: () => void;
  onBack?: () => void;
  onContact?: () => void;
  onHome?: () => void;
  onEmailVerified?: () => void;
  className?: string;
};

type VerificationResponse = {
  sent: boolean;
  verified: boolean;
};

export function ApiError({
  code,
  suspensionReason,
  onLogin,
  onBack,
  onContact,
  onHome,
  onEmailVerified,
  className,
}: ApiErrorProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const [verificationFailed, setVerificationFailed] = useState(false);
  const presentation = ownerGateErrors[code];

  async function verifyEmail() {
    setIsVerifying(true);
    setVerificationMessage(null);
    setVerificationFailed(false);

    try {
      const response = await fetch("/api/merchant/auth/verify-email", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("verify-email-failed");

      const result = (await response.json()) as VerificationResponse;
      if (result.verified) {
        setVerificationMessage(
          "Tu email ya estaba verificado. Ya podés continuar.",
        );
        onEmailVerified?.();
      } else if (result.sent) {
        setVerificationMessage("Te enviamos el enlace. Revisá tu correo.");
      } else {
        throw new Error("verify-email-invalid-response");
      }
    } catch {
      setVerificationFailed(true);
      setVerificationMessage(
        "No pudimos enviar el enlace. Esperá un momento y volvé a intentar.",
      );
    } finally {
      setIsVerifying(false);
    }
  }

  const callbacks: Partial<Record<ErrorAction, (() => void) | undefined>> = {
    login: onLogin,
    back: onBack,
    contact: onContact,
    home: onHome,
    "verify-email": verifyEmail,
  };
  const action = callbacks[presentation.action];

  return (
    <Alert kind="error" title={presentation.title} className={className}>
      <div className="grid gap-3">
        <p>{presentation.description}</p>
        {code === "business_suspended" && suspensionReason && (
          <p>
            <span className="font-bold">Motivo:</span> {suspensionReason}
          </p>
        )}
        {verificationMessage && (
          <p
            className={cx(
              "font-semibold",
              verificationFailed ? "text-danger" : "text-success",
            )}
          >
            {verificationMessage}
          </p>
        )}
        {action && !(verificationMessage && !verificationFailed) && (
          <Button variant="secondary" onPress={action} isLoading={isVerifying}>
            {isVerifying ? "Enviando enlace…" : presentation.actionLabel}
          </Button>
        )}
      </div>
    </Alert>
  );
}
