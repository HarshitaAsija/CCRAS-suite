"use client";

export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className="drop-shadow-[0_0_10px_rgba(124,92,255,0.55)] flex-shrink-0"
    >
      <defs>
        <linearGradient id="krita-orbit" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <g stroke="url(#krita-orbit)" strokeWidth="1.4" fill="none" opacity="0.9">
        <ellipse cx="20" cy="20" rx="17" ry="7" />
        <ellipse cx="20" cy="20" rx="17" ry="7" transform="rotate(60 20 20)" />
        <ellipse cx="20" cy="20" rx="17" ry="7" transform="rotate(120 20 20)" />
      </g>
      <circle cx="20" cy="20" r="3.4" fill="url(#krita-orbit)" />
      <circle cx="20" cy="20" r="1.3" fill="#f5f3ff" />
    </svg>
  );
}
