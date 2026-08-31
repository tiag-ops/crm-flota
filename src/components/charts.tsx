"use client";

import { useMemo, useState } from "react";

/* ---------- Area chart (checks ok/fail, 14 días) ---------- */

export function AreaChart({
  days,
  ok,
  fail,
  height = 180,
}: {
  days: string[];
  ok: number[];
  fail: number[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = height;
  const PADX = 8;
  const PADY = 14;

  const max = Math.max(1, ...ok, ...fail);
  const n = days.length;

  const x = (i: number) => PADX + (i * (W - 2 * PADX)) / (n - 1);
  const y = (v: number) => H - PADY - (v * (H - 2 * PADY)) / max;

  const line = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = (arr: number[]) =>
    `${line(arr)} L${x(n - 1)},${H - PADY} L${x(0)},${H - PADY} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PADX) / (W - 2 * PADX)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        <defs>
          <linearGradient id="gOk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PADX}
            x2={W - PADX}
            y1={PADY + f * (H - 2 * PADY)}
            y2={PADY + f * (H - 2 * PADY)}
            stroke="var(--line)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
        ))}

        <path d={area(ok)} fill="url(#gOk)" />
        <path d={line(ok)} fill="none" stroke="#34d399" strokeWidth="2" />
        <path d={area(fail)} fill="url(#gFail)" />
        <path d={line(fail)} fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="4 3" />

        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PADY} y2={H - PADY} stroke="var(--muted)" strokeWidth="1" opacity="0.4" />
            <circle cx={x(hover)} cy={y(ok[hover])} r="3.5" fill="#34d399" />
            <circle cx={x(hover)} cy={y(fail[hover])} r="3" fill="#f87171" />
          </>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="font-medium">{days[hover]}</div>
          <div className="text-emerald-400">✓ {ok[hover]} ok</div>
          <div className="text-red-400">✗ {fail[hover]} fail</div>
        </div>
      )}

      <div className="mt-1 flex justify-between text-[10px] text-muted/70">
        <span>{days[0]}</span>
        <span>{days[Math.floor(n / 2)]}</span>
        <span>{days[n - 1]}</span>
      </div>
    </div>
  );
}

/* ---------- Bars (deploys por día) ---------- */

export function BarsChart({ days, values, height = 120 }: { days: string[]; values: number[]; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="group relative flex-1" title={`${days[i]}: ${v} deploy${v === 1 ? "" : "s"}`}>
          <div
            className="w-full rounded-sm bg-accent/70 transition-colors group-hover:bg-accent"
            style={{ height: `${Math.max(3, (v / max) * (height - 18))}px` }}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------- Donut de uptime por sitio ---------- */

export function Donut({ pct, size = 84 }: { pct: number; size?: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = pct >= 99 ? "#34d399" : pct >= 90 ? "#fbbf24" : "#f87171";
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className="-rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
      />
      <text x="40" y="40" textAnchor="middle" dominantBaseline="central" className="rotate-90" style={{ transformOrigin: "40px 40px", fontSize: 15, fontWeight: 600, fill: "var(--foreground)" }}>
        {pct}%
      </text>
    </svg>
  );
}
