CREATE TABLE IF NOT EXISTS sites (
  slug TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  repo TEXT NOT NULL DEFAULT '',
  pages_project TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'pre-launch',
  notas TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL REFERENCES sites(slug),
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  http_status INTEGER,
  ok INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checks_slug_ts ON checks(slug, ts DESC);

CREATE TABLE IF NOT EXISTS deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL REFERENCES sites(slug),
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  commit_sha TEXT NOT NULL DEFAULT '',
  fuente TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS tareas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT REFERENCES sites(slug),
  titulo TEXT NOT NULL,
  hecha INTEGER NOT NULL DEFAULT 0,
  creada TEXT NOT NULL DEFAULT (datetime('now'))
);
