// Small shared parts for the poster templates (spec 0041). Kept tiny and pure.

/** Inlines the pre-styled QR SVG string. Safe: the SVG is generated server-side by us
 * (lib `qrcode`) + client transforms in qr-render.ts — never raw user input. */
export function QrBlock({ svg, className }: { svg: string; className?: string }) {
  return (
    <div
      className={`poster-qr ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Logo (public path) or a monogram fallback built from the business name. */
export function PosterLogo({
  logoPath,
  businessName,
  className,
}: {
  logoPath: string | null;
  businessName: string;
  className?: string;
}) {
  if (logoPath) {
    return (
      <img
        className={`poster-logo ${className ?? ""}`}
        src={logoPath}
        alt={businessName}
      />
    );
  }
  return (
    <span className={`poster-logo poster-logo-mono ${className ?? ""}`}>
      {businessName.slice(0, 2).toUpperCase()}
    </span>
  );
}
