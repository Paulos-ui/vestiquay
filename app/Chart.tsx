"use client";
import { useId } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
// Survey contours bend around two separate shores. Geometry is deterministic on server and client.
function coast(y: number, side: number) {
  return side === 0
    ? 115 +
        56 * Math.sin(y / 98) +
        25 * Math.sin(y / 34) +
        12 * Math.cos(y / 15)
    : 603 +
        33 * Math.cos(y / 85) -
        37 * Math.sin(y / 56) +
        18 * Math.sin(y / 26);
}
function shore(side: number, offset: number) {
  const vertices = [];
  for (let y = -30; y <= 550; y += 4) {
    const x =
      coast(y, side) +
      (side === 0 ? 1 : -1) *
        offset *
        (0.85 + 0.17 * Math.sin(y / 44 + offset / 90));
    vertices.push((vertices.length ? "L" : "M") + x.toFixed(1) + " " + y);
  }
  return vertices.join(" ");
}
export function Chart({ progress }: { progress: MotionValue<number> }) {
  const id = useId().replaceAll(":", ""),
    route =
      "M138 355 C214 347 235 294 285 274 S411 307 458 239 S504 160 573 131";
  const len = useTransform(progress, [0.08, 0.8], [0.18, 1]);
  return (
    <svg
      className="atlas"
      viewBox="0 0 680 510"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Illustration of the optional route from NEAR to USDC on Solana"
    >
      <defs>
        <linearGradient
          id={id + "routeGold"}
          x1="0%"
          x2="100%"
          y1="50%"
          y2="50%"
        >
          <stop stopColor="var(--teal)" />
          <stop offset=".55" stopColor="var(--mint)" />
          <stop offset="1" stopColor="var(--lime)" />
        </linearGradient>
        <pattern
          id={id + "g"}
          width="42"
          height="42"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M42 0H0V42"
            fill="none"
            stroke="var(--line-bright)"
            strokeOpacity=".26"
          />
        </pattern>
        <pattern
          id={id + "h"}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <path
            d="M0 0V6"
            stroke="var(--line-bright)"
            strokeWidth="2"
            opacity=".35"
          />
        </pattern>
      </defs>
      <rect width="680" height="510" fill="var(--surface-deep)" />
      {[0, 1].map((s) => (
        <g key={s}>
          {Array.from({ length: 26 }, (_, i) => (
            <path
              key={i}
              d={shore(s, i * 9)}
              fill="none"
              stroke={i % 5 === 0 ? "var(--line-bright)" : "var(--line)"}
              strokeWidth={i % 5 === 0 ? 1.2 : 0.8}
            />
          ))}
          <path
            d={
              shore(s, 0) +
              (s === 0 ? " L-10 550 L-10 -30Z" : " L690 550 L690 -30Z")
            }
            fill="var(--surface-raised)"
            stroke="var(--line-bright)"
            strokeWidth="2"
          />
          {Array.from({ length: 14 }, (_, i) => (
            <path
              key={i}
              d={shore(s, -i * 8)}
              fill="none"
              stroke="var(--line)"
              strokeWidth=".9"
            />
          ))}
        </g>
      ))}
      <rect width="680" height="510" fill={"url(#" + id + "g)"} />
      <g>
        <path
          d="M46 346l89-23 15 44-89 22z M505 120l58-18 9 24-59 19z"
          fill={"url(#" + id + "h)"}
          stroke="var(--line-bright)"
        />
        <path
          d="M135 347l34-8 3 10-35 9M534 132l37-10"
          stroke="var(--line-bright)"
          strokeWidth="3"
        />
      </g>
      <path
        d={route}
        fill="none"
        stroke="var(--line-bright)"
        strokeWidth="2"
        strokeDasharray="5 6"
      />
      <motion.path
        d={route}
        fill="none"
        stroke={"url(#" + id + "routeGold)"}
        strokeWidth="4"
        style={{ pathLength: len }}
      />
      {[
        [138, 355],
        [339, 274],
        [573, 131],
      ].map(([x, y], i) => (
        <g key={x}>
          <circle
            cx={x}
            cy={y}
            r="11"
            fill="var(--surface)"
            stroke="var(--mint)"
            strokeWidth="1.5"
          />
          <circle
            cx={x}
            cy={y}
            r="4"
            fill={i === 0 ? "var(--lime)" : "var(--mint)"}
          />
        </g>
      ))}
      <g
        fontFamily="monospace"
        fontSize="13"
        fill="var(--ink)"
        fontWeight="bold"
      >
        <text x="76" y="407">
          RHEA / NEAR
        </text>
        <text x="472" y="93">
          SOLANA
        </text>
      </g>
      <g transform="translate(607 403)" fill="var(--subtle)">
        <path d="M0 -29L9 4 0 0 -9 4Z" />
        <text y="-38" textAnchor="middle" fontSize="12" fontFamily="monospace">
          N
        </text>
      </g>
    </svg>
  );
}
