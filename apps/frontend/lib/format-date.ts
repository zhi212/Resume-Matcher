const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `new Date('2025-01-02')` is UTC midnight, which reads as Jan 1 west of UTC: a bare date is a calendar day, so build it locally. */
function toDate(value: string | number | Date): Date {
  if (typeof value === 'string') {
    const m = DATE_ONLY.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return value instanceof Date ? value : new Date(value);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** One formatter per locale and options: building one is far costlier than formatting, and lists call this once per row. */
function formatterFor(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(locale, options);
    } catch {
      formatter = new Intl.DateTimeFormat('en', options);
    }
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Formats a date in the UI locale. Returns '' for missing or invalid input. */
export function formatDate(
  value: string | number | Date | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_OPTIONS
): string {
  if (value === null || value === undefined || value === '') return '';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatterFor(locale, options).format(date);
}

/** Convert a stored ISO timestamp to the local value accepted by `datetime-local`. */
export function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** Convert a `datetime-local` value to the UTC ISO string persisted by the API. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
