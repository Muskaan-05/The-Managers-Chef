/**
 * Date formatting and parsing utilities for The Manager's Chef Frontend
 */

export function parseDateToISO(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput.toISOString();
  if (typeof dateInput !== 'string') return null;

  const trimmed = dateInput.trim();
  if (!trimmed) return null;

  // 1. Direct standard parse
  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime()) && (trimmed.includes('-') || trimmed.includes('/'))) {
    return direct.toISOString();
  }

  // 2. Relative parsing for "Today", "Tomorrow"
  const now = new Date();
  const lower = trimmed.toLowerCase();

  const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  let hours = 17;
  let minutes = 0;
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  }

  if (lower.includes('today')) {
    now.setHours(hours, minutes, 0, 0);
    return now.toISOString();
  }

  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1);
    now.setHours(hours, minutes, 0, 0);
    return now.toISOString();
  }

  // 3. Fallback to standard Date constructor
  if (!isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  // Default to today EOD if unparseable
  now.setHours(17, 0, 0, 0);
  return now.toISOString();
}

export function formatDisplayDate(isoStr, fallback = 'TBD') {
  if (!isoStr) return fallback;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${timeStr}`;
  if (isTomorrow) return `Tomorrow, ${timeStr}`;

  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

export function isDateOverdue(isoStr) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export function parseMeetingTimes(dateStr, timeStr) {
  const baseIso = parseDateToISO(dateStr || 'Today');
  const start = baseIso ? new Date(baseIso) : new Date();
  const end = new Date(start.getTime() + 45 * 60 * 1000); // 45 min default

  if (timeStr && typeof timeStr === 'string') {
    // Check for range like "10:30 AM - 11:15 AM"
    const parts = timeStr.split('-').map((s) => s.trim());
    const parseTimeComponent = (targetDate, tStr) => {
      const match = tStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3]?.toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        targetDate.setHours(h, m, 0, 0);
      }
    };

    if (parts[0]) parseTimeComponent(start, parts[0]);
    if (parts[1]) {
      parseTimeComponent(end, parts[1]);
    } else {
      end.setTime(start.getTime() + 45 * 60 * 1000);
    }
  }

  return {
    startTimeISO: start.toISOString(),
    endTimeISO: end.toISOString(),
  };
}

