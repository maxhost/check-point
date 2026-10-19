"use client";
import { useSearchParams } from "next/navigation";
import type { PosLocationV2 } from "../contracts";
import { MeasuredConsole } from "./measured-console";

export function PosEntry({ locations }: { locations: PosLocationV2[] }) {
  const requested = useSearchParams().get("location");
  const selected = locations.find((location) => location.id === requested);
  const initialLocations = selected
    ? [selected, ...locations.filter((location) => location.id !== selected.id)]
    : locations;
  return <MeasuredConsole locations={initialLocations} />;
}
