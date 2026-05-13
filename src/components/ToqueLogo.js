export default function ToqueLogo({ size = 32, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Toque Books"
      className={className}
    >
      {/* Pompom shadow */}
      <circle cx="50" cy="13" r="9" fill="#1e1b4b" opacity="0.25"/>
      {/* Pompom */}
      <circle cx="50" cy="11" r="8" fill="#e0e7ff"/>
      {/* Pompom highlight */}
      <circle cx="47" cy="8" r="3" fill="white" opacity="0.45"/>

      {/* Toque dome */}
      <path d="M 14 68 C 14 36 28 13 50 11 C 72 13 86 36 86 68 Z" fill="#4f46e5"/>
      {/* Dome left highlight */}
      <path d="M 14 68 C 14 36 28 13 50 11 L 50 68 Z" fill="white" opacity="0.07"/>

      {/* Cuff band */}
      <rect x="10" y="68" width="80" height="22" rx="4" fill="#3730a3"/>

      {/* Rib / ledger lines */}
      <line x1="15" y1="75" x2="85" y2="75" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="15" y1="81" x2="85" y2="81" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="15" y1="86" x2="85" y2="86" stroke="#4f46e5" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  );
}
