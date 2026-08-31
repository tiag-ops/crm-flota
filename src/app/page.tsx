"use client";

import { useEffect, useState } from "react";

interface Site { slug: string; nombre: string; url: string; repo: string; pages_project: string; estado: string; notas: string; }
interface Check { slug: string; ts: string; http_status: number | null; ok: number; }
interface Tarea { id: number; slug: string | null; titulo: string; hecha: number; creada: string; }
interface Deployment { slug: string; ts: string; commit_sha: string; fuente: string; }
interface Overview { sites: Site[]; checks: Check[]; tareas: Tarea[]; deployments: Deployment[]; }

const ESTADO_BADGE: Record<string, string> = {
  live: "bg-emerald-100 text-emerald-800",
  "pre-launch": "bg-amber-100 text-amber-800",
};

export default function Home() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/overview")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(String(e)));
  }

  useEffect(load, []);

  async function marcarHecha(id: number) {
    let token = localStorage.getItem("crm_token");
    if (!token) {
      token = prompt("Token de escritura (CRM_TOKEN):") ?? "";
      if (!token) return;
      localStorage.setItem("crm_token", token);
    }
    const r = await fetch(`/api/tareas/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      localStorage.removeItem("crm_token");
      alert(`Error ${r.status}: token inválido, se limpió. Recargá e intentá de nuevo.`);
      return;
    }
    load();
  }

  if (error) return <main className="p-8 text-base">Error cargando: {error}</main>;
  if (!data) return <main className="p-8 text-base">Cargando…</main>;

  const checkPorSlug = new Map(data.checks.map((c) => [c.slug, c]));
  const depPorSlug = new Map(data.deployments.map((d) => [d.slug, d]));

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-8">
      <h1 className="text-3xl font-bold">CRM Flota</h1>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Sitios ({data.sites.length})</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-sm uppercase tracking-wide text-zinc-500">
              <th className="p-2">Sitio</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Último check</th>
              <th className="p-2">Último deploy</th>
              <th className="p-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            {data.sites.map((s) => {
              const chk = checkPorSlug.get(s.slug);
              const dep = depPorSlug.get(s.slug);
              return (
                <tr key={s.slug} className="border-t border-zinc-200">
                  <td className="p-2 text-base">
                    {s.url
                      ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.nombre}</a>
                      : s.nombre}
                    <div className="text-sm text-zinc-500">{s.repo}</div>
                  </td>
                  <td className="p-2 text-base">
                    <span className={`rounded px-2 py-0.5 text-sm ${ESTADO_BADGE[s.estado] ?? "bg-zinc-100 text-zinc-700"}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="p-2 text-base">
                    {chk ? (chk.ok ? `✅ ${chk.http_status ?? ""}` : `❌ ${chk.http_status ?? "sin respuesta"}`) : "—"}
                  </td>
                  <td className="p-2 text-base">{dep ? `${dep.ts} (${dep.fuente})` : "—"}</td>
                  <td className="p-2 text-base">{s.notas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Tareas pendientes ({data.tareas.length})</h2>
        {data.tareas.length === 0 && <p className="text-base text-zinc-500">Sin tareas pendientes.</p>}
        <ul className="space-y-2">
          {data.tareas.map((t) => (
            <li key={t.id} className="flex items-center gap-3 text-base">
              <input type="checkbox" aria-label={`marcar ${t.titulo}`} onChange={() => marcarHecha(t.id)} />
              <span>{t.titulo}</span>
              {t.slug && <span className="text-sm text-zinc-500">[{t.slug}]</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
