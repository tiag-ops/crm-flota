"use client";

import { useEffect, useMemo, useState } from "react";
import type { Overview, Site } from "@/lib/types";
import { AreaChart, BarsChart, Donut } from "@/components/charts";

const ESTADO_STYLE: Record<string, string> = {
  live: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "pre-launch": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  pausado: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function fmtTs(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts + (ts.endsWith("Z") ? "" : "Z"));
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  const kpis = useMemo(() => {
    if (!data) return null;
    const live = data.sites.filter((s) => s.estado === "live").length;
    const okNow = data.checks.filter((c) => c.ok === 1).length;
    const total = data.checks.length;
    const up7 = Object.values(data.uptime_7d);
    const upAvg = up7.length ? up7.reduce((a, b) => a + b, 0) / up7.length : 0;
    const half = 7;
    const prev = data.series.ok.slice(0, half).reduce((a, b) => a + b, 0);
    const last = data.series.ok.slice(half).reduce((a, b) => a + b, 0);
    const trend = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
    const deploys7 = data.series.deploys.slice(half).reduce((a, b) => a + b, 0);
    return { live, okNow, total, upAvg, trend, deploys7, pend: data.tareas.length };
  }, [data]);

  if (err) return <p className="text-muted text-sm">Error cargando /api/overview.</p>;
  if (!data) return <p className="text-muted text-sm animate-pulse">Cargando…</p>;

  const avgDeploys = (() => {
    const vals = data.series.deploys;
    const total = vals.reduce((a, b) => a + b, 0);
    return (total / vals.length).toFixed(1);
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">Estado de la flota en tiempo real</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-xs text-muted">Sitios live</p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis!.live}
            <span className="text-sm text-muted font-normal"> / {data.sites.length}</span>
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-xs text-muted">Uptime 7d</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {kpis!.upAvg.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-xs text-muted">Últimos checks OK</p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis!.okNow}
            <span className="text-sm text-muted font-normal"> / {kpis!.total}</span>
          </p>
          {kpis!.trend !== 0 && (
            <p className={`text-xs ${kpis!.trend > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {kpis!.trend > 0 ? "↑" : "↓"} {Math.abs(kpis!.trend)}% vs semana ant.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-xs text-muted">Tareas abiertas</p>
          <p className="mt-1 text-2xl font-semibold">{kpis!.pend}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium">Checks · últimos 14 días</h2>
            <div className="flex gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-emerald-400 inline-block" /> OK</span>
              <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-red-400 inline-block" /> Fail</span>
            </div>
          </div>
          <AreaChart days={data.series.days} ok={data.series.ok} fail={data.series.fail} />
        </div>

        <div className="rounded-xl border border-line bg-panel p-4 flex flex-col items-center justify-center">
          <h2 className="text-sm font-medium self-start mb-2">Uptime 7d promedio</h2>
          <Donut pct={Math.round(kpis!.upAvg)} />
          <p className="mt-2 text-xs text-muted">objetivo ≥ 99%</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Deploys · últimos 14 días</h2>
            <span className="text-[11px] text-muted">{avgDeploys}/día</span>
          </div>
          <BarsChart days={data.series.days} values={data.series.deploys} />
        </div>

        <div className="rounded-xl border border-line bg-panel p-4">
          <h2 className="text-sm font-medium mb-3">Sitios live</h2>
          <ul className="space-y-2">
            {data.sites.map((s) => {
              const chk = data.checks.find((c) => c.slug === s.slug);
              return (
              <li key={s.slug} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <i className={`size-1.5 rounded-full inline-block ${chk ? (chk.ok ? "bg-emerald-400" : "bg-red-400") : "bg-zinc-600"}`} />
                  {s.nombre}
                </span>
                <span className="text-xs text-muted font-mono">{data.uptime_7d[s.slug] ?? "—"}%</span>
              </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Fleet table */}
      <div className="rounded-xl border border-line bg-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="text-sm font-medium">Flota</h2>
          <span className="text-[11px] text-muted">{data.sites.length} sitios</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-line">
              <th className="px-4 py-2.5 font-medium">Sitio</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium">Uptime 7d</th>
              <th className="px-4 py-2.5 font-medium hidden md:table-cell">Último check</th>
              <th className="px-4 py-2.5 font-medium hidden md:table-cell">Último deploy</th>
            </tr>
          </thead>
          <tbody>
            {data.sites.map((s: Site) => {
              const check = data.checks.find((c) => c.slug === s.slug);
              const dep = data.deployments.find((d) => d.slug === s.slug);
              return (
                <tr key={s.slug} className="border-b border-line/50 last:border-0 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <a href={s.url || undefined} target="_blank" rel="noreferrer" className="font-medium hover:text-accent transition-colors">
                      {s.nombre}
                    </a>
                    {s.url && <span className="block text-xs text-muted font-mono">{s.url.replace("https://", "")}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${ESTADO_STYLE[s.estado] ?? ESTADO_STYLE["pausado"]}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{data.uptime_7d[s.slug] != null ? `${data.uptime_7d[s.slug]}%` : "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {check ? (
                      <span className="flex items-center gap-2">
                        <i className={`size-1.5 rounded-full inline-block ${check.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                        <span className="text-xs text-muted">{fmtTs(check.ts)} · {check.http_status ?? "err"}</span>
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {dep ? (
                      <span className="text-xs text-muted">
                        <span className="font-mono">{dep.commit_sha ? dep.commit_sha.slice(0, 7) : "—"}</span> · {fmtTs(dep.ts)}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
