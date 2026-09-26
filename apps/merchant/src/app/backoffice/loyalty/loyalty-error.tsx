import { Alert, ApiError, Button } from "../../../ui";
import type { LoyaltyApiError } from "./loyalty-api";
export function LoyaltyError({
  error,
  isOwner,
  onRead,
  onVerified,
}: {
  error: LoyaltyApiError;
  isOwner: boolean;
  onRead: () => void;
  onVerified?: () => void;
}) {
  const code = error.code;
  if (
    code === "unauthorized" ||
    code === "not_owner" ||
    code === "business_suspended" ||
    code === "business_closed" ||
    (code === "email_not_verified" && isOwner)
  )
    return (
      <div className="loyalty-fields">
        <ApiError
          code={code}
          suspensionReason={isOwner ? error.suspensionReason : undefined}
          onLogin={() => window.location.assign("/login")}
          onBack={() => window.location.assign("/backoffice")}
          onHome={() => window.location.assign("/backoffice")}
          onEmailVerified={onVerified}
        />
        <Button variant="secondary" onPress={onRead}>
          Consultar programa
        </Button>
      </div>
    );
  return (
    <Alert kind="error" title={error.message}>
      {code === "not_member" || code === "missing_permission" ? (
        <a href="/backoffice">Volver al Backoffice</a>
      ) : (
        <Button variant="secondary" onPress={onRead}>
          {error.uncertain || code === "program_exists"
            ? "Consultar programa"
            : "Reintentar lectura"}
        </Button>
      )}
    </Alert>
  );
}
