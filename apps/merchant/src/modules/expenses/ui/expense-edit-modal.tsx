"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  ConfirmDialog,
  Form,
  FormActions,
  Text,
} from "../../../ui";
import { StaffFormModal } from "../../../app/backoffice/staff/staff-form-modal";
import {
  panelRequest,
  PanelRequestError,
} from "../../../app/backoffice/panel-request";
import type { Expense, ExpenseConcept, ExpenseContext } from "../types";
import { ExpenseLineFields } from "./expense-line-fields";
import {
  confirmedLine,
  errorMessage,
  fromExpense,
  operationFor,
} from "./expenses-model";

export function ExpenseEditModal({
  expense,
  context,
  onClose,
  onSaved,
}: {
  expense: Expense;
  context: ExpenseContext;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [base, setBase] = useState(expense);
  const [line, setLine] = useState(() => fromExpense(expense));
  const [concepts, setConcepts] = useState<ExpenseConcept[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | "refresh" | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  const operation = useRef<ReturnType<typeof operationFor> | null>(null);
  const historicalContext = {
    ...context,
    currencyCode: base.currencyCode,
    minorUnit: base.minorUnit,
    timeZone: base.paymentTimeZone,
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void panelRequest<{ concepts: ExpenseConcept[] }>(
      "/api/modules/expenses/concepts",
    )
      .then((data) => {
        if (active) {
          setConcepts(data.concepts);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  let validation = "";
  try {
    if (!concepts) throw new Error("Espera a que se carguen los conceptos.");
    confirmedLine(line, historicalContext, concepts);
  } catch (cause) {
    validation = errorMessage(cause);
  }

  async function mutate(kind: "save" | "delete") {
    if (
      lock.current ||
      conflict ||
      (kind === "save" && (validation || !concepts))
    )
      return;
    lock.current = true;
    setBusy(kind);
    setError(null);
    try {
      const body =
        kind === "delete"
          ? { expectedRevision: base.revision }
          : {
              expectedRevision: base.revision,
              expectedCurrencyCode: base.currencyCode,
              ...confirmedLine(line, historicalContext, concepts!),
            };
      operation.current = operationFor(operation.current, {
        kind,
        id: base.id,
        ...body,
      });
      await panelRequest(
        `/api/modules/expenses/entries/${encodeURIComponent(base.id)}`,
        kind === "delete" ? "DELETE" : "PUT",
        { operationId: operation.current.id, ...body },
      );
      if (mounted.current) onSaved();
    } catch (cause) {
      if (mounted.current) {
        setError(errorMessage(cause));
        setDeleting(false);
        setConflict(
          cause instanceof PanelRequestError &&
            [
              "expense_conflict",
              "currency_conflict",
              "expense_not_found",
            ].includes(cause.code ?? ""),
        );
        if (
          cause instanceof PanelRequestError &&
          cause.code === "operation_conflict"
        )
          operation.current = null;
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy("refresh");
    try {
      // The current version may have moved to another day or local.
      const data = await panelRequest<{ expenses: Expense[] }>(
        "/api/modules/expenses/entries",
      );
      if (!mounted.current) return;
      const current = data.expenses.find((entry) => entry.id === base.id);
      if (!current) {
        onSaved();
        return;
      }
      setBase(current);
      setLine(fromExpense(current));
      setConflict(false);
      setError(null);
      operation.current = null;
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  return (
    <StaffFormModal
      open
      eyebrow="Gastos"
      title="Editar gasto"
      description="Puedes corregir pagos de cualquier mes. Se conserva su moneda original."
      onClose={() => {
        if (!lock.current) onClose();
      }}
      dismissible={!busy && !deleting}
    >
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          void mutate("save");
        }}
      >
        <Text variant="small">
          Moneda: {base.currencyCode} · Zona del pago: {base.paymentTimeZone}
        </Text>
        {error && <Alert kind="error" title={error} />}
        {!concepts && !error && <Text>Cargando conceptos…</Text>}
        {!concepts && error && (
          <Button
            variant="secondary"
            onPress={() => setAttempt((value) => value + 1)}
          >
            Reintentar conceptos
          </Button>
        )}
        {conflict && (
          <Alert
            kind="warning"
            title="El gasto cambió. Tus correcciones siguen aquí."
          >
            <Text>
              Para continuar, carga la versión actual. Esto reemplazará las
              correcciones de este formulario. Si ya se borró, volverás al
              registro.
            </Text>
            <Button
              variant="secondary"
              isDisabled={!!busy}
              onPress={() => void refresh()}
            >
              Cargar versión actual
            </Button>
          </Alert>
        )}
        <ExpenseLineFields
          line={line}
          context={historicalContext}
          concepts={concepts ?? []}
          patch={(changes) => {
            if (!lock.current)
              setLine((current) => ({ ...current, ...changes }));
          }}
          isDisabled={!!busy || deleting}
        />
        {validation && <Text variant="small">{validation}</Text>}
        <FormActions>
          <Button
            variant="danger"
            isDisabled={!!busy || conflict}
            onPress={() => setDeleting(true)}
          >
            Borrar gasto
          </Button>
          <Button variant="secondary" isDisabled={!!busy} onPress={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={busy === "save"}
            isDisabled={!!busy || !!validation || conflict}
          >
            Guardar cambios
          </Button>
        </FormActions>
      </Form>
      <ConfirmDialog
        isOpen={deleting}
        title="Borrar gasto"
        description={`Se borrará ${base.name} del registro. Esta acción conserva su historial.`}
        confirmLabel="Borrar gasto"
        intent="danger"
        isBusy={busy === "delete"}
        onCancel={() => {
          if (!lock.current) setDeleting(false);
        }}
        onConfirm={() => void mutate("delete")}
      />
    </StaffFormModal>
  );
}
