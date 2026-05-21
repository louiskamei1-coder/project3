"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  ClipboardCheck,
  Minus,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Target,
  TimerReset,
  Trash2,
  TrendingUp,
  WifiOff
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  formatFriendlyDate,
  getMonthDays,
  MAX_DAILY_SETS,
  monthKey,
  monthLabel,
  parseIsoDate,
  toIsoDate
} from "@/lib/date";
import { useThumbTrack, type SetDraft } from "@/lib/use-thumbtrack";
import type { DayPart, DayRecord, IsoDate, SetEntry, Stats, SyncState } from "@/lib/types";

const dayPartLabels: Record<DayPart, string> = {
  morning: "Morning",
  midday: "Midday",
  night: "Night"
};

const dayParts = Object.keys(dayPartLabels) as DayPart[];

function IconButton({
  label,
  children,
  onClick,
  disabled = false
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="icon-button" type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      {children}
    </button>
  );
}

function AuthPanel({
  hasSupabase,
  userEmail,
  message,
  onSignIn,
  onSignOut
}: {
  hasSupabase: boolean;
  userEmail: string | null;
  message: string | null;
  onSignIn: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");

  if (!hasSupabase) {
    return (
      <section className="auth-panel">
        <ShieldCheck size={18} />
        <span>Add Supabase env vars in Vercel to sync across your laptop and phone.</span>
      </section>
    );
  }

  if (userEmail) {
    return (
      <section className="auth-panel synced-auth">
        <ShieldCheck size={18} />
        <span>Syncing as {userEmail}</span>
        <button type="button" onClick={() => void onSignOut()}>
          Sign out
        </button>
      </section>
    );
  }

  return (
    <form
      className="auth-panel auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSignIn(email);
      }}
    >
      <ShieldCheck size={18} />
      <label htmlFor="sync-email">Sync on phone</label>
      <input
        id="sync-email"
        inputMode="email"
        placeholder="email@example.com"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit">Send link</button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}

function SyncPill({ state, error, onRetry }: { state: SyncState; error: string | null; onRetry: () => void }) {
  const label =
    state === "synced"
      ? "Supabase synced"
      : state === "local"
        ? "Local preview"
        : state === "error"
          ? "Sync issue"
          : "Connecting";

  return (
    <button className={`sync-pill ${state}`} type="button" onClick={onRetry} title={error ?? label}>
      {state === "local" || state === "error" ? <WifiOff size={15} /> : <RefreshCcw size={15} />}
      <span>{label}</span>
    </button>
  );
}

function StatsGrid({ stats }: { stats: Stats }) {
  const items = [
    { label: "Streak", value: `${stats.streak}d`, tone: "green" },
    { label: "Total sets", value: String(stats.totalSets), tone: "blue" },
    { label: "7-day", value: `${stats.weeklyCompletionRate}%`, tone: "gold" },
    { label: "30-day", value: `${stats.monthlyCompletionRate}%`, tone: "coral" }
  ];

  return (
    <section className="stats-grid" aria-label="Basic stats">
      {items.map((item) => (
        <div className={`stat-card ${item.tone}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}

function GoalSettings({
  goal,
  duration,
  onGoalChange,
  onDurationChange
}: {
  goal: number;
  duration: number;
  onGoalChange: (value: number) => void;
  onDurationChange: (value: number) => void;
}) {
  const presetDurations = [30, 45, 60, 90];

  return (
    <section className="panel settings-panel" aria-label="Habit settings">
      <div className="panel-title">
        <Settings2 size={18} />
        <h2>Daily Plan</h2>
      </div>
      <div className="setting-row">
        <div className="setting-label-line">
          <label htmlFor="daily-goal">Daily sets</label>
          <strong>{goal}</strong>
        </div>
        <div className="plan-actions">
          <button
            aria-label="Remove set"
            className="action-button danger"
            type="button"
            onClick={() => onGoalChange(goal - 1)}
            disabled={goal <= 1}
          >
            <Minus size={18} />
            <span>Remove</span>
          </button>
          <input
            id="daily-goal"
            inputMode="numeric"
            min={1}
            max={MAX_DAILY_SETS}
            type="number"
            value={goal}
            onChange={(event) => onGoalChange(Number(event.target.value))}
          />
          <button
            aria-label="Add set"
            className="action-button add"
            type="button"
            onClick={() => onGoalChange(goal + 1)}
            disabled={goal >= MAX_DAILY_SETS}
          >
            <Plus size={18} />
            <span>Add</span>
          </button>
        </div>
      </div>
      <p className="setting-hint">Up to {MAX_DAILY_SETS} sets per day.</p>
      <div className="setting-row">
        <div className="setting-label-line">
          <label htmlFor="set-duration">Timer length</label>
          <strong>{duration}s</strong>
        </div>
        <div className="preset-row" aria-label="Timer presets">
          {presetDurations.map((preset) => (
            <button
              className={`preset-button ${duration === preset ? "active" : ""}`}
              key={preset}
              type="button"
              onClick={() => onDurationChange(preset)}
            >
              {preset}s
            </button>
          ))}
        </div>
        <div className="duration-control">
          <input
            id="set-duration"
            min={10}
            max={600}
            step={5}
            type="range"
            value={duration}
            onChange={(event) => onDurationChange(Number(event.target.value))}
          />
          <input
            aria-label="Timer length in seconds"
            className="duration-number"
            inputMode="numeric"
            min={10}
            max={600}
            step={5}
            type="number"
            value={duration}
            onChange={(event) => onDurationChange(Number(event.target.value))}
          />
        </div>
      </div>
    </section>
  );
}

function AddSetPanel({
  value,
  onChange,
  onAdd
}: {
  value: SetDraft;
  onChange: (value: SetDraft) => void;
  onAdd: () => void;
}) {
  return (
    <section className="panel set-details-panel" aria-label="Create a set">
      <div className="panel-title">
        <ClipboardCheck size={18} />
        <h2>Create Set</h2>
      </div>
      <div className="setting-row">
        <label htmlFor="new-set-name">Name</label>
        <input
          className="text-input"
          id="new-set-name"
          maxLength={64}
          placeholder="Warmup, left hand, final pull..."
          type="text"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </div>
      <div className="setting-row">
        <label htmlFor="new-set-duration">Duration</label>
        <input
          className="text-input"
          id="new-set-duration"
          inputMode="numeric"
          min={10}
          max={600}
          step={5}
          type="number"
          value={value.durationSeconds}
          onChange={(event) => onChange({ ...value, durationSeconds: Number(event.target.value) })}
        />
      </div>
      <div className="setting-row">
        <span className="notes-label">Time</span>
        <div className="daypart-row" aria-label="Set time of day">
          {dayParts.map((part) => (
            <button
              className={`daypart-button ${value.dayPart === part ? "active" : ""}`}
              key={part}
              type="button"
              onClick={() => onChange({ ...value, dayPart: part })}
            >
              {dayPartLabels[part]}
            </button>
          ))}
        </div>
      </div>
      <button className="action-button complete wide-action" type="button" onClick={onAdd}>
        <Plus size={18} />
        <span>Add set</span>
      </button>
    </section>
  );
}

function SetTimer({
  activeSet,
  onComplete
}: {
  activeSet: SetEntry | null;
  onComplete: (setId: string) => Promise<void>;
}) {
  const duration = activeSet?.duration_seconds ?? 60;
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRemaining(duration);
    setRunning(false);
  }, [activeSet?.id, duration]);

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const id = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(id);
          setRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [running]);

  const progress = duration === 0 ? 0 : Math.round(((duration - remaining) / duration) * 100);
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  const complete = async () => {
    if (!activeSet) {
      return;
    }

    setRunning(false);
    await onComplete(activeSet.id);
    setRemaining(duration);
  };

  return (
    <section className="panel timer-panel" aria-label="Set timer">
      <div className="panel-title">
        <TimerReset size={18} />
        <h2>Set Timer</h2>
        <span className="panel-meta">{activeSet ? activeSet.set_name || `Set ${activeSet.position}` : "No set"}</span>
      </div>
      <div className="timer-face" style={{ "--progress": `${progress}%` } as CSSProperties}>
        <span>{minutes}:{seconds}</span>
        <small>{progress}%</small>
      </div>
      <div className="timer-actions">
        <button className="action-button primary" type="button" onClick={() => setRunning((value) => !value)} disabled={!activeSet}>
          {running ? <CirclePause size={18} /> : <CirclePlay size={18} />}
          <span>{running ? "Pause" : "Start"}</span>
        </button>
        <IconButton label="Reset timer" onClick={() => setRemaining(duration)}>
          <RotateCcw size={18} />
        </IconButton>
        <button className="action-button complete" type="button" onClick={complete} disabled={!activeSet || Boolean(activeSet.completed_at)}>
          <ClipboardCheck size={18} />
          <span>Complete</span>
        </button>
      </div>
    </section>
  );
}

function TimeOverview({ entries }: { entries: SetEntry[] }) {
  return (
    <div className="time-overview" aria-label="Completed sets by time of day">
      {dayParts.map((part) => (
        <span key={part}>
          <strong>{entries.filter((entry) => entry.day_part === part).length}</strong>
          {dayPartLabels[part]}
        </span>
      ))}
    </div>
  );
}

function SetChecklist({
  day,
  activeSetId,
  onSelectTimer,
  onToggle,
  onUpdate,
  onDelete
}: {
  day: DayRecord;
  activeSetId: string | null;
  onSelectTimer: (setId: string) => void;
  onToggle: (setId: string) => void;
  onUpdate: (setId: string, updates: Partial<Pick<SetEntry, "set_name" | "day_part" | "duration_seconds">>) => void;
  onDelete: (setId: string) => void;
}) {
  const completed = day.completedSets.length;

  return (
    <section className="panel checklist-panel" aria-label="Today's set checklist">
      <div className="panel-heading">
        <div className="panel-title">
          <Target size={18} />
          <h2>Today</h2>
        </div>
        <span className="panel-meta">{completed}/{day.targetSets}</span>
      </div>
      <TimeOverview entries={day.completedSets} />
      <div className="set-list">
        {day.sets.map((entry) => {
          const checked = Boolean(entry.completed_at);
          return (
            <article className={`set-card ${checked ? "done" : ""} ${activeSetId === entry.id ? "active" : ""}`} key={entry.id}>
              <div className="set-card-top">
                <button
                  className={`checkmark ${checked ? "done" : ""}`}
                  type="button"
                  onClick={() => onToggle(entry.id)}
                  aria-label={checked ? "Mark set open" : "Mark set complete"}
                  aria-pressed={checked}
                >
                  {checked ? <Check size={16} /> : entry.position}
                </button>
                <div className="set-copy">
                  <input
                    aria-label={`Set ${entry.position} name`}
                    className="set-name-input"
                    maxLength={64}
                    value={entry.set_name}
                    onChange={(event) => onUpdate(entry.id, { set_name: event.target.value })}
                  />
                  <small>{checked ? `${dayPartLabels[entry.day_part]} complete` : `${dayPartLabels[entry.day_part]} planned`}</small>
                </div>
                <IconButton
                  label={`Remove ${entry.set_name || `Set ${entry.position}`}`}
                  onClick={() => onDelete(entry.id)}
                  disabled={day.sets.length <= 1}
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>
              <div className="set-edit-row">
                <input
                  aria-label={`${entry.set_name} duration in seconds`}
                  className="set-duration-input"
                  inputMode="numeric"
                  min={10}
                  max={600}
                  step={5}
                  type="number"
                  value={entry.duration_seconds}
                  onChange={(event) => onUpdate(entry.id, { duration_seconds: Number(event.target.value) })}
                />
                <button
                  aria-label={`Use timer for ${entry.set_name || `Set ${entry.position}`}`}
                  className="timer-select"
                  type="button"
                  onClick={() => onSelectTimer(entry.id)}
                >
                  <TimerReset size={15} />
                  <span>Timer</span>
                </button>
              </div>
              <div className="daypart-row compact" aria-label={`${entry.set_name} time of day`}>
                {dayParts.map((part) => (
                  <button
                    className={`daypart-button ${entry.day_part === part ? "active" : ""}`}
                    key={part}
                    type="button"
                    onClick={() => onUpdate(entry.id, { day_part: part })}
                  >
                    {dayPartLabels[part]}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Dashboard({
  today,
  profile,
  stats,
  onGoalChange,
  onDurationChange,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onToggleSet,
  onCompleteSet
}: {
  today: DayRecord;
  profile: { daily_goal: number; set_duration_seconds: number };
  stats: Stats;
  onGoalChange: (value: number) => void;
  onDurationChange: (value: number) => void;
  onAddSet: (draft: SetDraft) => Promise<void>;
  onUpdateSet: (setId: string, updates: Partial<Pick<SetEntry, "set_name" | "day_part" | "duration_seconds">>) => void;
  onDeleteSet: (setId: string) => void;
  onToggleSet: (setId: string) => void;
  onCompleteSet: (setId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SetDraft>({ name: "", dayPart: "morning", durationSeconds: profile.set_duration_seconds });
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const percent = Math.min(100, Math.round((today.completedSets.length / Math.max(1, today.targetSets)) * 100));
  const activeSet =
    today.sets.find((entry) => entry.id === activeSetId) ??
    today.sets.find((entry) => !entry.completed_at) ??
    today.sets[0] ??
    null;

  useEffect(() => {
    if (!activeSetId && activeSet) {
      setActiveSetId(activeSet.id);
    }
  }, [activeSet, activeSetId]);

  useEffect(() => {
    setDraft((current) => ({ ...current, durationSeconds: profile.set_duration_seconds }));
  }, [profile.set_duration_seconds]);

  const addSet = async () => {
    await onAddSet(draft);
    setDraft({ ...draft, name: "" });
  };

  return (
    <div className="dashboard-stack">
      <section className="today-hero">
        <div className="hero-copy">
          <p>{formatFriendlyDate(today.date)}</p>
          <h1>ThumbTrack</h1>
          <span>{today.completedSets.length} of {today.targetSets} sets complete</span>
          <div className="hero-chips" aria-label="Today settings">
            <span>{profile.daily_goal} daily sets</span>
            <span>{profile.set_duration_seconds}s timer</span>
          </div>
        </div>
        <div className="progress-badge" style={{ "--progress": `${percent}%` } as CSSProperties}>
          <strong>{percent}%</strong>
          <small>today</small>
        </div>
      </section>

      <StatsGrid stats={stats} />

      <div className="dashboard-grid">
        <GoalSettings
          goal={profile.daily_goal}
          duration={profile.set_duration_seconds}
          onGoalChange={onGoalChange}
          onDurationChange={onDurationChange}
        />
        <AddSetPanel value={draft} onChange={setDraft} onAdd={addSet} />
        <SetTimer activeSet={activeSet} onComplete={onCompleteSet} />
      </div>

      <SetChecklist
        day={today}
        activeSetId={activeSet?.id ?? null}
        onSelectTimer={setActiveSetId}
        onToggle={onToggleSet}
        onUpdate={onUpdateSet}
        onDelete={onDeleteSet}
      />
    </div>
  );
}

function CalendarView({
  days,
  selectedDate,
  onSelectDate
}: {
  days: DayRecord[];
  selectedDate: IsoDate;
  onSelectDate: (date: IsoDate) => void;
}) {
  const [anchor, setAnchor] = useState(parseIsoDate(selectedDate));
  const records = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const calendarDays = getMonthDays(anchor);
  const activeMonth = monthKey(anchor);

  return (
    <section className="panel calendar-panel" aria-label="Progress calendar">
      <div className="calendar-heading">
        <div className="panel-title">
          <CalendarDays size={18} />
          <h2>{monthLabel(anchor)}</h2>
        </div>
        <div className="calendar-nav">
          <IconButton label="Previous month" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="Next month" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
      </div>
      <div className="weekday-row">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {calendarDays.map((date) => {
          const iso = toIsoDate(date);
          const record = records.get(iso);
          const rate = record ? record.completedSets.length / Math.max(1, record.targetSets) : 0;
          const status = rate >= 1 ? "complete" : rate > 0 ? "partial" : "";
          const outOfMonth = monthKey(date) !== activeMonth;

          return (
            <button
              className={`calendar-day ${status} ${outOfMonth ? "muted" : ""} ${selectedDate === iso ? "selected" : ""}`}
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
            >
              <span>{date.getDate()}</span>
              {record ? <small>{record.completedSets.length}/{record.targetSets}</small> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DayDetail({
  day,
  onNotesChange
}: {
  day: DayRecord;
  onNotesChange: (date: IsoDate, notes: string) => void;
}) {
  return (
    <section className="panel detail-panel" aria-label="Day detail">
      <div className="panel-heading">
        <div className="panel-title">
          <TrendingUp size={18} />
          <h2>{formatFriendlyDate(day.date)}</h2>
        </div>
        <span className="panel-meta">{day.completedSets.length}/{day.targetSets}</span>
      </div>
      <div className="detail-summary">
        <strong>{day.completedSets.length}/{day.targetSets}</strong>
        <span>sets completed</span>
      </div>
      <div className="completed-list">
        {day.completedSets.length === 0 ? (
          <p>No sets recorded.</p>
        ) : (
          dayParts.map((part) => {
            const entries = day.completedSets.filter((entry) => entry.day_part === part);

            return entries.length > 0 ? (
              <div className="daypart-group" key={part}>
                <h3>{dayPartLabels[part]}</h3>
                {entries.map((entry) => (
                  <div className="completed-row" key={entry.id}>
                    <span>{entry.set_name || `Set ${entry.position}`}</span>
                    <small>{entry.duration_seconds}s</small>
                    <time dateTime={entry.completed_at ?? undefined}>
                      {new Intl.DateTimeFormat("en", {
                        hour: "numeric",
                        minute: "2-digit"
                      }).format(new Date(entry.completed_at ?? entry.created_at))}
                    </time>
                  </div>
                ))}
              </div>
            ) : null;
          })
        )}
      </div>
      <label className="notes-label" htmlFor="day-notes">Notes</label>
      <textarea
        id="day-notes"
        placeholder="What helped today?"
        value={day.notes}
        onChange={(event) => onNotesChange(day.date, event.target.value)}
      />
    </section>
  );
}

export function ThumbTrackApp() {
  const thumbTrack = useThumbTrack();
  const [activeTab, setActiveTab] = useState<"today" | "calendar">("today");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">TT</div>
        <SyncPill state={thumbTrack.syncState} error={thumbTrack.error} onRetry={thumbTrack.reload} />
      </header>

      {thumbTrack.error ? <div className="error-banner">{thumbTrack.error}</div> : null}

      <AuthPanel
        hasSupabase={thumbTrack.hasSupabase}
        userEmail={thumbTrack.userEmail}
        message={thumbTrack.authMessage}
        onSignIn={thumbTrack.signInWithEmail}
        onSignOut={thumbTrack.signOut}
      />

      <nav className="view-tabs" aria-label="ThumbTrack sections">
        <button
          className={`tab-button ${activeTab === "today" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("today")}
        >
          <Target size={18} />
          <span>Today</span>
        </button>
        <button
          className={`tab-button ${activeTab === "calendar" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("calendar")}
        >
          <CalendarDays size={18} />
          <span>Calendar</span>
        </button>
      </nav>

      {activeTab === "today" ? (
        <Dashboard
          today={thumbTrack.todayRecord}
          profile={thumbTrack.profile}
          stats={thumbTrack.stats}
          onGoalChange={thumbTrack.updateGoal}
          onDurationChange={thumbTrack.updateDuration}
          onAddSet={thumbTrack.addSet}
          onUpdateSet={(setId, updates) => void thumbTrack.updateSet(setId, updates)}
          onDeleteSet={(setId) => void thumbTrack.deleteSet(setId)}
          onToggleSet={(setId) => void thumbTrack.toggleSet(setId)}
          onCompleteSet={thumbTrack.completeSet}
        />
      ) : (
        <div className="calendar-view-grid">
          <CalendarView
            days={thumbTrack.days}
            selectedDate={thumbTrack.selectedDate}
            onSelectDate={thumbTrack.setSelectedDate}
          />
          <DayDetail day={thumbTrack.selectedRecord} onNotesChange={thumbTrack.updateNotes} />
        </div>
      )}
    </main>
  );
}
