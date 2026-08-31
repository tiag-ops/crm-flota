-- Fase 2: metricas SEO diarias (GSC + pulse SEO)
CREATE TABLE IF NOT EXISTS seo_daily (
  slug        TEXT NOT NULL,
  dia         TEXT NOT NULL,
  clicks      INTEGER,
  impressions INTEGER,
  position    REAL,
  robots_ok   INTEGER,
  sitemap_ok  INTEGER,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slug, dia),
  FOREIGN KEY (slug) REFERENCES sites(slug)
);
