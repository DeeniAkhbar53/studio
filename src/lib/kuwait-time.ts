type DateInput = string | number | Date;

const KUWAIT_TIME_ZONE = 'Asia/Kuwait';
const DISPLAY_LOCALE = 'en-US';

const kuwaitDateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: KUWAIT_TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const kuwaitDateTimeFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: KUWAIT_TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const floatingDateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const floatingDateTimeFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const FLOATING_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/;
const EXPLICIT_TIME_ZONE_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

const parseFloatingKuwaitDate = (value: string): Date | null => {
  if (EXPLICIT_TIME_ZONE_RE.test(value)) return null;

  const match = value.match(FLOATING_DATE_TIME_RE);
  if (!match) return null;

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ));
};

const parseAbsoluteDate = (value: DateInput): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatKuwaitDate = (value: DateInput): string => {
  if (typeof value === 'string') {
    const floatingDate = parseFloatingKuwaitDate(value);
    if (floatingDate) {
      return `${floatingDateFormatter.format(floatingDate)} (KWT)`;
    }
  }

  const date = parseAbsoluteDate(value);
  return date ? `${kuwaitDateFormatter.format(date)} (KWT)` : String(value || '');
};

export const formatKuwaitDateTime = (value: DateInput): string => {
  if (typeof value === 'string') {
    const floatingDate = parseFloatingKuwaitDate(value);
    if (floatingDate) {
      return `${floatingDateTimeFormatter.format(floatingDate)} KWT`;
    }
  }

  const date = parseAbsoluteDate(value);
  return date ? `${kuwaitDateTimeFormatter.format(date)} KWT` : String(value || '');
};
