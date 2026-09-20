"use client";

import { CheckCircle, Download, QrCode, Whatsapp } from "iconoir-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-aria-components";
import { ApiError, Button } from "../../../../../../ui";
import type { BusinessSummary } from "../_lib/contracts";
import {
  getQrImage,
  getQrPng,
  qrDownloadPath,
  WizardApiError,
} from "../_lib/onboarding-api";
import { gateCode } from "./wizard-shared";

export function CompleteStep({
  business,
  onGateError,
}: {
  business: BusinessSummary;
  onGateError: (error: WizardApiError) => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<WizardApiError | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [showWhatsappFallback, setShowWhatsappFallback] = useState(false);

  const loadQr = useCallback(async () => {
    setError(null);
    setVerificationRequired(false);
    try {
      const blob = await getQrImage();
      setQrUrl(URL.createObjectURL(blob));
    } catch (caught) {
      const requestError =
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos preparar tu QR.", 503);
      if (requestError.code === "email_not_verified") {
        setVerificationRequired(true);
      } else if (gateCode(requestError)) {
        onGateError(requestError);
      } else {
        setError(requestError);
      }
    }
  }, [onGateError]);

  useEffect(() => {
    void loadQr();
  }, [loadQr]);

  useEffect(
    () => () => {
      if (qrUrl) URL.revokeObjectURL(qrUrl);
    },
    [qrUrl],
  );

  const heading = verificationRequired
    ? "Verificá tu email para obtener el QR"
    : qrUrl
      ? "Tu QR está listo"
      : "Preparando tu QR";

  async function shareQr() {
    setIsSharing(true);
    setShareMessage(null);
    setShowWhatsappFallback(false);
    try {
      const blob = await getQrPng();
      const file = new File([blob], `qr-${business.slug}.png`, {
        type: "image/png",
      });
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: `QR de ${business.name}`,
          text: `QR para sumarse al programa de ${business.name}.`,
          files: [file],
        });
        setShareMessage("QR compartido.");
        return;
      }

      downloadBlob(blob, file.name);
      setShowWhatsappFallback(true);
      setShareMessage(
        "Descargamos el QR. Abrí WhatsApp y adjuntalo al mensaje.",
      );
    } catch (caught) {
      if ((caught as { name?: string }).name !== "AbortError") {
        setShareMessage("No pudimos compartir el QR. Probá descargarlo.");
      }
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <section className="text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
        <CheckCircle className="size-8" aria-hidden="true" />
      </div>
      <p className="mt-5 text-sm font-bold text-primary">Programa activo</p>
      <h1
        id="wizard-heading"
        tabIndex={-1}
        className="mt-2 text-3xl font-bold leading-tight outline-none"
      >
        {heading}
      </h1>
      <p className="mx-auto mt-3 max-w-md leading-6 text-content-muted">
        {verificationRequired
          ? "Tu programa ya está activo. Falta confirmar tu email para habilitar el QR."
          : `Mostralo en ${business.name} para que tus clientes se sumen al programa.`}
      </p>
      {verificationRequired ? (
        <div className="mt-7 grid gap-3 text-left">
          <ApiError
            code="email_not_verified"
            onEmailVerified={() => void loadQr()}
          />
          <Button variant="quiet" onPress={() => void loadQr()} fullWidth>
            Ya verifiqué mi email
          </Button>
        </div>
      ) : (
        <div className="mx-auto mt-7 grid aspect-square w-full max-w-72 place-items-center rounded-lg border border-border bg-surface p-5 shadow-sm">
          {qrUrl ? (
            // The blob is returned by the contracted same-origin QR endpoint.
            <img
              src={qrUrl}
              alt={`QR de enrolamiento de ${business.name}`}
              className="size-full"
            />
          ) : error ? (
            <div className="grid gap-3 text-center">
              <QrCode
                className="mx-auto size-10 text-content-muted"
                aria-hidden="true"
              />
              <p className="text-sm text-danger">{error.message}</p>
            </div>
          ) : (
            <p role="status" className="text-sm text-content-muted">
              Generando QR…
            </p>
          )}
        </div>
      )}
      {qrUrl && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={qrDownloadPath}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 font-bold text-on-primary outline-none transition-colors data-hovered:bg-primary-hover data-pressed:bg-primary-pressed data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus"
          >
            <Download className="size-5" aria-hidden="true" />
            Descargar PNG
          </Link>
          <Button
            variant="secondary"
            fullWidth
            isLoading={isSharing}
            onPress={() => void shareQr()}
          >
            <Whatsapp className="size-5" aria-hidden="true" />
            {isSharing ? "Preparando…" : "Compartir QR"}
          </Button>
        </div>
      )}
      {shareMessage && (
        <p role="status" className="mt-3 text-sm text-content-muted">
          {shareMessage}
        </p>
      )}
      {showWhatsappFallback && (
        <Link
          href={`https://wa.me/?text=${encodeURIComponent(`Te envío el QR del programa de ${business.name}. Adjuntá el PNG que acaba de descargarse.`)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-bold text-primary outline-none data-hovered:bg-primary-soft data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus"
        >
          <Whatsapp className="size-5" aria-hidden="true" />
          Abrir WhatsApp
        </Link>
      )}
      <p className="mt-5 text-sm text-content-muted">
        Identificador público:{" "}
        <strong className="text-content">@{business.slug}</strong>
      </p>
      <div className="mt-8 rounded-lg border border-border bg-surface-subtle p-5 text-left">
        <h2 className="text-lg font-bold text-content">Tu cuenta está lista</h2>
        <p className="mt-2 text-sm leading-5 text-content-muted">
          Desde tu cuenta podrás acceder a funciones avanzadas para personalizar
          tu marca, tu programa y mucho más.
        </p>
        <Link
          href="/backoffice"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-base font-bold text-on-primary shadow-sm outline-none transition-colors data-hovered:bg-primary-hover data-pressed:bg-primary-pressed data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus"
        >
          Ir a mi panel
        </Link>
      </div>
    </section>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
