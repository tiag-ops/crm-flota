"use client";

import { useCallback, useEffect, useState } from "react";
import type { Overview, Tarea } from "@/lib/types";

function fmtFecha(ts: string): string {
  return new Date(ts + (ts.endsWith("Z") ? "" : "Z")).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TareasPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [nueva, setNueva] = useState("");
  const [slugFiltro, setSlugFiltro] = useState("todas");
  const [err, setErr] = useState(false);

  const load = useCallback(() => {
    fetch("/api/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function conToken(method: string, url: string, body?: unknown) {
    let token = localStorage.getItem("crm_token");
    if (!token) {
      token = prompt("Token de escritura (CRM_TOKEN):") ?? "";
      if (!token) return;
      localStorage.setItem("crm_token", token);
    }
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401) {
      localStorage.removeItem("crm_token");
      alert("Token inválido. Se pide de nuevo en el próximo cambio.");
    }
    return res;
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nueva.trim()) return;
    const res = await conToken("POST", "/api/tareas", { titulo: nueva.trim() });
    if (res?.ok) {
      setNueva("");
      load();
    }
  }

  async function toggle(t: Tarea) {
    if (t.hecha) return;
    await conToken("PATCH", `/api/tareas/${t.id}`);
    load();
  }

  if (err) return <p className="text-muted text-sm">Error cargando tareas.</p>;
  if (!data) return <p className="text-muted text-sm animate-pulse">Cargando…</p>;

  const sitios = [{ slug: "todas", nombre: "Todas" }, ...data.sites.map((s) => ({ slug: s.slug, nombre: s.nombre }))];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tareas</h1>
        <p className="text-sm text-muted">
          {data.tareas.length} abiertas · {data.hechas.length} completadas (últimas 20)
        </p>
      </div>

      {/* Nueva tarea */}
      <form onSubmit={crear} className="flex gap-2">
        <input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          placeholder="Nueva tarea…"
          className="flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-accent/60 transition-colors"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          Añadir
        </button>
      </form>

      {/* Filtro */}
      <div className="flex flex-wrap gap-1.5">
        {sitios.map((s) => (
          <button
            key={s.slug}
            onClick={() => setSlugFiltro(s.slug)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              slugFiltro === s.slug
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-line text-muted hover:text-foreground hover:border-muted/40"
            }`}
        >
          {s.nombre}
        </button>
        ))}
      </div>

      {/* Lista abiertas */}
      <div className="rounded-xl border border-line bg-panel divide-y divide-line/50 overflow-hidden">
        {data.tareas.filter((t) => slugFiltro === "todas" || t.slug === slugFiltro).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Sin tareas abiertas 🎉</p>
        ) : (
          data.tareas
            .filter((t) => slugFiltro === "todas" || t.slug === slugFiltro)
            .map((t) => (
              <label key={t.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggle(t)}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{t.titulo}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {t.slug ? data.sites.find((s) => s.slug === t.slug)?.nombre ?? t.slug : "General"} · {fmtFecha(t.creada)}
                    </p>
                </div>
              </label>
            ))
        )}
      </div>

      {/* Completadas */}
      {data.hechas.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground transition-colors select-none">
            Completadas ({data.hechas.length}) — desplegar
          </summary>
          <div className="mt-2 rounded-xl border border-line bg-panel divide-y divide-line/50 overflow-hidden">
            {data.hechas.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-emerald-400">✓</span>
                <p className="text-sm text-muted line-through flex-1 truncate">{t.titulo}</p>
                <span className="text-xs text-muted/60">{fmtFecha(t.creada)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
