"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../src/lib/supabaseClient";

type Habit = {
  id: string;
  name: string;
  created_at: string;
};

function todayKey() {
  // store check-ins by date (local time)
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string>("Loading protocols…");

  const date = useMemo(() => todayKey(), []);

  async function loadHabits() {
    setStatus("Loading protocols…");
    const { data, error } = await supabase
      .from("habits")
      .select("id,name,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setHabits(data ?? []);
    setStatus((data?.length ?? 0) > 0 ? "" : "No protocols yet. Add some in Supabase.");
  }

  async function loadTodayCheckins() {
    // We’ll store one check-in per habit per day.
    // For now, we’ll read all check-ins from today and mark them as done.
    const start = new Date(date + "T00:00:00");
    const end = new Date(date + "T23:59:59");

    const { data, error } = await supabase
      .from("checkins")
      .select("habit_id, completed_at")
      .gte("completed_at", start.toISOString())
      .lte("completed_at", end.toISOString());

    if (error) {
      // Not fatal; you can still use UI.
      console.log(error.message);
      return;
    }

    const s = new Set<string>();
    (data ?? []).forEach((row: any) => s.add(row.habit_id));
    setDoneIds(s);
  }

  useEffect(() => {
    (async () => {
      await loadHabits();
      await loadTodayCheckins();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completedCount = doneIds.size;
  const totalCount = habits.length;
  const momentum = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  async function toggleHabit(habitId: string) {
    const isDone = doneIds.has(habitId);

    // Optimistic UI
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(habitId);
      else next.add(habitId);
      return next;
    });

    if (!isDone) {
      // Mark done: insert a check-in
      const { error } = await supabase.from("checkins").insert({
        habit_id: habitId,
        completed_at: new Date().toISOString(),
      });

      if (error) {
        // rollback
        setDoneIds((prev) => {
          const next = new Set(prev);
          next.delete(habitId);
          return next;
        });
        alert("Could not save check-in: " + error.message);
      }
    } else {
      // Mark undone: delete today's check-in(s) for this habit
      const start = new Date(date + "T00:00:00").toISOString();
      const end = new Date(date + "T23:59:59").toISOString();

      const { error } = await supabase
        .from("checkins")
        .delete()
        .eq("habit_id", habitId)
        .gte("completed_at", start)
        .lte("completed_at", end);

      if (error) {
        // rollback
        setDoneIds((prev) => {
          const next = new Set(prev);
          next.add(habitId);
          return next;
        });
        alert("Could not remove check-in: " + error.message);
      }
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, fontFamily: "system-ui", background: "#0b0b0f", color: "#eaeaf2" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ letterSpacing: 2, fontSize: 12, opacity: 0.7 }}>LIFE OPERATING SYSTEM</div>
            <h1 style={{ margin: "8px 0 0", fontSize: 28 }}>Dashboard</h1>
            <div style={{ marginTop: 6, opacity: 0.7 }}>Protocols for {date}</div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ letterSpacing: 2, fontSize: 12, opacity: 0.7 }}>MOMENTUM</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{momentum}%</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {completedCount}/{totalCount} executed
            </div>
          </div>
        </header>

        <section style={{ marginTop: 18, padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, letterSpacing: 1 }}>PROTOCOLS</h2>
            <button
              onClick={() => {
                loadHabits();
                loadTodayCheckins();
              }}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                color: "#eaeaf2",
                padding: "8px 10px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          {status ? <p style={{ opacity: 0.75, marginTop: 12 }}>{status}</p> : null}

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {habits.map((h) => {
              const done = doneIds.has(h.id);
              return (
                <button
                  key={h.id}
                  onClick={() => toggleHabit(h.id)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: done ? "rgba(120, 255, 180, 0.14)" : "rgba(255,255,255,0.04)",
                    color: "#eaeaf2",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{h.name}</span>
                  <span style={{ opacity: 0.8, fontSize: 12, letterSpacing: 1 }}>
                    {done ? "EXECUTED" : "PENDING"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ marginTop: 14, padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.04)" }}>
          <h2 style={{ margin: 0, fontSize: 16, letterSpacing: 1 }}>OPTIMIZATION</h2>
          <p style={{ opacity: 0.8, marginTop: 10 }}>
            Atomic Habits rule for today: make the next action <b>obvious</b> and <b>easy</b>. Reduce friction until
            “starting” feels inevitable.
          </p>
        </section>
      </div>
    </main>
  );
}
