import { type ReactNode } from 'react';

export function Spinner({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-gray-500 dark:text-gray-400 ${compact ? '' : 'flex-col py-12'}`}>
      <div className={`${compact ? 'h-4 w-4 border-2' : 'h-8 w-8 border-4'} animate-spin rounded-full border-gray-300 border-t-brand-700`} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      {label}
    </span>
  );
}

export function EmptyState({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-lg font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        {icon ?? '-'}
      </div>
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
        Page {page} of {totalPages} - {total} record(s)
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
  size = 'md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'xl';
}) {
  if (!open) return null;

  const widthClass = size === 'xl' ? 'max-w-5xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`card w-full ${widthClass} max-h-[90vh] overflow-y-auto p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-400 hover:bg-slate-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-200"
            aria-label="Close modal"
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  loadingLabel = 'Processing...',
  tone = 'primary',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const confirmClass = tone === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={loading ? undefined : onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
            <span className="text-base font-semibold">i</span>
          </div>
          <div>
            <h2 id="confirm-title" className="text-base font-semibold text-gray-950 dark:text-gray-50">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm} disabled={loading}>
            {loading ? <InlineSpinner label={loadingLabel} /> : confirmLabel}
          </button>
        </div>
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
