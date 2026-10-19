"use client";
import { useSearchParams } from "next/navigation";
import type { PosLocationV2 } from "../contracts";
import { PosConsole } from "./pos-console";
import { MeasuredConsole } from "./measured-console";

export function PosEntry({
  locations,
  previewEnabled,
}: {
  locations: PosLocationV2[];
  previewEnabled: boolean;
}) {
  const params = useSearchParams();
  return previewEnabled && params.get("posV2") === "1" ? (
    <MeasuredConsole locations={locations} />
  ) : (
    <PosConsole locations={locations} />
  );
}
