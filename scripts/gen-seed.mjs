import { readFileSync, writeFileSync } from "node:fs";

const sites = JSON.parse(readFileSync("src/data/sites.json", "utf8"));
const esc = (s) => String(s ?? "").replace(/'/g, "''");
const stmts = sites.map(
  (s) =>
    `INSERT INTO sites (slug, nombre, url, repo, pages_project, estado, notas) VALUES ('${esc(s.slug)}', '${esc(s.nombre)}', '${esc(s.url)}', '${esc(s.repo)}', '${esc(s.pages_project)}', '${esc(s.estado)}', '${esc(s.notas)}') ON CONFLICT(slug) DO UPDATE SET nombre=excluded.nombre, url=excluded.url, repo=excluded.repo, pages_project=excluded.pages_project, estado=excluded.estado, notas=excluded.notas;`
);
writeFileSync("seed.sql", stmts.join("\n") + "\n");
console.log(`seed.sql: ${stmts.length} statements`);
