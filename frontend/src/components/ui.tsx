import { ReactNode } from 'react';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500 dark:text-gray-400">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-brand-700" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-4xl">{icon ?? '📭'}</div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
      {subtitle && <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        <span>{total} record(s)</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
      <span>
        Page {page} of {totalPages} · {total} record(s)
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary px-3 py-1" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Prev
        </button>
        <button
          className="btn-secondary px-3 py-1"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  REGULAR: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  CONTRACTUAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  CASUAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  JOB_ORDER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  COTERMINOUS: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  ONLINE: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  OFFLINE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  UNKNOWN: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  TIME_IN: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  TIME_OUT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
};

export function StatusBadge({ value }: { value: string }) {
  const cls = statusColors[value] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return <span className={`badge ${cls}`}>{value.replace(/_/g, ' ')}</span>;
}
