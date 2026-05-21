import { todayIso } from "@/lib/date";
import type { DayRecord, HabitProfile, IsoDate, SetEntry } from "@/lib/types";

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
    return JSON.parse(raw) as LocalState;
  } catch {
    return defaultState;
  }
}

export function saveLocalState(state: LocalState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createLocalSetEntry(date: IsoDate, position: number, duration: number): SetEntry {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    user_id: "local",
    log_date: date,
    position,
    duration_seconds: duration,
    completed_at: now,
    created_at: now
  };
}
