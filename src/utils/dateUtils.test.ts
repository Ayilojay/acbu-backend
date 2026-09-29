import {
  addCalendarDays,
  addCalendarMonths,
  formatIsoDateInTimeZone,
  getInitialDailyMidnight,
  getNextDailyMidnight,
  getStartOfZonedDay,
  getStartOfZonedMonth,
  getZonedDayOfMonth,
  getZonedParts,
  isValidTimeZone,
  resolveTimeZone,
  zonedDateTimeToUtc,
} from "./dateUtils";

jest.mock("../config/env", () => ({
  config: {
    businessTimeZone: "Africa/Lagos",
  },
}));

describe("dateUtils", () => {
  it("resolves invalid preferred timezones to the business default", () => {
    expect(resolveTimeZone("Not/A_Timezone")).toBe("Africa/Lagos");
    expect(resolveTimeZone("America/New_York")).toBe("America/New_York");
  });

  it("computes day-of-month in the configured timezone instead of UTC", () => {
    const instant = new Date("2026-05-15T23:30:00.000Z");
    expect(getZonedDayOfMonth(instant, "UTC")).toBe(15);
    expect(getZonedDayOfMonth(instant, "Africa/Lagos")).toBe(16);
  });

  it("formats calendar dates without using UTC ISO truncation", () => {
    const instant = new Date("2026-05-15T23:30:00.000Z");
    expect(formatIsoDateInTimeZone(instant, "Africa/Lagos")).toBe("2026-05-16");
  });

  it("finds the next daily midnight in the business timezone", () => {
    const from = zonedDateTimeToUtc(2026, 5, 15, 9, 0, 0, "Africa/Lagos");
    const next = getNextDailyMidnight(from, "Africa/Lagos");
    const parts = getZonedParts(next, "Africa/Lagos");

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(5);
    expect(parts.day).toBe(16);
    expect(parts.hour).toBe(0);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it("returns today's midnight when the reference time is before it", () => {
    const from = zonedDateTimeToUtc(2026, 5, 14, 23, 30, 0, "Africa/Lagos");
    const initial = getInitialDailyMidnight(from, "Africa/Lagos");
    const parts = getZonedParts(initial, "Africa/Lagos");

    expect(parts.day).toBe(15);
    expect(parts.hour).toBe(0);
    expect(initial.getTime()).toBeGreaterThan(from.getTime());
  });

  it("computes start-of-day and start-of-month boundaries in timezone", () => {
    const instant = new Date("2026-05-15T18:00:00.000Z");
    const startOfDay = getStartOfZonedDay(instant, "Africa/Lagos");
    const startOfMonth = getStartOfZonedMonth(instant, "Africa/Lagos");

    expect(getZonedParts(startOfDay, "Africa/Lagos").hour).toBe(0);
    expect(getZonedParts(startOfMonth, "Africa/Lagos").day).toBe(1);
    expect(startOfDay.getTime()).toBeLessThanOrEqual(instant.getTime());
  });

  it("validates IANA timezone identifiers", () => {
    expect(isValidTimeZone("Africa/Lagos")).toBe(true);
    expect(isValidTimeZone("Invalid Zone")).toBe(false);
  });

  it("adds calendar days and months without relying on server-local time", () => {
    expect(addCalendarDays({ year: 2026, month: 5, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 6,
      day: 1,
    });
    expect(addCalendarMonths({ year: 2026, month: 12, day: 10 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 10,
    });
  });
});
