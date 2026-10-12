import type { Metadata } from "next";
import { OnboardingWizard } from "./_components/onboarding-wizard";
import "./onboarding.css";

type EntryProps = {
  searchParams: Promise<{ signup?: string | string[] }>;
};

export async function generateMetadata({
  searchParams,
}: EntryProps): Promise<Metadata> {
  const signup = (await searchParams).signup === "1";
  return signup
    ? {
        title: "Crea tu negocio · CheckPass Club",
        description: "Crea tu negocio en tres pasos.",
      }
    : {
        title: "Entra a tu cuenta · CheckPass Club",
        description: "Entra a tu negocio con un código por email.",
      };
}

export default async function BusinessOnboardingPage({
  searchParams,
}: EntryProps) {
  return (
    <OnboardingWizard startWithSignup={(await searchParams).signup === "1"} />
  );
}
