/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface LogoIconProps {
  className?: string;
}

export default function LogoIcon({ className = "w-6 h-6" }: LogoIconProps) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`${className} select-none shrink-0`}
    >
      {/* Tilted Open Clapper Top */}
      <g transform="translate(10, 10) rotate(-16 10 32)">
        {/* Main top bar */}
        <rect x="0" y="8" width="80" height="18" rx="5" />
        {/* Slanted stripe cuts */}
        <path d="M12 8 L22 26 H15 L5 8 Z" fill="black" />
        <path d="M30 8 L40 26 H33 L23 8 Z" fill="black" />
        <path d="M48 8 L58 26 H51 L41 8 Z" fill="black" />
        <path d="M66 8 L76 26 H69 L59 8 Z" fill="black" />
      </g>
      
      {/* Bottom Slate */}
      <g transform="translate(10, 42)">
        {/* Main bottom rounded container */}
        <rect x="0" y="0" width="80" height="48" rx="8" />
        {/* Top band stripes in the bottom slate */}
        <rect x="0" y="0" width="80" height="15" fill="currentColor" />
        <path d="M12 0 L22 15 H15 L5 0 Z" fill="black" />
        <path d="M30 0 L40 15 H33 L23 0 Z" fill="black" />
        <path d="M48 0 L58 15 H51 L41 0 Z" fill="black" />
        <path d="M66 0 L76 15 H69 L59 0 Z" fill="black" />
        {/* Horizontal dividing line */}
        <rect x="0" y="15" width="80" height="3" fill="black" />
      </g>
    </svg>
  );
}
