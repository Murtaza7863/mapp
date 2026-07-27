import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import { CalendarIcon } from "./icons";

interface Props {
  value: string;
  onChange: (yyyyMmDd: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "Pick a date",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    value ? parseISO(`${value}T12:00:00`) : new Date(),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const label = value
    ? format(parseISO(`${value}T12:00:00`), "EEE, MMM d, yyyy")
    : placeholder;

  const pick = (day: Date) => {
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left"
      >
        <span className={value ? "text-primary" : "text-muted"}>{label}</span>
        <CalendarIcon className="text-muted h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div className="item-card absolute z-50 mt-1.5 w-full min-w-[280px] rounded-xl border p-3 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="text-muted hover:text-primary rounded-lg px-2 py-1"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-primary text-sm font-medium">
              {format(month, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="text-muted hover:text-primary rounded-lg px-2 py-1"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="text-muted mb-1 grid grid-cols-7 text-center text-[10px] font-medium">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`${d}-${i}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const selected = value === key;
              const inMonth = isSameMonth(day, month);
              const today = isToday(day);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(day)}
                  className={`aspect-square rounded-lg text-sm transition-colors ${
                    selected
                      ? "bg-block text-white font-semibold"
                      : today
                        ? "text-primary ring-block/45 font-semibold ring-1"
                        : inMonth
                          ? "text-primary hover:bg-[#f0f2f5]"
                          : "text-muted hover:bg-[#f0f2f5]"
                  }`}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="border-rule mt-2 flex gap-2 border-t pt-2">
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="btn-ghost flex-1 rounded-lg py-1.5 text-xs"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="btn-ghost flex-1 rounded-lg py-1.5 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TimePickerField({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (time: string) => void;
  className?: string;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`input-field w-full rounded-xl px-3 py-2.5 ${className}`}
    />
  );
}
