import { todayIso } from "@/lib/date";
import type { DayPart, DayRecord, HabitProfile, IsoDate, SetEntry } from "@/lib/types";

type LocalState = {
  profile: Pick<HabitProfile, "daily_goal" | "set_duration_seconds">;
  days: DayRecord[];
};

const STORAGE_KEY = "thumbtrack-local-state";

const defaultState: LocalState = {
  profile: {
    daily_goal: 4,
    set_duration_seconds: 60
  },
  days: [
    {
      date: todayIso(),
      targetSets: 4,
      notes: "",
      completedSets: []
    }
  ]
};

export function loadLocalState(): LocalState {
  if (typeof window === "undefined") {
    return defaultState;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as LocalState;
    return {
      profile: parsed.profile,
      days: parsed.days.map((day) => ({
        ...day,
        completedSets: day.completedSets.map((entry) => normalizeSetEntry(entry))
      }))
    };
  } catch {
    return defaultState;
  }
}

export function saveLocalState(state: LocalState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function normalizeSetEntry(entry: SetEntry): SetEntry {
  return {
    ...entry,
    set_name: entry.set_name || `Set ${entry.position}`,
    day_part: entry.day_part || "morning"
  };
}

export function createLocalSetEntry(
  date: IsoDate,
  position: number,
  duration: number,
  setName: string,
  dayPart: DayPart
): SetEntry {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    user_id: "local",
    log_date: date,
    position,
    set_name: setName || `Set ${position}`,
    day_part: dayPart,
    duration_seconds: duration,
    completed_at: now,
    created_at: now
  };
}
