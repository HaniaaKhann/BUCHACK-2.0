export function DemoBanner(): React.JSX.Element {
  return (
    <div
      role="note"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900"
    >
      Demo data. Outlet names and hours are from HKBU&apos;s public pages. Menus, prices and wait
      times are simulated, and walk times marked &quot;est.&quot; are estimates. Not affiliated with
      HKBU Estates Office or its caterers.
    </div>
  );
}
