export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 32 Q32 44 52 32 L48 28 Q32 38 16 28 Z" fill="#2dd4bf" />
      <rect x="31" y="16" width="3" height="14" rx="1.5" fill="#2dd4bf" />
      <path d="M34 18 L45 27 L34 27 Z" fill="#2dd4bf" />
      <path
        d="M14 46 Q20 49 26 46 Q32 43 38 46 Q44 49 50 46"
        stroke="#2dd4bf"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
