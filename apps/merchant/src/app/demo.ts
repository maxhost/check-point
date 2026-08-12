export type LoyaltyProgramDemo = {
  status: "inactive" | "active";
  type: "points" | "stamps" | null;
  pointUnitSingular: string;
  pointUnitPlural: string;
  stampUnitName: string;
  stampTarget: number;
  stampImageName: string;
};

export type DemoState = {
  ownerName: string;
  email: string;
  plan: "pilot" | "trial";
  businessName: string;
  logo: string;
  colors: { primary: string; complementary: string; accent: string };
  loyaltyProgram: LoyaltyProgramDemo;
  timezone: string;
  applyTimezoneToAllLocations: boolean;
  branches: {
    id?: string;
    name: string;
    address: string;
    status?: "active" | "archived";
    timezone?: string;
  }[];
};
export const key = "merchant-demo";
export const empty: DemoState = {
  ownerName: "",
  email: "",
  plan: "pilot",
  businessName: "",
  logo: "",
  colors: { primary: "#176548", complementary: "#2d8b68", accent: "#e78132" },
  loyaltyProgram: {
    status: "inactive",
    type: null,
    pointUnitSingular: "Punto",
    pointUnitPlural: "Puntos",
    stampUnitName: "Sello",
    stampTarget: 10,
    stampImageName: "",
  },
  timezone: "America/Guayaquil",
  applyTimezoneToAllLocations: true,
  branches: [{ name: "", address: "" }],
};
export function save(state: DemoState) {
  sessionStorage.setItem(key, JSON.stringify(state));
}
export function read(): DemoState | null {
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const stored = JSON.parse(item) as Partial<DemoState>;
    return {
      ...empty,
      ...stored,
      colors: { ...empty.colors, ...stored.colors },
      loyaltyProgram: { ...empty.loyaltyProgram, ...stored.loyaltyProgram },
    };
  } catch {
    return null;
  }
}
