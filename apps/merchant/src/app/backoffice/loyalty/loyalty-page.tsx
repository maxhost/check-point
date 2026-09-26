"use client";
import Link from "next/link";
import { ModuleHeader, Toast } from "../../components/ui";
import { Alert, Button } from "../../../ui";
import { ProgramClosing } from "./program-closing";
import { ProgramEditor } from "./program-editor";
import { ProgramView } from "./program-view";
import { LoyaltyConfirmDialog } from "./loyalty-confirm-dialog";
import { LoyaltyError } from "./loyalty-error";
import { LoyaltySkeleton } from "./ui";
import { useLoyaltyProgram } from "./use-loyalty-program";
export default function LoyaltyProgramPage({
  isOwner,
  canReadCatalog,
}: {
  isOwner: boolean;
  canReadCatalog: boolean;
}) {
  const vm = useLoyaltyProgram({ isOwner, canReadCatalog });
  const context = vm.context;
  if (!context && vm.loadError)
    return (
      <main className="merchant-shell">
        <div className="brand-page loyalty-page">
          <ModuleHeader
            eyebrow="Programa de fidelización"
            title="Tu programa de fidelización"
            description="Consultá y configurá los beneficios de tu negocio."
            closeHref="/backoffice"
          />
          <LoyaltyError
            error={vm.loadError}
            isOwner={isOwner}
            onRead={() => void vm.load()}
            onVerified={() => void vm.load()}
          />
        </div>
      </main>
    );
  if (!context) return <LoyaltySkeleton />;
  const editor = vm.editing || !vm.program;
  const closingForm =
    isOwner &&
    Boolean(vm.program) &&
    !vm.editing &&
    !vm.isClosing &&
    vm.closing;
  return (
    <main className="merchant-shell">
      <div className="brand-page loyalty-page">
        <Toast message={vm.notice} onDismiss={() => vm.setNotice(null)} />
        <ModuleHeader
          eyebrow="Programa de fidelización"
          title={
            closingForm
              ? "Programá el cierre"
              : editor
                ? vm.program
                  ? "Editá tu programa"
                  : "Creá tu programa"
                : "Tu programa de fidelización"
          }
          description={
            closingForm
              ? "Definí hasta cuándo se acumula y se puede canjear."
              : "Elegí cómo premiar a tus clientes."
          }
          closeHref="/backoffice"
          onClose={
            editor
              ? () => {
                  if (!vm.saving) vm.setConfirmDiscard(true);
                }
              : closingForm
                ? () => {
                    if (!vm.saving) vm.setClosing(false);
                  }
                : undefined
          }
        />
        {vm.refreshFailed && (
          <Alert
            kind="warning"
            title="Se guardó el cambio, pero no pudimos actualizar la vista"
          >
            <Button
              variant="secondary"
              onPress={() => void vm.load(false, true)}
              isLoading={vm.loading}
            >
              Actualizar vista
            </Button>
          </Alert>
        )}
        {vm.loadError && (
          <LoyaltyError
            error={vm.loadError}
            isOwner={isOwner}
            onRead={() => void vm.load(true)}
          />
        )}
        {vm.operationError && (
          <LoyaltyError
            error={vm.operationError}
            isOwner={isOwner}
            onRead={() => void vm.load(true)}
            onVerified={vm.clearAccessError}
          />
        )}
        {vm.errorToast && <Alert kind="error" title={vm.errorToast} />}
        {editor ? (
          <ProgramEditor vm={vm} />
        ) : closingForm ? (
          <ProgramClosing vm={vm} />
        ) : (
          <ProgramView vm={vm} />
        )}
        <p className="text-sm text-content-muted">
          <Link
            href="/backoffice"
            onClick={(event) => {
              if (vm.saving) {
                event.preventDefault();
                return;
              }
              if (editor) {
                event.preventDefault();
                vm.setConfirmDiscard(true);
              }
            }}
          >
            Volver al Backoffice
          </Link>
        </p>
        <LoyaltyConfirmDialog
          open={vm.confirmDiscard && !vm.saving}
          title="¿Salir sin guardar?"
          description="Vas a perder los cambios del borrador. No se aplicarán al programa."
          confirmLabel="Salir sin guardar"
          onCancel={() => vm.setConfirmDiscard(false)}
          onConfirm={() => {
            vm.setConfirmDiscard(false);
            if (vm.program) {
              vm.setEditing(false);
              vm.populate(context);
            } else window.location.assign("/backoffice");
          }}
        />
        <LoyaltyConfirmDialog
          open={isOwner && vm.confirmClose}
          title="¿Programar el cierre?"
          description={`Fin de acumulación: ${vm.earningEndsAt.replace("T", " ")}\nCanje hasta: ${vm.redemptionEndsAt.replace("T", " ")}\nZona horaria: ${vm.timezone}. No podrás editar el programa después de confirmar.`}
          confirmLabel="Programar cierre"
          onCancel={() => vm.setConfirmClose(false)}
          onConfirm={() => void vm.closeProgram()}
        />
        <LoyaltyConfirmDialog
          open={isOwner && vm.confirmCancel}
          title="¿Cancelar el cierre programado?"
          description="El programa vuelve a estar activo y se limpian las fechas de cierre."
          confirmLabel="Cancelar cierre"
          onCancel={() => vm.setConfirmCancel(false)}
          onConfirm={() => void vm.cancelClose()}
        />
      </div>
    </main>
  );
}
