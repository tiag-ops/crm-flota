import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "CRM Flota",
  description: "Panel de la flota de webs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-line bg-panel/60 px-3 py-4 sticky top-0 h-screen">
            <Link href="/" className="flex items-center gap-2 px-2 py-1.5 mb-6">
              <span className="grid size-7 place-items-center rounded-md bg-accent/15 text-accent font-bold text-sm">
                F
              </span>
              <span className="font-semibold tracking-tight">Flota CRM</span>
            </Link>

            <nav className="flex flex-col gap-0.5 text-sm">
              <Link
                href="/"
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-muted hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
                Dashboard
              </Link>
              <Link
                href="/tareas"
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-muted hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                Tareas
              </Link>
            </nav>

            <div className="mt-auto px-2 text-[11px] text-muted/60 leading-relaxed">
              Flota: SueldoNeto · Redito · Maternidad
              <br />
              CRM v2 · Cloudflare Pages
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0 px-5 md:px-8 py-6 md:py-8 max-w-6xl mx-auto">
            {/* Mobile nav */}
            <div className="md:hidden flex items-center gap-4 mb-6">
              <span className="grid size-7 place-items-center rounded-md bg-accent/15 text-accent font-bold text-sm">F</span>
              <Link href="/" className="text-sm text-muted">Dashboard</Link>
              <Link href="/tareas" className="text-sm text-muted">Tareas</Link>
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
