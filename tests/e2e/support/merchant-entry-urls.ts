import { merchantURL } from "./ports";

/**
 * Spec 0205 — LAS DOS PUERTAS DEL ONBOARDING DEL COMERCIO, en UN solo lugar para la e2e. La
 * entrada abre en LOGIN; el alta va con `?signup=1`. Antes cada spec escribia la URL a mano y la
 * 0205 dejo dos e2e rojas en el pre-push (fixture del alta y landing, 2026-10-11): si la entrada
 * vuelve a cambiar, se cambia ACA.
 */
export const merchantLoginURL = `${merchantURL}/es/business/onboarding`;
export const merchantSignupURL = `${merchantLoginURL}?signup=1`;
