"use client";

import { useState } from "react";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";
import { BottomNav, type WalletTab } from "./bottom-nav";
import { ProgramsTab } from "./programs-tab";
import { QrTab } from "./qr-tab";
import { SettingsTab } from "./settings-tab";

export function WalletShell({
  firstName,
  programs,
  initialTab,
  qrSvg,
  isIos,
  vapidPublicKey,
}: {
  firstName: string;
  programs: ConsumerProgramSummary[];
  initialTab: WalletTab;
  qrSvg: string;
  isIos: boolean;
  vapidPublicKey: string | null;
}) {
  const [activeTab, setActiveTab] = useState<WalletTab>(initialTab);
  // Las tres pestañas se eligen por `switch` y no con un ternario anidado: el ternario que
  // había servía para dos y con tres empieza a esconder cuál es el default.
  return (
    <main className="consumer-wallet-shell">
      <header>
        <p>CheckPass Club</p>
        <h1>¡Hola, {firstName}!</h1>
      </header>
      {activeTab === "programs" && <ProgramsTab programs={programs} />}
      {activeTab === "qr" && (
        <QrTab
          qrSvg={qrSvg}
          isIos={isIos}
          vapidPublicKey={vapidPublicKey}
          onSubscribed={() => setActiveTab("programs")}
        />
      )}
      {activeTab === "settings" && <SettingsTab programs={programs} />}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}
