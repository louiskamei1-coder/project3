import type { DayRecord, IsoDate } from "@/lib/types";

export const MAX_DAILY_SETS = 48;

export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function parseIsoDate(value: IsoDate): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatFriendlyDate(value: IsoDate): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(parseIsoDate(value));
}

export function getMonthDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function getCompletionRate(records: DayRecord[], days: number, defaultTarget: number): number {
  const byDate = new Map(records.map((record) => [record.date, record]));
  const today = parseIsoDate(todayIso());
  let totalTarget = 0;
  let totalComplete = 0;

  for (let offset = 0; offset < days; offset += 1) {
    const iso = toIsoDate(addDays(today, -offset));
    const record = byDate.get(iso);
    totalTarget += record?.targetSets ?? defaultTarget;
    totalComplete += record?.completedSets.length ?? 0;
  }

  if (totalTarget === 0) {
    return 0;
  }

  return Math.min(100, Math.round((totalComplete / totalTarget) * 100));
}

export function getStreak(records: DayRecord[]): number {
  const byDate = new Map(records.map((record) => [record.date, record]));
  let cursor = parseIsoDate(todayIso());
  let streak = 0;

  while (true) {
    const iso = toIsoDate(cursor);
    const record = byDate.get(iso);

    if (!record || record.completedSets.length < record.targetSets) {
      return streak;
    }

    streak += 1;
    cursor = addDays(cursor, -1);
  }
}

export function clampGoal(value: number): number {
  return Math.max(1, Math.min(MAX_DAILY_SETS, Math.round(value)));
}

export function clampDuration(value: number): number {
  return Math.max(10, Math.min(600, Math.round(value)));
}
