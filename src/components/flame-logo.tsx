/** Fiamma animata della schermata di avvio (tre strati con sfumature e tremolio). */
export function FlameLogo({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 96 120"
      aria-hidden="true"
      className="flame-logo drop-shadow-[0_10px_30px_rgba(255,200,80,0.55)]"
    >
      <defs>
        <linearGradient id="flame-outer" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff6a00" />
          <stop offset="55%" stopColor="#ffa31a" />
          <stop offset="100%" stopColor="#ffd84d" />
        </linearGradient>
        <linearGradient id="flame-middle" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ffb21a" />
          <stop offset="100%" stopColor="#fff176" />
        </linearGradient>
        <radialGradient id="flame-core" cx="50%" cy="75%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#fff9c4" />
          <stop offset="100%" stopColor="#ffe082" />
        </radialGradient>
      </defs>
      <path
        className="flame-logo__outer"
        fill="url(#flame-outer)"
        d="M48 4c4 18 22 28 26 50 4 22-8 44-26 50C30 98 18 82 20 62c1-12 8-20 12-30 2 10 6 14 10 16-2-16 0-30 6-44z"
      />
      <path
        className="flame-logo__middle"
        fill="url(#flame-middle)"
        d="M50 40c2 12 14 20 16 34 2 14-6 26-18 28-12-2-20-12-18-26 1-8 6-12 8-18 2 6 4 8 7 9-1-10 1-19 5-27z"
      />
      <path
        className="flame-logo__core"
        fill="url(#flame-core)"
        d="M49 66c1 7 8 11 9 19 1 8-4 14-10 15-6-1-10-6-9-13 1-5 4-7 5-10 1 3 2 4 4 5 0-6 0-11 1-16z"
      />
    </svg>
  );
}
