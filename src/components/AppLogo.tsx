interface Props {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: "h-7 w-7", icon: 14, text: "text-sm" },
  md: { box: "h-8 w-8", icon: 16, text: "text-[0.9375rem]" },
  lg: { box: "h-10 w-10", icon: 20, text: "text-lg" },
};

export function AppLogo({
  size = "md",
  showWordmark = true,
  className = "",
}: Props) {
  const s = sizes[size];

  return (
    <span className={`brand-lockup ${className}`}>
      <span className={`brand-mark ${s.box}`} aria-hidden>
        <svg
          viewBox="0 0 32 32"
          fill="none"
          width={s.icon}
          height={s.icon}
          className="brand-mark-svg"
        >
          <defs>
            <linearGradient
              id="logo-grad"
              x1="6"
              y1="26"
              x2="26"
              y2="6"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#8B7CF8" />
              <stop offset="1" stopColor="#5EEAD4" />
            </linearGradient>
          </defs>
          <circle cx="9" cy="21" r="2.25" fill="url(#logo-grad)" />
          <circle cx="16" cy="11" r="2.25" fill="url(#logo-grad)" />
          <circle cx="23" cy="18" r="2.25" fill="url(#logo-grad)" />
          <path
            d="M9 21 L16 11 L23 18"
            stroke="url(#logo-grad)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className={`brand-wordmark ${s.text}`}>
          m<span className="brand-wordmark-accent">App</span>
        </span>
      )}
    </span>
  );
}
