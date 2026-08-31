import { Hono } from "hono";
import { requireToken } from "../../src/lib/auth";
import { checkInput } from "../../src/lib/validate";

const DAY = 86400000;

export const onRequest = async (context: any): Promise<Response> => {
  const app = new Hono();
  const db = context.env.DB;

  app.get("/api/sites", async () => {
    const sites = await db.prepare("SELECT * FROM sites ORDER BY nombre").all();
    return Response.json(sites.results);
  });

  app.get("/api/overview", async () => {
    const sites = await db.prepare("SELECT * FROM sites ORDER BY nombre").all();
    const checks = await db
      .prepare(
        `SELECT c.* FROM checks c
         JOIN (SELECT slug, MAX(ts) AS maxts FROM checks GROUP BY slug) m
         ON c.slug = m.slug AND c.ts = m.maxts`
      )
      .all();
    const tareas = await db
      .prepare("SELECT * FROM tareas WHERE hecha = 0 ORDER BY creada")
      .all();
    const hechas = await db
      .prepare("SELECT * FROM tareas WHERE hecha = 1 ORDER BY id DESC LIMIT 20")
      .all();
    const deployments = await db
      .prepare(
        `SELECT d.* FROM deployments d
         JOIN (SELECT slug, MAX(ts) AS maxts FROM deployments GROUP BY slug) m
         ON d.slug = m.slug AND d.ts = m.maxts`
      )
      .all();

    // Series 14 días (UTC, igual que date() en SQLite)
    const checksRows = (
      await db
        .prepare(
          `SELECT date(ts) AS dia,
             SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok,
             SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS fail
           FROM checks
           WHERE ts >= datetime('now', '-13 days')
           GROUP BY dia`
        )
        .all()
    ).results as any[];
    const deployRows = (
      await db
        .prepare(
          `SELECT date(ts) AS dia, COUNT(*) AS n
           FROM deployments
           WHERE ts >= datetime('now', '-13 days')
           GROUP BY dia`
        )
        .all()
    ).results as any[];
    const uptimeRows = (
      await db
        .prepare(
          `SELECT slug, ROUND(100.0 * SUM(ok) / COUNT(*), 1) AS pct
           FROM checks
           WHERE ts >= datetime('now', '-7 days')
           GROUP BY slug`
        )
        .all()
    ).results as any[];

    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      days.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
    }
    const okMap = Object.fromEntries(checksRows.map((r) => [r.dia, r.ok]));
    const failMap = Object.fromEntries(checksRows.map((r) => [r.dia, r.fail]));
    const depMap = Object.fromEntries(deployRows.map((r) => [r.dia, r.n]));

    return Response.json({
      sites: sites.results,
      checks: checks.results,
      tareas: tareas.results,
      hechas: hechas.results,
      deployments: deployments.results,
      series: {
        days,
        ok: days.map((d) => okMap[d] ?? 0),
        fail: days.map((d) => failMap[d] ?? 0),
        deploys: days.map((d) => depMap[d] ?? 0),
      },
      uptime_7d: Object.fromEntries(uptimeRows.map((r) => [r.slug, r.pct])),
    });
  });

  app.post("/api/checks", requireToken, async (c: any) => {
    const body = await c.req.json();
    const input = checkInput(body);
    await db
      .prepare("INSERT INTO checks (slug, http_status, ok) VALUES (?, ?, ?)")
      .bind(input.slug, input.http_status, input.ok)
      .run();
    return Response.json({ ok: true }, { status: 201 });
  });

  app.post("/api/deployments", requireToken, async (c: any) => {
    const body = await c.req.json();
    if (!body?.slug) return Response.json({ error: "slug requerido" }, { status: 400 });
    await db
      .prepare("INSERT INTO deployments (slug, commit_sha, fuente) VALUES (?, ?, ?)")
      .bind(body.slug, body.commit_sha ?? "", body.fuente ?? "manual")
      .run();
    return Response.json({ ok: true }, { status: 201 });
  });

  app.post("/api/tareas", requireToken, async (c: any) => {
    const body = await c.req.json();
    if (!body?.titulo) return Response.json({ error: "titulo requerido" }, { status: 400 });
    await db
      .prepare("INSERT INTO tareas (slug, titulo) VALUES (?, ?)")
      .bind(body.slug ?? null, body.titulo)
      .run();
    return Response.json({ ok: true }, { status: 201 });
  });

  app.patch("/api/tareas/:id", requireToken, async (c: any) => {
    await db
      .prepare("UPDATE tareas SET hecha = 1 WHERE id = ?")
      .bind(Number(c.req.param("id")))
      .run();
    return Response.json({ ok: true });
  });

  return app.fetch(context.request, context.env);
};
