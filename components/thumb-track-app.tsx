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
  monthKey,
  monthLabel,
  parseIsoDate,
  toIsoDate
} from "@/lib/date";
import { useThumbTrack } from "@/lib/use-thumbtrack";
import type { DayRecord, IsoDate, Stats, SyncState } from "@/lib/types";

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
            max={12}
            type="number"
            value={goal}
            onChange={(event) => onGoalChange(Number(event.target.value))}
          />
          <button
            aria-label="Add set"
            className="action-button add"
            type="button"
            onClick={() => onGoalChange(goal + 1)}
            disabled={goal >= 12}
          >
            <Plus size={18} />
            <span>Add</span>
          </button>
        </div>
      </div>
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

function SetTimer({
  duration,
  onComplete
}: {
  duration: number;
  onComplete: (durationSeconds: number) => Promise<void>;
}) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRemaining(duration);
    setRunning(false);
  }, [duration]);

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
    setRunning(false);
    await onComplete(Math.max(1, duration - remaining || duration));
    setRemaining(duration);
  };

  return (
    <section className="panel timer-panel" aria-label="Set timer">
      <div className="panel-title">
        <TimerReset size={18} />
        <h2>Set Timer</h2>
        <span className="panel-meta">{duration}s set</span>
      </div>
      <div className="timer-face" style={{ "--progress": `${progress}%` } as CSSProperties}>
        <span>{minutes}:{seconds}</span>
        <small>{progress}%</small>
      </div>
      <div className="timer-actions">
        <button className="action-button primary" type="button" onClick={() => setRunning((value) => !value)}>
          {running ? <CirclePause size={18} /> : <CirclePlay size={18} />}
          <span>{running ? "Pause" : "Start"}</span>
        </button>
        <IconButton label="Reset timer" onClick={() => setRemaining(duration)}>
          <RotateCcw size={18} />
        </IconButton>
        <button className="action-button complete" type="button" onClick={complete}>
          <ClipboardCheck size={18} />
          <span>Complete</span>
        </button>
      </div>
    </section>
  );
}

function SetChecklist({ day, onToggle }: { day: DayRecord; onToggle: (position: number) => void }) {
  const positions = Array.from({ length: day.targetSets }, (_, index) => index + 1);
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
      <div className="set-list">
        {positions.map((position) => {
          const checked = day.completedSets.some((entry) => entry.position === position);
          return (
            <button
              className={`set-check ${checked ? "done" : ""}`}
              key={position}
              type="button"
              onClick={() => onToggle(position)}
              aria-pressed={checked}
            >
              <span className="checkmark">{checked ? <Check size={16} /> : position}</span>
              <span className="set-copy">
                <strong>Set {position}</strong>
                <small>{checked ? "Complete" : "Open"}</small>
              </span>
              {checked ? <Trash2 className="set-remove-icon" size={16} aria-hidden="true" /> : null}
            </button>
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
  onToggleSet,
  onCompleteSet
}: {
  today: DayRecord;
  profile: { daily_goal: number; set_duration_seconds: number };
  stats: Stats;
  onGoalChange: (value: number) => void;
  onDurationChange: (value: number) => void;
  onToggleSet: (position: number) => void;
  onCompleteSet: (durationSeconds: number) => Promise<void>;
}) {
  const percent = Math.min(100, Math.round((today.completedSets.length / Math.max(1, today.targetSets)) * 100));

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
        <SetTimer duration={profile.set_duration_seconds} onComplete={onCompleteSet} />
      </div>

      <SetChecklist day={today} onToggle={onToggleSet} />
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
          day.completedSets.map((entry) => (
            <div className="completed-row" key={entry.id}>
              <span>Set {entry.position}</span>
              <time dateTime={entry.completed_at}>
                {new Intl.DateTimeFormat("en", {
                  hour: "numeric",
                  minute: "2-digit"
                }).format(new Date(entry.completed_at))}
              </time>
            </div>
          ))
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
          onToggleSet={(position) => void thumbTrack.toggleSet(position)}
          onCompleteSet={thumbTrack.completeNextSet}
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
