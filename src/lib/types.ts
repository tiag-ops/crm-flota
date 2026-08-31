export interface Site {
  slug: string;
  nombre: string;
  url: string;
  repo: string;
  pages_project: string;
  estado: string;
  notas: string;
  updated_at: string;
}
export interface Check {
  slug: string;
  ts: string;
  http_status: number | null;
  ok: number;
}
export interface Tarea {
  id: number;
  slug: string | null;
  titulo: string;
  hecha: number;
  creada: string;
}
export interface Deployment {
  slug: string;
  ts: string;
  commit_sha: string;
  fuente: string;
}
export interface Overview {
  sites: Site[];
  checks: Check[];
  tareas: Tarea[];
  hechas: Tarea[];
  deployments: Deployment[];
  series: { days: string[]; ok: number[]; fail: number[]; deploys: number[] };
  uptime_7d: Record<string, number>;
}
