export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="px-6 py-5 border-b border-line">
        <span className="text-muted text-sm">Gestion de cabinet comptable</span>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-6 py-4 border-t border-line text-xs text-muted">
        Données hébergées au Maroc · Traitement déclaré à la CNDP · Accès tracé
      </footer>
    </div>
  );
}
