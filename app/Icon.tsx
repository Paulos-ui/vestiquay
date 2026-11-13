import type { SVGProps } from "react";

const paths = {
  position: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M7 15.5l3-3 2.5 2 4.5-5" />
    </>
  ),
  route: (
    <>
      <path d="M3 7h16m-4-4 4 4-4 4M21 17H5m4-4-4 4 4 4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" />
    </>
  ),
  guide: (
    <>
      <path d="M4 5h5a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H4zM20 5h-5a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h5z" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M4 8h16" />
      <path d="M15 9.5h6v5h-6a2.5 2.5 0 1 1 0-5zM15.5 12h.1" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </>
  ),
  diagonal: (
    <>
      <path d="M6 18 18 6M8 6h10v10" />
    </>
  ),
  down: (
    <>
      <path d="M12 4v15m-6-6 6 6 6-6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 7 3v5c0 4.3-2.5 7.8-7 10-4.5-2.2-7-5.7-7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8 4.5-8 4.5-8-4.5zM4 12l8 4.5 8-4.5M4 15.5l8 4.5 8-4.5" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v2" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4 10-10" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2m0 15v2m9.5-9.5h-2m-15 0h-2m16.2-6.7-1.4 1.4M6.7 17.3l-1.4 1.4m13.4 0-1.4-1.4M6.7 6.7 5.3 5.3" />
    </>
  ),
  moon: (
    <>
      <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  logout: (
    <>
      <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m3-12 4 4-4 4m-5-4h9" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
