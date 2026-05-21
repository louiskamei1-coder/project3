"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clampDuration, clampGoal, getCompletionRate, getStreak, todayIso } from "@/lib/date";
import { createLocalSetEntry, loadLocalState, normalizeSetEntry, saveLocalState } from "@/lib/local-store";
import { getSupabaseClient } from "@/lib/supabase";
import type { DayPart, DayRecord, HabitProfile, IsoDate, Stats, SyncState } from "@/lib/types";

const DEFAULT_GOAL = 4;
const DEFAULT_DURATION = 60;

type ProfileSettings = Pick<HabitProfile, "daily_goal" | "set_duration_seconds">;
type SetDetails = {
  name: string;
  dayPart: DayPart;
};

function emptyDay(date: IsoDate, targetSets: number): DayRecord {
  return {
    date,
    targetSets,
    notes: "",
    completedSets: []
  };
}

function sortDays(days: DayRecord[]): DayRecord[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeDay(days: DayRecord[], day: DayRecord): DayRecord[] {
  const existing = days.filter((record) => record.date !== day.date);
  return sortDays([...existing, day]);
}

export function useThumbTrack() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileSettings>({
    daily_goal: DEFAULT_GOAL,
    set_duration_seconds: DEFAULT_DURATION
  });
  const [days, setDays] = useState<DayRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<IsoDate>(todayIso());
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseClient(), []);

  const today = todayIso();

  const persistLocal = useCallback((nextProfile: ProfileSettings, nextDays: DayRecord[]) => {
    saveLocalState({
      profile: nextProfile,
      days: nextDays
    });
  }, []);

  const loadRemoteData = useCallback(async () => {
    if (!supabase) {
      const local = loadLocalState();
      const ensuredToday =
        local.days.find((record) => record.date === today) ?? emptyDay(today, local.profile.daily_goal);
      const nextDays = mergeDay(local.days, ensuredToday);
      setProfile(local.profile);
      setDays(nextDays);
      persistLocal(local.profile, nextDays);
      setSyncState("local");
      return;
    }

    setSyncState("connecting");
    setError(null);

    const sessionResult = await supabase.auth.getSession();
    let activeUserId = sessionResult.data.session?.user.id ?? null;

    if (!activeUserId) {
      const { data, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError || !data.user) {
        setError(signInError?.message ?? "Could not start an anonymous Supabase session.");
        setSyncState("error");
        return;
      }
      activeUserId = data.user.id;
    }

    setUserId(activeUserId);

    const { data: existingProfile, error: profileSelectError } = await supabase
      .from("habit_profiles")
      .select("daily_goal,set_duration_seconds")
      .eq("user_id", activeUserId)
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
          user_id: activeUserId,
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
      .eq("user_id", activeUserId)
      .eq("log_date", today)
      .maybeSingle();

    if (logSelectError) {
      setError(logSelectError.message);
      setSyncState("error");
      return;
    }

    let logRow = existingLog;

    if (!logRow) {
      const { data: insertedLog, error: logInsertError } = await supabase
        .from("daily_logs")
        .insert({
          user_id: activeUserId,
          log_date: today,
          target_sets: nextProfile.daily_goal,
          notes: ""
        })
        .select("*")
        .single();

      if (logInsertError || !insertedLog) {
        setError(logInsertError?.message ?? "Could not prepare today's log.");
        setSyncState("error");
        return;
      }

      logRow = insertedLog;
    }

    const { data: logs, error: logsError } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", activeUserId)
      .order("log_date", { ascending: true });

    const { data: entries, error: entriesError } = await supabase
      .from("set_entries")
      .select("*")
      .eq("user_id", activeUserId)
      .order("position", { ascending: true });

    if (logsError || entriesError || !logs || !entries) {
      setError(logsError?.message ?? entriesError?.message ?? "Could not load progress history.");
      setSyncState("error");
      return;
    }

    const nextDays = logs.map<DayRecord>((log) => ({
      date: log.log_date,
      targetSets: log.target_sets,
      notes: log.notes ?? "",
      completedSets: entries.filter((entry) => entry.log_date === log.log_date).map((entry) => normalizeSetEntry(entry))
    }));

    const hasToday = nextDays.some((day) => day.date === today);
    setProfile(nextProfile);
    setDays(hasToday ? nextDays : mergeDay(nextDays, emptyDay(today, logRow.target_sets)));
    setSyncState("synced");
  }, [persistLocal, supabase, today]);

  useEffect(() => {
    void loadRemoteData();
  }, [loadRemoteData]);

  const todayRecord = days.find((record) => record.date === today) ?? emptyDay(today, profile.daily_goal);
  const selectedRecord =
    days.find((record) => record.date === selectedDate) ?? emptyDay(selectedDate, profile.daily_goal);

  const stats: Stats = useMemo(
    () => ({
      streak: getStreak(days),
      totalSets: days.reduce((sum, record) => sum + record.completedSets.length, 0),
      weeklyCompletionRate: getCompletionRate(days, 7, profile.daily_goal),
      monthlyCompletionRate: getCompletionRate(days, 30, profile.daily_goal)
    }),
    [days, profile.daily_goal]
  );

  const updateGoal = useCallback(
    async (value: number) => {
      const dailyGoal = clampGoal(value);
      const nextProfile = { ...profile, daily_goal: dailyGoal };
      const nextToday = {
        ...todayRecord,
        targetSets: dailyGoal,
        completedSets: todayRecord.completedSets.filter((entry) => entry.position <= dailyGoal)
      };
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

      if (profileResult.error || logResult.error || trimResult.error) {
        setError(profileResult.error?.message ?? logResult.error?.message ?? trimResult.error?.message ?? "Could not save goal.");
        setSyncState("error");
      }
    },
    [days, persistLocal, profile, supabase, today, todayRecord, userId]
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

  const toggleSet = useCallback(
    async (position: number, durationSeconds = profile.set_duration_seconds, details?: SetDetails) => {
      const existing = todayRecord.completedSets.find((entry) => entry.position === position);
      const setName = details?.name.trim() || `Set ${position}`;
      const dayPart = details?.dayPart ?? "morning";
      const nextCompleted = existing
        ? todayRecord.completedSets.filter((entry) => entry.position !== position)
        : [...todayRecord.completedSets, createLocalSetEntry(today, position, durationSeconds, setName, dayPart)];
      const nextToday = {
        ...todayRecord,
        completedSets: nextCompleted.sort((a, b) => a.position - b.position)
      };
      const nextDays = mergeDay(days, nextToday);

      setDays(nextDays);

      if (!supabase || !userId) {
        persistLocal(profile, nextDays);
        return;
      }

      const result = existing
        ? await supabase
            .from("set_entries")
            .delete()
            .eq("user_id", userId)
            .eq("log_date", today)
            .eq("position", position)
        : await supabase.from("set_entries").insert({
            user_id: userId,
            log_date: today,
            position,
            set_name: setName,
            day_part: dayPart,
            duration_seconds: durationSeconds
          });

      if (result.error) {
        setError(result.error.message);
        setSyncState("error");
      }
    },
    [days, persistLocal, profile, supabase, today, todayRecord, userId]
  );

  const completeNextSet = useCallback(
    async (durationSeconds: number, details?: SetDetails) => {
      const nextPosition =
        Array.from({ length: todayRecord.targetSets }, (_, index) => index + 1).find(
          (position) => !todayRecord.completedSets.some((entry) => entry.position === position)
        ) ?? null;

      if (!nextPosition) {
        return;
      }

      await toggleSet(nextPosition, durationSeconds, details);
    },
    [todayRecord, toggleSet]
  );

  const updateNotes = useCallback(
    async (date: IsoDate, notes: string) => {
      const day = days.find((record) => record.date === date) ?? emptyDay(date, profile.daily_goal);
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
    stats,
    updateGoal,
    updateDuration,
    toggleSet,
    completeNextSet,
    updateNotes,
    reload: loadRemoteData
  };
}
