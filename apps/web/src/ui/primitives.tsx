import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

export function Button({
  tone = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'strong' | 'quiet';
}): React.JSX.Element {
  const palette =
    tone === 'primary'
      ? 'bg-berry text-white hover:bg-berry/90'
      : tone === 'strong'
        ? 'bg-navy text-cream hover:bg-navy/90'
        : 'border border-navy/60 bg-white text-navy hover:bg-navy/10';
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition-[background-color,transform] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${palette} ${className}`}
      {...props}
    />
  );
}

export function ToggleChip({
  selected,
  children,
  onToggle,
}: {
  selected: boolean;
  children: ReactNode;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`rounded-full border px-3 py-1 text-sm ${
        selected
          ? 'border-navy bg-navy text-cream'
          : 'border-navy/60 bg-white text-navy hover:bg-navy/10'
      }`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputClass = 'w-full min-w-0 max-w-full rounded-md border border-navy/60 px-3 py-2 text-sm';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return <input className={inputClass} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return <select className={inputClass} {...props} />;
}

export function Card({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-navy/15 p-4">
      {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function ErrorNote({ message }: { message: string | null }): React.JSX.Element | null {
  if (message === null) return null;
  return (
    <p role="alert" className="rounded-md bg-white px-3 py-2 text-sm text-berry">
      {message}
    </p>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-navy' : 'border border-navy/60 bg-white'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${
          checked ? 'left-[22px] bg-cream' : 'left-0.5 bg-navy'
        }`}
      />
    </button>
  );
}

export function AppHeader({
  left,
  right,
}: {
  left: ReactNode;
  right?: ReactNode;
}): React.JSX.Element {
  return (
    <header className="bg-navy text-cream">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span data-logo-slot aria-hidden="true" className="block h-11 w-11 shrink-0" />
          {left}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2 sm:gap-3">{right}</div> : null}
      </div>
      <div className="h-1 bg-sky" />
    </header>
  );
}
