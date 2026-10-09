"use client";

import { Toast } from "./ui";

/** Shared presentation for completed actions; mobile bottom, desktop top right. */
export function ConfirmationToast({
  message,
  onDismiss,
  durationMs = 4000,
}: {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  return (
    <Toast
      message={message}
      kind="success"
      durationMs={durationMs}
      onDismiss={onDismiss}
      className="fixed! top-auto! right-auto! bottom-24! left-1/2! z-50 m-0! w-auto! -translate-x-1/2! rounded-full bg-content! px-4 text-on-primary! pointer-events-none whitespace-nowrap md:top-6! md:right-6! md:bottom-auto! md:left-auto! md:translate-x-0!"
    />
  );
}
