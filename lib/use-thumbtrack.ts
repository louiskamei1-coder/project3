"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clampDuration, clampGoal, getCompletionRate, getStreak, todayIso } from "@/lib/date";
import { createLocalSetEntry, loadLocalState, normalizeSetEntry, saveLocalState } from "@/lib/local-store";
import { getSupabaseClient } from "@/lib/supabase";
import type { DayPart, DayRecord, HabitProfile, IsoDate, SetEntry, Stats, SyncState } from "@/lib/types";

const DEFAULT_GOAL = 4;
const DEFAULT_DURATION = 60;

type ProfileSettings = Pick<HabitProfile, "daily_goal" | "set_duration_seconds">;
export type SetDraft = {
  name: string;
  dayPart: DayPart;
  durationSeconds: number;
};

function emptyDay(date: IsoDate, targetSets: number, duration = DEFAULT_DURATION): DayRecord {
  const sets = Array.from({ length: targetSets }, (_, index) =>
    createLocalSetEntry(date, index + 1, duration, `Set ${index + 1}`, "morning")
  );

  return {
    date,
    targetSets,
    notes: "",
    sets,
    completedSets: []
  };
}

function normalizeDay(day: DayRecord, fallbackDuration: number): DayRecord {
  const sets = ensureSetSlots(day.sets?.length ? day.sets : day.completedSets, day.targetSets, day.date, fallbackDuration);

  return {
    ...day,
    sets,
    completedSets: sets.filter((entry) => Boolean(entry.completed_at))
  };
}

function sortDays(days: DayRecord[]): DayRecord[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

function sortSets(sets: SetEntry[]): SetEntry[] {
  return [...sets].sort((a, b) => a.position - b.position);
}

function mergeDay(days: DayRecord[], day: DayRecord): DayRecord[] {
  const existing = days.filter((record) => record.date !== day.date);
  return sortDays([...existing, day]);
}

function ensureSetSlots(entries: SetEntry[], targetSets: number, date: IsoDate, duration: number): SetEntry[] {
  const byPosition = new Map(entries.map((entry) => [entry.position, normalizeSetEntry(entry)]));
  const next: SetEntry[] = [];

  for (let position = 1; position <= targetSets; position += 1) {
    next.push(byPosition.get(position) ?? createLocalSetEntry(date, position, duration, `Set ${position}`, "morning"));
  }

  return sortSets(next);
}

function withCompletedSets(day: DayRecord): DayRecord {
  const sets = sortSets(day.sets.map((entry) => normalizeSetEntry(entry)));
  return {
    ...day,
    targetSets: sets.length,
    sets,
    completedSets: sets.filter((entry) => Boolean(entry.completed_at))
  };
}

function makeSetDraft(position: number, draft: SetDraft): Omit<SetEntry, "id" | "user_id" | "created_at"> {
  return {
    log_date: todayIso(),
    position,
    set_name: draft.name.trim() || `Set ${position}`,
    day_part: draft.dayPart,
    duration_seconds: clampDuration(draft.durationSeconds),
    completed_at: null
  };
}

export function useThumbTrack() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileSettings>({
    daily_goal: DEFAULT_GOAL,
    set_duration_seconds: DEFAULT_DURATION
  });
  const [days, setDays] = useState<DayRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<IsoDate>(todayIso());
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const hasSupabase = Boolean(supabase);
  const today = todayIso();

  const persistLocal = useCallback((nextProfile: ProfileSettings, nextDays: DayRecord[]) => {
    saveLocalState({
      profile: nextProfile,
      days: nextDays
    });
  }, []);

  const loadLocalPreview = useCallback(() => {
    const local = loadLocalState();
    const normalizedDays = local.days.map((day) => normalizeDay(day, local.profile.set_duration_seconds));
    const storedToday = normalizedDays.find((record) => record.date === today);
    const ensuredToday = storedToday
      ? normalizeDay({ ...storedToday, targetSets: local.profile.daily_goal }, local.profile.set_duration_seconds)
      : emptyDay(today, local.profile.daily_goal, local.profile.set_duration_seconds);
    const nextDays = mergeDay(normalizedDays, ensuredToday);

    setProfile(local.profile);
    setDays(nextDays);
    persistLocal(local.profile, nextDays);
    setSyncState("local");
  }, [persistLocal, today]);

  const loadRemoteData = useCallback(async () => {
    if (!supabase) {
      loadLocalPreview();
      return;
    }

    setSyncState("connecting");
    setError(null);
    setAuthMessage(null);

    const sessionResult = await supabase.auth.getSession();
    const activeUser = sessionResult.data.session?.user ?? null;

    if (!activeUser) {
      setUserId(null);
      setUserEmail(null);
      loadLocalPreview();
      return;
    }

    setUserId(activeUser.id);
    setUserEmail(activeUser.email ?? null);

    const { data: existingProfile, error: profileSelectError } = await supabase
      .from("habit_profiles")
      .select("daily_goal,set_duration_seconds")
      .eq("user_id", activeUser.id)
      .maybeSingle();

    if (profileSelectError) {
      setError(profileSelectError.message);
      setSyncState("error");
      return;
    }

    let profileRow = existingProfile;

    if (!profileRow) {
      const { data: insertedProfile, error: profileInsertError } = await supabase
        .from("habit_profiles")
        .insert({
          user_id: activeUser.id,
          daily_goal: DEFAULT_GOAL,
          set_duration_seconds: DEFAULT_DURATION
        })
        .select("daily_goal,set_duration_seconds")
        .single();

      if (profileInsertError || !insertedProfile) {
        setError(profileInsertError?.message ?? "Could not create habit settings.");
        setSyncState("error");
        return;
      }

      profileRow = insertedProfile;
    }

    const nextProfile = {
      daily_goal: profileRow.daily_goal,
      set_duration_seconds: profileRow.set_duration_seconds
    };

    const { data: existingLog, error: logSelectError } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", activeUser.id)
      .eq("log_date", today)
      .maybeSingle();

    if (logSelectError) {
      setError(logSelectError.message);
      setSyncState("error");
      return;
    }

    if (!existingLog) {
      const { error: logInsertError } = await supabase.from("daily_logs").insert({
        user_id: activeUser.id,
        log_date: today,
        target_sets: nextProfile.daily_goal,
        notes: ""
      });

      if (logInsertError) {
        setError(logInsertError.message);
        setSyncState("error");
        return;
      }
    }

    const { data: logs, error: logsError } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", activeUser.id)
      .order("log_date", { ascending: true });

    const { data: entries, error: entriesError } = await supabase
      .from("set_entries")
      .select("*")
      .eq("user_id", activeUser.id)
      .order("position", { ascending: true });

    if (logsError || entriesError || !logs || !entries) {
      setError(logsError?.message ?? entriesError?.message ?? "Could not load progress history.");
      setSyncState("error");
      return;
    }

    let nextDays = logs.map<DayRecord>((log) => {
      const sets = sortSets(entries.filter((entry) => entry.log_date === log.log_date).map((entry) => normalizeSetEntry(entry)));

      return withCompletedSets({
        date: log.log_date,
        targetSets: log.target_sets,
        notes: log.notes ?? "",
        sets: ensureSetSlots(sets, log.target_sets, log.log_date, nextProfile.set_duration_seconds),
        completedSets: []
      });
    });

    const todayRecord = nextDays.find((day) => day.date === today) ?? emptyDay(today, nextProfile.daily_goal, nextProfile.set_duration_seconds);
    const missingRemoteSets = todayRecord.sets.filter((entry) => entry.user_id === "local");

    if (missingRemoteSets.length > 0) {
      const { error: missingInsertError } = await supabase.from("set_entries").insert(
        missingRemoteSets.map((entry) => ({
          user_id: activeUser.id,
          log_date: today,
          position: entry.position,
          set_name: entry.set_name,
          day_part: entry.day_part,
          duration_seconds: entry.duration_seconds,
          completed_at: entry.completed_at
        }))
      );

      if (missingInsertError) {
        setError(missingInsertError.message);
        setSyncState("error");
        return;
      }

      return loadRemoteData();
    }

    nextDays = mergeDay(nextDays, todayRecord);
    setProfile(nextProfile);
    setDays(nextDays);
    setSyncState("synced");
  }, [loadLocalPreview, supabase, today]);

  useEffect(() => {
    void loadRemoteData();
  }, [loadRemoteData]);

  const todayRecord = days.find((record) => record.date === today) ?? emptyDay(today, profile.daily_goal, profile.set_duration_seconds);
  const selectedRecord =
    days.find((record) => record.date === selectedDate) ?? emptyDay(selectedDate, profile.daily_goal, profile.set_duration_seconds);

  const stats: Stats = useMemo(
    () => ({
      streak: getStreak(days),
      totalSets: days.reduce((sum, record) => sum + record.completedSets.length, 0),
      weeklyCompletionRate: getCompletionRate(days, 7, profile.daily_goal),
      monthlyCompletionRate: getCompletionRate(days, 30, profile.daily_goal)
    }),
    [days, profile.daily_goal]
  );

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) {
        setError("Add Supabase environment variables before using sync.");
        setSyncState("error");
        return;
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError("Enter an email address to sync across devices.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin
        }
      });

      if (signInError) {
        setError(signInError.message);
        setSyncState("error");
        return;
      }

      setAuthMessage("Check your email for the ThumbTrack sign-in link.");
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setUserId(null);
    setUserEmail(null);
    loadLocalPreview();
  }, [loadLocalPreview, supabase]);

  const updateGoal = useCallback(
    async (value: number) => {
      const dailyGoal = clampGoal(value);
      const nextProfile = { ...profile, daily_goal: dailyGoal };
      const nextToday = withCompletedSets({
        ...todayRecord,
        targetSets: dailyGoal,
        sets: ensureSetSlots(todayRecord.sets, dailyGoal, today, profile.set_duration_seconds)
      });
      const nextDays = mergeDay(days, nextToday);

      setProfile(nextProfile);
      setDays(nextDays);

      if (!supabase || !userId) {
        persistLocal(nextProfile, nextDays);
        return;
      }

      const profileResult = await supabase
        .from("habit_profiles")
        .update({ daily_goal: dailyGoal })
        .eq("user_id", userId);
      const logResult = await supabase
        .from("daily_logs")
        .update({ target_sets: dailyGoal })
        .eq("user_id", userId)
        .eq("log_date", today);
      const trimResult = await supabase
        .from("set_entries")
        .delete()
        .eq("user_id", userId)
        .eq("log_date", today)
        .gt("position", dailyGoal);

      const localNewSets = nextToday.sets.filter((entry) => entry.user_id === "local");
      const insertResult =
        localNewSets.length > 0
          ? await supabase.from("set_entries").insert(
              localNewSets.map((entry) => ({
                user_id: userId,
                log_date: today,
                position: entry.position,
                set_name: entry.set_name,
                day_part: entry.day_part,
                duration_seconds: entry.duration_seconds,
                completed_at: entry.completed_at
              }))
            )
          : { error: null };

      if (profileResult.error || logResult.error || trimResult.error || insertResult.error) {
        setError(
          profileResult.error?.message ??
            logResult.error?.message ??
            trimResult.error?.message ??
            insertResult.error?.message ??
            "Could not save goal."
        );
        setSyncState("error");
      } else {
        void loadRemoteData();
      }
    },
    [days, loadRemoteData, persistLocal, profile, supabase, today, todayRecord, userId]
  );

  const updateDuration = useCallback(
    async (value: number) => {
      const duration = clampDuration(value);
      const nextProfile = { ...profile, set_duration_seconds: duration };
      setProfile(nextProfile);

      if (!supabase || !userId) {
        persistLocal(nextProfile, days);
        return;
      }

      const { error: updateError } = await supabase
        .from("habit_profiles")
        .update({ set_duration_seconds: duration })
        .eq("user_id", userId);

      if (updateError) {
        setError(updateError.message);
        setSyncState("error");
      }
    },
    [days, persistLocal, profile, supabase, userId]
  );

  const updateSet = useCallback(
    async (setId: string, updates: Partial<Pick<SetEntry, "set_name" | "day_part" | "duration_seconds">>) => {
      const nextSets = todayRecord.sets.map((entry) =>
        entry.id === setId
          ? {
              ...entry,
              ...updates,
              set_name: updates.set_name?.trim() || updates.set_name === "" ? updates.set_name : entry.set_name,
              duration_seconds:
                updates.duration_seconds === undefined ? entry.duration_seconds : clampDuration(updates.duration_seconds)
            }
          : entry
      );
      const nextToday = withCompletedSets({ ...todayRecord, sets: nextSets });
      const nextDays = mergeDay(days, nextToday);

      setDays(nextDays);

      if (!supabase || !userId) {
        persistLocal(profile, nextDays);
        return;
      }

      const entry = nextToday.sets.find((set) => set.id === setId);
      if (!entry) {
        return;
      }

      const { error: updateError } = await supabase
        .from("set_entries")
        .update({
          set_name: entry.set_name.trim() || `Set ${entry.position}`,
          day_part: entry.day_part,
          duration_seconds: entry.duration_seconds
        })
        .eq("id", setId)
        .eq("user_id", userId);

      if (updateError) {
        setError(updateError.message);
        setSyncState("error");
      }
    },
    [days, persistLocal, profile, supabase, todayRecord, userId]
  );

  const addSet = useCallback(
    async (draft: SetDraft) => {
      if (todayRecord.sets.length >= 48) {
        return;
      }

      const position = todayRecord.sets.length + 1;
      const draftSet = makeSetDraft(position, draft);
      const newEntry = createLocalSetEntry(today, position, draftSet.duration_seconds, draftSet.set_name, draftSet.day_part);
      const nextToday = withCompletedSets({
        ...todayRecord,
        sets: [...todayRecord.sets, newEntry]
      });
      const nextProfile = { ...profile, daily_goal: nextToday.targetSets };
      const nextDays = mergeDay(days, nextToday);

      setProfile(nextProfile);
      setDays(nextDays);

      if (!supabase || !userId) {
        persistLocal(nextProfile, nextDays);
        return;
      }

      const logResult = await supabase
        .from("daily_logs")
        .update({ target_sets: nextToday.targetSets })
        .eq("user_id", userId)
        .eq("log_date", today);
      const profileResult = await supabase
        .from("habit_profiles")
        .update({ daily_goal: nextToday.targetSets })
        .eq("user_id", userId);
      const insertResult = await supabase.from("set_entries").insert({
        user_id: userId,
        log_date: today,
        position,
        set_name: draftSet.set_name,
        day_part: draftSet.day_part,
        duration_seconds: draftSet.duration_seconds,
        completed_at: null
      });

      if (logResult.error || profileResult.error || insertResult.error) {
        setError(logResult.error?.message ?? profileResult.error?.message ?? insertResult.error?.message ?? "Could not add set.");
        setSyncState("error");
      } else {
        void loadRemoteData();
      }
    },
    [days, loadRemoteData, persistLocal, profile, supabase, today, todayRecord, userId]
  );

  const deleteSet = useCallback(
    async (setId: string) => {
      const remaining = todayRecord.sets
        .filter((entry) => entry.id !== setId)
        .map((entry, index) => ({ ...entry, position: index + 1 }));
      const nextToday = withCompletedSets({ ...todayRecord, sets: remaining });
      const nextProfile = { ...profile, daily_goal: Math.max(1, nextToday.targetSets) };
      const nextDays = mergeDay(days, nextToday);

      setProfile(nextProfile);
      setDays(nextDays);

      if (!supabase || !userId) {
        persistLocal(nextProfile, nextDays);
        return;
      }

      const deleteResult = await supabase.from("set_entries").delete().eq("id", setId).eq("user_id", userId);
      const reindexResults = [];
      for (const entry of remaining) {
        reindexResults.push(
          await supabase.from("set_entries").update({ position: entry.position }).eq("id", entry.id).eq("user_id", userId)
        );
      }
      const logResult = await supabase
        .from("daily_logs")
        .update({ target_sets: nextToday.targetSets })
        .eq("user_id", userId)
        .eq("log_date", today);
      const profileResult = await supabase
        .from("habit_profiles")
        .update({ daily_goal: nextProfile.daily_goal })
        .eq("user_id", userId);
      const firstError =
        deleteResult.error ?? reindexResults.find((result) => result.error)?.error ?? logResult.error ?? profileResult.error;

      if (firstError) {
        setError(firstError.message);
        setSyncState("error");
      } else {
        void loadRemoteData();
      }
    },
    [days, loadRemoteData, persistLocal, profile, supabase, today, todayRecord, userId]
  );

  const toggleSet = useCallback(
    async (setId: string) => {
      const entry = todayRecord.sets.find((set) => set.id === setId);
      if (!entry) {
        return;
      }

      const completedAt = entry.completed_at ? null : new Date().toISOString();
      const nextToday = withCompletedSets({
        ...todayRecord,
        sets: todayRecord.sets.map((set) => (set.id === setId ? { ...set, completed_at: completedAt } : set))
      });
      const nextDays = mergeDay(days, nextToday);

      setDays(nextDays);

      if (!supabase || !userId) {
        persistLocal(profile, nextDays);
        return;
      }

      const { error: updateError } = await supabase
        .from("set_entries")
        .update({ completed_at: completedAt })
        .eq("id", setId)
        .eq("user_id", userId);

      if (updateError) {
        setError(updateError.message);
        setSyncState("error");
      }
    },
    [days, persistLocal, profile, supabase, todayRecord, userId]
  );

  const completeSet = useCallback(
    async (setId: string) => {
      const entry = todayRecord.sets.find((set) => set.id === setId);
      if (!entry || entry.completed_at) {
        return;
      }

      await toggleSet(setId);
    },
    [todayRecord, toggleSet]
  );

  const updateNotes = useCallback(
    async (date: IsoDate, notes: string) => {
      const day = days.find((record) => record.date === date) ?? emptyDay(date, profile.daily_goal, profile.set_duration_seconds);
      const nextDay = { ...day, notes };
      const nextDays = mergeDay(days, nextDay);

      setDays(nextDays);

      if (!supabase || !userId) {
        persistLocal(profile, nextDays);
        return;
      }

      const { error: upsertError } = await supabase
        .from("daily_logs")
        .upsert(
          {
            user_id: userId,
            log_date: date,
            target_sets: nextDay.targetSets,
            notes
          },
          { onConflict: "user_id,log_date" }
        );

      if (upsertError) {
        setError(upsertError.message);
        setSyncState("error");
      }
    },
    [days, persistLocal, profile, supabase, userId]
  );

  return {
    profile,
    days,
    today,
    todayRecord,
    selectedDate,
    selectedRecord,
    setSelectedDate,
    syncState,
    error,
    authMessage,
    userEmail,
    hasSupabase,
    stats,
    signInWithEmail,
    signOut,
    updateGoal,
    updateDuration,
    updateSet,
    addSet,
    deleteSet,
    toggleSet,
    completeSet,
    updateNotes,
    reload: loadRemoteData
  };
}
