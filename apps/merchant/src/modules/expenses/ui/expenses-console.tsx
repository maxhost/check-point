"use client";

import { useEffect, useState } from "react";
import { EditPencil, Plus } from "iconoir-react";
import { Alert, Button, Form, SelectField, Text, TextField } from "../../../ui";
import { ModuleHeader } from "../../../app/components/ui";
import {
  panelRequest,
  type PanelSession,
} from "../../../app/backoffice/panel-request";
import type { Expense, ExpenseContext } from "../types";
import { ExpensesInputModal } from "./expenses-input-modal";
import { ExpenseEditModal } from "./expense-edit-modal";
import {
  displayDay,
  errorMessage,
  localDay,
  moneyText,
  validDay,
} from "./expenses-model";

type Filters = { from: string; to: string; location: string };

export function ExpensesConsole() {
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">(
    "loading",
  );
  const [context, setContext] = useState<ExpenseContext | null>(null);
  const [entries, setEntries] = useState<Expense[] | null>(null);
  const [filters, setFilters] = useState<Filters>({
    from: "",
    to: "",
    location: "all",
  });
  const [query, setQuery] = useState<Filters | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setError(null);
    void panelRequest<PanelSession>("/api/merchant/session")
      .then(async (session) => {
        const allowed =
          session.authenticated &&
          session.business?.enabledModules.includes("expenses") &&
          (session.membership?.role === "owner" ||
            session.membership?.permissions.includes("expenses"));
        if (!active) return;
        if (!allowed) {
          setAccess("denied");
          return;
        }
        setAccess("allowed");
        const locationId = new URLSearchParams(window.location.search).get(
          "locationId",
        );
        const context = await panelRequest<ExpenseContext>(
          `/api/modules/expenses/context${locationId ? `?${new URLSearchParams({ locationId })}` : ""}`,
        );
        if (!active) return;
        setContext(context);
        const today = localDay(context.timeZone);
        const initial = {
          from: `${today.slice(0, 7)}-01`,
          to: today,
          location: "all",
        };
        setFilters(initial);
        setQuery(initial);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);
  useEffect(() => {
    if (!query || access !== "allowed") return;
    let active = true;
    setEntries(null);
    setError(null);
    const params = new URLSearchParams({ from: query.from, to: query.to });
    if (query.location !== "all") params.set("locationId", query.location);
    void panelRequest<{ expenses: Expense[] }>(
      `/api/modules/expenses/entries?${params}`,
    )
      .then((data) => {
        if (active) setEntries(data.expenses);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [query, attempt, access]);

  function applyFilters() {
    if (
      !validDay(filters.from) ||
      !validDay(filters.to) ||
      filters.from > filters.to
    ) {
      setFilterError(
        "Revisa el rango de fechas (AAAA-MM-DD), desde el primer día hasta el último.",
      );
      return;
    }
    setFilterError(null);
    setQuery({ ...filters });
  }
  function saved() {
    setRegistering(false);
    setEditing(null);
    setNotice(
      "Gastos actualizados. Si un pago queda fuera del rango, ajusta los filtros para verlo.",
    );
    setAttempt((value) => value + 1);
  }
  return (
    <main className="merchant-shell">
      <div className="brand-page catalog-page grid gap-6">
        <ModuleHeader
          eyebrow="Gastos"
          title="Gastos"
          description="Registra y revisa los pagos de tu negocio."
          closeHref="/backoffice"
        />
        {access === "denied" && <Text>No tienes acceso a Gastos.</Text>}
        {error && (
          <Alert kind="error" title={error}>
            <Button
              variant="secondary"
              onPress={() =>
                context
                  ? setAttempt((value) => value + 1)
                  : setLoadAttempt((value) => value + 1)
              }
            >
              Reintentar carga
            </Button>
          </Alert>
        )}
        {(access === "loading" || (access === "allowed" && !context)) &&
          !error && (
            <div role="status">
              <Text>Cargando gastos…</Text>
            </div>
          )}
        {access === "allowed" && context && (
          <>
            <div className="flex flex-wrap justify-end gap-3">
              <Button onPress={() => setRegistering(true)}>
                <Plus aria-hidden="true" className="size-5" />
                Registrar gasto
              </Button>
            </div>
            <Form
              aria-label="Filtrar gastos"
              className="gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                applyFilters();
              }}
            >
              <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <TextField
                  className="min-w-0 grid-cols-1"
                  label="Desde"
                  aria-describedby="expenses-filter-dates-help"
                  value={filters.from}
                  onChange={(from) =>
                    setFilters((current) => ({ ...current, from }))
                  }
                />
                <TextField
                  className="min-w-0 grid-cols-1"
                  label="Hasta"
                  aria-describedby="expenses-filter-dates-help"
                  value={filters.to}
                  onChange={(to) =>
                    setFilters((current) => ({ ...current, to }))
                  }
                />
                <SelectField
                  className="min-w-0 grid-cols-1"
                  label="Local del registro"
                  selectedKey={filters.location}
                  onSelectionChange={(key) =>
                    setFilters((current) => ({
                      ...current,
                      location: String(key ?? "all"),
                    }))
                  }
                  options={[
                    { id: "all", label: "Todos los locales y el negocio" },
                    ...context.locations.map((entry) => ({
                      id: entry.id,
                      label:
                        entry.name +
                        (entry.status === "archived" ? " · Archivado" : ""),
                    })),
                    { id: "business", label: "Todo el negocio" },
                  ]}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="min-w-0 self-end"
                >
                  Filtrar gastos
                </Button>
              </div>
              <Text variant="small" id="expenses-filter-dates-help">
                Fechas en formato AAAA-MM-DD. Incluye ambos días del rango.
              </Text>
              {filterError && <Alert kind="error" title={filterError} />}
            </Form>
            {notice && <Alert kind="success" title={notice} />}
            {!entries && !error && (
              <div role="status">
                <Text>Cargando registro…</Text>
              </div>
            )}
            {entries?.length === 0 && (
              <div className="grid gap-2">
                <Text>No hay pagos en este rango.</Text>
                <Text variant="muted">
                  Registra tu primer gasto por audio, foto o a mano, o cambia
                  los filtros para ver otros pagos.
                </Text>
              </div>
            )}
            {!!entries?.length && (
              <div
                role="list"
                aria-label="Registro de gastos"
                className="overflow-hidden rounded-lg border border-border bg-surface"
              >
                {entries.map((entry) => (
                  <div
                    role="listitem"
                    key={entry.id}
                    className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-4 md:px-6"
                  >
                    <div className="grid gap-1 md:col-span-2">
                      <Text variant="label" className="break-words">
                        {entry.name}
                      </Text>
                      <Text variant="small">
                        {
                          context.categories.find(
                            (category) => category.id === entry.category,
                          )?.label
                        }{" "}
                        · {entry.conceptName} ·{" "}
                        {entry.isFixed ? "Fijo" : "Variable"}
                      </Text>
                      <Text variant="small">
                        {entry.locationId === null
                          ? "Todo el negocio"
                          : (context.locations.find(
                              (local) => local.id === entry.locationId,
                            )?.name ?? "Local no disponible")}
                      </Text>
                    </div>
                    <div className="grid content-start gap-1">
                      <Text variant="label">
                        {moneyText(entry.amountMinor, entry.minorUnit)}{" "}
                        {entry.currencyCode}
                      </Text>
                      <Text variant="muted">{displayDay(entry.paidOn)}</Text>
                    </div>
                    <div className="flex items-start md:justify-end">
                      <Button
                        variant="quiet"
                        aria-label={`Editar ${entry.name}`}
                        onPress={() => setEditing(entry)}
                      >
                        <EditPencil aria-hidden="true" className="size-5" />
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {registering && (
              <ExpensesInputModal
                context={context}
                initialLocation={
                  filters.location !== "all"
                    ? filters.location
                    : (context.defaultLocationId ?? "")
                }
                onClose={() => setRegistering(false)}
                onSaved={saved}
              />
            )}
            {editing && (
              <ExpenseEditModal
                expense={editing}
                context={context}
                onClose={() => setEditing(null)}
                onSaved={saved}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
