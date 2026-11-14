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
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'quiet' }): React.JSX.Element {
  const palette =
    tone === 'primary'
      ? 'bg-neutral-900 text-white hover:bg-neutral-700'
      : 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100';
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${palette} ${className}`}
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
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100'
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
      {hint ? <span className="text-xs text-neutral-600">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'w-full min-w-0 max-w-full rounded-md border border-neutral-300 px-3 py-2 text-sm';

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
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
      {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function ErrorNote({ message }: { message: string | null }): React.JSX.Element | null {
  if (message === null) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
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
        checked ? 'bg-neutral-900' : 'bg-neutral-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
