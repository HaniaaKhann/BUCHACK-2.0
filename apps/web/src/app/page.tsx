const appName = process.env['APP_NAME'] ?? '[APP_NAME]';

export default function HomePage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        Demo data. Outlet names and hours are from HKBU&apos;s public pages. Menus, prices and wait
        times are simulated. Not affiliated with HKBU Estates Office or its caterers.
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">{appName}</h1>
      <p className="text-neutral-700">
        Campus food that is ready before your next class. The application is scaffolded — features
        land in the next milestones.
      </p>
    </main>
  );
}
