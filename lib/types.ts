export type IsoDate = string;
export type DayPart = "morning" | "midday" | "night";

export type HabitProfile = {
  user_id: string;
  daily_goal: number;
  set_duration_seconds: number;
  created_at: string;
  updated_at: string;
};

export type DailyLog = {
  id: string;
  user_id: string;
  log_date: IsoDate;
  target_sets: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type SetEntry = {
  id: string;
  user_id: string;
  log_date: IsoDate;
  position: number;
  set_name: string;
  day_part: DayPart;
  duration_seconds: number;
  completed_at: string;
  created_at: string;
};

export type DayRecord = {
  date: IsoDate;
  targetSets: number;
  notes: string;
  completedSets: SetEntry[];
};

export type Stats = {
  streak: number;
  totalSets: number;
  weeklyCompletionRate: number;
  monthlyCompletionRate: number;
};

export type SyncState = "connecting" | "synced" | "local" | "error";

export type Database = {
  public: {
    Tables: {
      habit_profiles: {
        Row: HabitProfile;
        Insert: {
          user_id: string;
          daily_goal?: number;
          set_duration_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          daily_goal?: number;
          set_duration_seconds?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_logs: {
        Row: DailyLog;
        Insert: {
          id?: string;
          user_id: string;
          log_date: IsoDate;
          target_sets?: number;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          target_sets?: number;
          notes?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      set_entries: {
        Row: SetEntry;
        Insert: {
          id?: string;
          user_id: string;
          log_date: IsoDate;
          position: number;
          set_name?: string;
          day_part?: DayPart;
          duration_seconds: number;
          completed_at?: string;
          created_at?: string;
        };
        Update: {
          set_name?: string;
          day_part?: DayPart;
          duration_seconds?: number;
          completed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
