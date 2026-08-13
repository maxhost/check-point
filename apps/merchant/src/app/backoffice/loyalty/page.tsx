"use client";

import Link from "next/link";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { ModuleHeader, Toast } from "../../components/ui";
import { ProgramEditor } from "./program-editor";
import { ProgramView } from "./program-view";
import { LoyaltySkeleton } from "./ui";
import { useLoyaltyProgram } from "./use-loyalty-program";

export default function LoyaltyProgramPage() {
  const vm = useLoyaltyProgram();
  const {
    context,
    program,
    editing,
    isClosing,
    timezone,
    notice,
    confirmDiscard,
    confirmClose,
    confirmCancel,
    setNotice,
    setEditing,
    setConfirmDiscard,
    setConfirmClose,
    setConfirmCancel,
    populate,
    closeProgram,
    cancelClose,
  } = vm;

  if (!context) return <LoyaltySkeleton />;
  return (
    <main className="merchant-shell">
      <div className="brand-page loyalty-page">
        <Toast message={notice} onDismiss={() => setNotice(null)} />
        <ModuleHeader
          eyebrow="Programa de fidelización"
          title={
            isClosing
              ? "Tu programa está en cierre"
              : program && !editing
                ? "Tu programa está activo"
                : "Premia a tus clientes"
          }
          description={
            isClosing
              ? `No se podrá modificar. Los horarios se muestran en ${timezone}.`
              : "Elige una única forma de acumular beneficios en tu negocio."
          }
          closeHref="/backoffice"
          onClose={editing ? () => setConfirmDiscard(true) : undefined}
        />
        {program && !editing ? (
          <ProgramView vm={vm} />
        ) : isClosing ? null : (
          <ProgramEditor vm={vm} />
        )}
        <p className="field-help">
          <Link href="/backoffice">Volver al Backoffice</Link>
        </p>
        <ConfirmDialog
          open={confirmDiscard}
          title="¿Salir sin guardar?"
          description="Los cambios no se aplicarán al programa activo."
          confirmLabel="Salir sin guardar"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            setEditing(false);
            populate(context);
          }}
        />
        <ConfirmDialog
          open={confirmClose}
          title="¿Programar el cierre?"
          description="No podrás editar el programa después de confirmar. Los beneficios se conservarán sólo hasta la fecha final de canje."
          confirmLabel="Programar cierre"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => void closeProgram()}
        />
        <ConfirmDialog
          open={confirmCancel}
          title="¿Cancelar el cierre programado?"
          description="El programa vuelve a estar activo y se limpian las fechas de cierre."
          confirmLabel="Cancelar cierre"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => void cancelClose()}
        />
      </div>
    </main>
  );
}
