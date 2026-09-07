-- Auth Google Sign-In: sesiones HttpOnly en D1 (solo hash del token, nunca el token crudo).
-- Reemplaza el esquema GitHub (tabla estaba vacía en prod; DROP es seguro).
DROP TABLE IF EXISTS sesiones;
CREATE TABLE sesiones (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  sub         TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones (expires_at);
