-- OAuth GitHub del panel: sesiones HttpOnly en D1 (solo hash del token, nunca el token crudo).
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash  TEXT PRIMARY KEY,
  login       TEXT NOT NULL,
  gh_user_id  INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones (expires_at);
