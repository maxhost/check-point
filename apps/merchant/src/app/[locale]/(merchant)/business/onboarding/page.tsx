import type { Metadata } from "next";
import { OnboardingWizard } from "./_components/onboarding-wizard";

export const metadata: Metadata = {
  title: "Creá tu negocio · CheckPass Club",
  description: "Activá tu programa de fidelización en tres pasos.",
};

export default function BusinessOnboardingPage() {
  return <OnboardingWizard />;
}
