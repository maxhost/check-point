"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Form, Heading, Text, TextField } from "../../ui";
import { InlineApiError } from "../[locale]/(merchant)/business/onboarding/_components/wizard-shared";
import { PinField } from "./pin-field";
import { usePinLockout } from "./use-pin-lockout";
import {
  accessError,
  activeStaffSession,
  changeStaffPin,
  loginStaff,
  type StaffAccessError,
} from "./staff-access-api";

const notices: Record<string, string> = {
  staff_disabled: "Tu acceso no está activado.",
  business_suspended: "El negocio está suspendido.",
  business_closed: "El negocio está cerrado.",
  payment_required: "El acceso del negocio está pendiente de pago.",
};
const validPin = (pin: string) => /^\d{6}$/.test(pin);

type Stage = "login" | "loading" | "change" | "inactive";
export function StaffAccess({
  changePin = false,
  notice,
}: {
  changePin?: boolean;
  notice?: string;
}) {
  const [stage, setStage] = useState<Stage>(changePin ? "loading" : "login");
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [repeatedPin, setRepeatedPin] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [landing, setLanding] = useState("/backoffice");
  const [error, setError] = useState<StaffAccessError | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const mounted = useRef(false);
  const lockout = usePinLockout();
  const blocked = lockout.seconds > 0;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!changePin) return;
    let active = true;
    void activeStaffSession()
      .then((id) => {
        if (!active) return;
        if (!id) setStage("inactive");
        else {
          setUserId(id);
          setStage("change");
        }
      })
      .catch((cause) => {
        if (active) setError(accessError(cause));
      });
    return () => {
      active = false;
    };
  }, [changePin, attempt]);
  useEffect(() => {
    document.getElementById("staff-access-heading")?.focus();
  }, [stage]);

  function fail(cause: unknown) {
    const next = accessError(cause);
    setError(next);
    lockout.apply(next);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || blocked || !identifier.trim() || !validPin(pin)) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    let leaving = false;
    try {
      const staff = await loginStaff(identifier, pin);
      if (!mounted.current) return;
      const id = await activeStaffSession(staff.userId);
      if (!mounted.current) return;
      if (!id) {
        setPin("");
        setStage("inactive");
        return;
      }
      if (staff.mustChangePin) {
        setUserId(id);
        setLanding(staff.landing);
        setPin("");
        setStage("change");
      } else {
        window.location.assign(staff.landing);
        leaving = true;
      }
    } catch (cause) {
      if (mounted.current) fail(cause);
    } finally {
      lock.current = leaving;
      if (mounted.current && !leaving) setBusy(false);
    }
  }

  async function submitPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      lock.current ||
      blocked ||
      !userId ||
      !validPin(currentPin) ||
      !validPin(newPin) ||
      newPin !== repeatedPin
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    let leaving = false;
    try {
      await changeStaffPin(userId, currentPin, newPin);
      if (!mounted.current) return;
      window.location.assign(landing);
      leaving = true;
    } catch (cause) {
      if (mounted.current) fail(cause);
    } finally {
      lock.current = leaving;
      if (mounted.current && !leaving) setBusy(false);
    }
  }

  if (stage === "inactive")
    return (
      <Heading level={1} id="staff-access-heading" tabIndex={-1}>
        Tu acceso no está activado
      </Heading>
    );
  const noticeMessage =
    notice && Object.hasOwn(notices, notice) ? notices[notice] : null;
  const changing = stage === "change";
  const mismatch = repeatedPin.length > 0 && newPin !== repeatedPin;
  return (
    <>
      {noticeMessage && (
        <Alert kind="warning" title={noticeMessage} className="mb-5" />
      )}
      <Heading
        level={1}
        id="staff-access-heading"
        tabIndex={-1}
        className="mb-3"
      >
        {changing || stage === "loading"
          ? "Elige tu PIN"
          : "Entra como integrante del equipo"}
      </Heading>
      <Text variant="muted" className="mb-8">
        {changing || stage === "loading"
          ? "Cambia el PIN temporal por uno de 6 números."
          : "Usa el identificador y el PIN que te compartieron."}
      </Text>
      {stage === "loading" ? (
        <>
          <InlineApiError error={error} />
          {error ? (
            <>
              <Button
                fullWidth
                onPress={() => {
                  setError(null);
                  setAttempt((value) => value + 1);
                }}
              >
                Reintentar
              </Button>
              <Button
                variant="quiet"
                onPress={() => window.location.assign("/acceso-equipo")}
              >
                Volver al ingreso
              </Button>
            </>
          ) : (
            <Text variant="muted">Comprobando tu sesión…</Text>
          )}
        </>
      ) : (
        <Form onSubmit={changing ? submitPin : submitLogin}>
          <InlineApiError error={error} />
          {blocked && (
            <Text>
              Podrás reintentar en {lockout.seconds}{" "}
              {lockout.seconds === 1 ? "segundo" : "segundos"}.
            </Text>
          )}
          {changing ? (
            <>
              <PinField
                label="PIN actual"
                name="currentPin"
                value={currentPin}
                onChange={setCurrentPin}
                disabled={busy}
              />
              <PinField
                label="PIN nuevo"
                name="newPin"
                value={newPin}
                onChange={setNewPin}
                disabled={busy}
              />
              <PinField
                label="Repetir PIN nuevo"
                name="repeatedPin"
                value={repeatedPin}
                onChange={setRepeatedPin}
                disabled={busy}
                errorMessage={
                  mismatch ? "Los PIN nuevos no coinciden." : undefined
                }
              />
              <Button
                type="submit"
                fullWidth
                isLoading={busy}
                isDisabled={
                  busy ||
                  blocked ||
                  !validPin(currentPin) ||
                  !validPin(newPin) ||
                  !validPin(repeatedPin) ||
                  mismatch
                }
              >
                Guardar PIN y entrar
              </Button>
            </>
          ) : (
            <>
              <TextField
                label="Identificador"
                name="identifier"
                placeholder="Ej.: lucas@lafarmacia"
                value={identifier}
                onChange={setIdentifier}
                autoComplete="username"
                isRequired
                isDisabled={busy}
              />
              <PinField
                label="PIN"
                name="pin"
                value={pin}
                onChange={setPin}
                disabled={busy}
              />
              <Button
                type="submit"
                fullWidth
                isLoading={busy}
                isDisabled={
                  busy || blocked || !identifier.trim() || !validPin(pin)
                }
              >
                Entrar
              </Button>
            </>
          )}
        </Form>
      )}
    </>
  );
}
