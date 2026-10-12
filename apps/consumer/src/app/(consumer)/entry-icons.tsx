export function CheckPassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="100" fill="currentColor" />
      <path
        transform="translate(256 256) scale(0.68) translate(-256 -256)"
        d="M358 158C329 131 292 116 252 116C174 116 118 178 118 256C118 334 174 396 252 396C292 396 329 381 358 354"
        fill="none"
        stroke="#ffffff"
        strokeWidth="58"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EntryIcon({
  name,
  className,
}: {
  name: "check" | "share" | "add" | "arrow" | "person";
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "share" && (
        <path d="M12 15V3m-4 4 4-4 4 4M7 10H5v11h14V10h-2" />
      )}
      {name === "add" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M12 7v10M7 12h10" />
        </>
      )}
      {name === "arrow" && <path d="M5 12h14m-5-5 5 5-5 5" />}
      {name === "person" && (
        <>
          <circle cx="12" cy="8" r="4" fill="currentColor" stroke="none" />
          <path
            d="M4 21v-2a8 8 0 0 1 16 0v2"
            fill="currentColor"
            stroke="none"
          />
        </>
      )}
    </svg>
  );
}
