// Passwordless account recovery by OTP/SMS (spec 0032). Split by concern into
// ./recovery/* to stay within the file-size budget; every `from
// "./consumer/recovery"` import resolves here unchanged.
export { requestRecovery, resendRecovery } from "./recovery/deliver";
export {
  verifyRecovery,
  completeRecoveryProfile,
  type VerifyRecoveryResult,
} from "./recovery/verify";
