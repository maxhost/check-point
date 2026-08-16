import { readableTextColor } from "../../../lib/brand-color";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";

export function PointsCard({ program }: { program: ConsumerProgramSummary }) {
  const color = readableTextColor(program.brandPrimaryColor);
  return (
    <div
      className="consumer-points-card"
      style={{
        background: `linear-gradient(135deg, ${program.brandPrimaryColor}, ${program.brandComplementaryColor})`,
        borderColor: program.brandAccentColor,
        color,
      }}
    >
      <div className="consumer-program-brand">
        {program.logoPath ? (
          <img src={program.logoPath} alt={`Logo de ${program.businessName}`} />
        ) : (
          <span aria-hidden="true">
            {program.businessName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <strong>{program.businessName}</strong>
      </div>
      <p className="consumer-points-balance">
        <b>{program.pointsBalance}</b> {program.unitName}
      </p>
    </div>
  );
}
