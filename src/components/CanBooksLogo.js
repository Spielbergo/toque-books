export default function CanBooksLogo({ size = 32, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="NorthBooks"
      className={className}
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="#4f46e5" />

      {/* Maple leaf — realistic curved shape */}
      <path
        d="M50,8 C50,8 55,16 57,18 C60,20 68,16 70,19 C72,22 66,28 65,31 C64,34 73,30 77,34 C81,38 73,43 72,46 C71,49 82,46 86,51 C90,56 80,59 78,62 C76,65 82,72 78,74 C74,76 67,70 64,69 C61,68 60,78 57,81 C54,84 50,82 50,82 C50,82 46,84 43,81 C40,78 39,68 36,69 C33,70 26,76 22,74 C18,72 24,65 22,62 C20,59 10,56 14,51 C18,46 29,49 28,46 C27,43 19,38 23,34 C27,30 36,34 35,31 C34,28 28,22 30,19 C32,16 40,20 43,18 C45,16 50,8 50,8Z"
        fill="white"
      />

      {/* Ledger lines — bookkeeping signature */}
      <line x1="22" y1="52" x2="78" y2="52" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="62" x2="72" y2="62" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
