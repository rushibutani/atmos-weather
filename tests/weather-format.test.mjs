import assert from "node:assert/strict";
import test from "node:test";
import { formatRelativeUpdate } from "../src/features/weather/utils/weather.ts";

// 2026-08-31 11:45 in Ahmedabad (UTC+5:30).
const updatedAtMs = Date.UTC(2026, 7, 31, 6, 15);
const current = { updatedAt: "2026-08-31 11:45", updatedAtMs };
const location = { localtime: "2026-08-31 11:45", timezone: "Asia/Kolkata" };
const minutes = (n) => n * 60_000;

test("measures the age against the viewer's clock, not the response's own", () => {
  // The response's localtime never moves, as with a cached forecast; the age still grows.
  assert.equal(formatRelativeUpdate(current, location, updatedAtMs + minutes(0.5)), "just now");
  assert.equal(formatRelativeUpdate(current, location, updatedAtMs + minutes(12)), "12 min ago");
  assert.equal(formatRelativeUpdate(current, location, updatedAtMs + minutes(47)), "47 min ago");
});

test("past an hour, gives the reading's time on the location's clock", () => {
  assert.equal(formatRelativeUpdate(current, location, updatedAtMs + minutes(90)), "at 11:45 AM");
  const london = { localtime: "2026-08-31 07:15", timezone: "Europe/London" };
  assert.equal(formatRelativeUpdate(current, london, updatedAtMs + minutes(90)), "at 7:15 AM");
});

test("a clock running behind the provider reads as just now, never a negative age", () => {
  assert.equal(formatRelativeUpdate(current, location, updatedAtMs - minutes(3)), "just now");
});

test("weather saved without an epoch falls back to its own wall-clock times", () => {
  const legacy = { updatedAt: "2026-08-31 11:45" };
  assert.equal(
    formatRelativeUpdate(legacy, { ...location, localtime: "2026-08-31 12:05" }, Date.now()),
    "20 min ago",
  );
  assert.equal(
    formatRelativeUpdate(legacy, { ...location, localtime: "2026-08-31 14:00" }, Date.now()),
    "at 11:45 AM",
  );
});
