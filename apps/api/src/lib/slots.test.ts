import { describe, expect, it } from "vitest";
import {
  computeSlotStarts,
  subtractIntervals,
  totalDuration,
} from "./slots.js";
import { atTashkent } from "./time.js";

describe("subtractIntervals", () => {
  it("вычитает обед из рабочего дня", () => {
    const free = subtractIntervals(
      [{ startMin: 10 * 60, endMin: 21 * 60 }],
      [{ startMin: 13 * 60, endMin: 14 * 60 }],
    );
    expect(free).toEqual([
      { startMin: 600, endMin: 780 },
      { startMin: 840, endMin: 1260 },
    ]);
  });
});

describe("computeSlotStarts", () => {
  it("не предлагает слот, который не помещается до конца дня", () => {
    const slots = computeSlotStarts({
      isoDate: "2026-10-06",
      durationMin: 75,
      workingHours: { startMin: 20 * 60, endMin: 21 * 60 },
      breaks: [],
      busy: [],
      slotStepMin: 15,
      now: atTashkent("2026-10-06", "08:00"),
      minNoticeMin: 0,
    });
    expect(slots).toEqual([]);
  });

  it("учитывает существующую запись", () => {
    const slots = computeSlotStarts({
      isoDate: "2026-10-06",
      durationMin: 45,
      workingHours: { startMin: 10 * 60, endMin: 12 * 60 },
      breaks: [],
      busy: [
        {
          startsAt: atTashkent("2026-10-06", "10:00"),
          endsAt: atTashkent("2026-10-06", "10:45"),
        },
      ],
      slotStepMin: 15,
      now: atTashkent("2026-10-06", "08:00"),
      minNoticeMin: 0,
    });
    expect(slots[0]).toBe("10:45");
    expect(slots).not.toContain("10:00");
  });

  it("учитывает min_notice", () => {
    const slots = computeSlotStarts({
      isoDate: "2026-10-06",
      durationMin: 30,
      workingHours: { startMin: 10 * 60, endMin: 12 * 60 },
      breaks: [],
      busy: [],
      slotStepMin: 30,
      now: atTashkent("2026-10-06", "10:00"),
      minNoticeMin: 30,
    });
    expect(slots[0]).toBe("10:30");
  });
});

describe("totalDuration", () => {
  it("суммирует длительности", () => {
    expect(
      totalDuration([{ durationMin: 45 }, { durationMin: 30 }]),
    ).toBe(75);
  });
});
