import { describe, expect, it } from "vitest";
import { STATUSES, type Status } from "./complaints";
import {
  PAGE_SIZE, QUEUE_SORTS, SORT_COLUMNS, STATUS_TONES, ackState, businessDaysBetween,
  clockProgress, pageSlices, parseQueueSearch, stoppedStatuses,
} from "./queue";

describe("parseQueueSearch", () => {
  it("defaults to time left ascending, page 1, empty search", () => {
    const s = parseQueueSearch({});
    expect(s).toMatchObject({ q: "", sort: "time_left", dir: "asc", page: 1 });
    expect(s.tab).toBeUndefined();
    expect(s.status).toBeUndefined();
  });
  it("keeps valid values", () => {
    const s = parseQueueSearch({ tab: "risk", q: " smith ", sort: "reference", dir: "desc", page: 3, status: "received", vulnerable: "true" });
    expect(s).toMatchObject({ tab: "risk", q: " smith ", sort: "reference", dir: "desc", page: 3, status: "received", vulnerable: "true" });
  });
  it("rejects unknown tab, sort and direction", () => {
    const s = parseQueueSearch({ tab: "everything", sort: "hack", dir: "sideways" });
    expect(s.tab).toBeUndefined();
    expect(s.sort).toBe("time_left");
    expect(s.dir).toBe("asc");
  });
  it("clamps invalid page numbers to 1", () => {
    for (const page of [0, -3, 2.5, "x", NaN]) expect(parseQueueSearch({ page }).page).toBe(1);
  });
  it("drops blank filter strings", () => {
    const s = parseQueueSearch({ status: "  ", country: "" });
    expect(s.status).toBeUndefined();
    expect(s.country).toBeUndefined();
  });
});

describe("pageSlices (time-left sort, stopped clocks last)", () => {
  it("puts stopped clocks after running clocks on the first page", () => {
    expect(pageSlices(3, 2, 1)).toEqual([
      { segment: "running", from: 0, to: 2 },
      { segment: "stopped", from: 0, to: 1 },
    ]);
  });
  it("spills into the stopped segment only after all running rows", () => {
    expect(pageSlices(60, 10, 2)).toEqual([
      { segment: "running", from: 50, to: 59 },
      { segment: "stopped", from: 0, to: 9 },
    ]);
  });
  it("pages within the running segment when it fills multiple pages", () => {
    expect(pageSlices(120, 5, 2)).toEqual([{ segment: "running", from: 50, to: 99 }]);
  });
  it("returns only stopped rows when there are no running clocks", () => {
    expect(pageSlices(0, 5, 1)).toEqual([{ segment: "stopped", from: 0, to: 4 }]);
  });
  it("returns nothing beyond the last page", () => {
    expect(pageSlices(3, 2, 2)).toEqual([]);
  });
  it("respects the page size", () => {
    expect(pageSlices(30, 30, 2, 10)).toEqual([
      { segment: "running", from: 10, to: 19 },
    ]);
  });
});

describe("sort columns", () => {
  it("maps every non-time-left sort to a queue column", () => {
    for (const sort of QUEUE_SORTS.filter((s) => s !== "time_left")) {
      expect(SORT_COLUMNS[sort]).toBeTruthy();
    }
  });
  it("stopped statuses are exactly the non-running ones", () => {
    expect(stoppedStatuses().sort()).toEqual(["closed", "escalated_to_adr", "final_response_sent"]);
  });
});

describe("ackState", () => {
  it("is due while the acknowledgement deadline is today or in the future", () => {
    expect(ackState("received", "2026-10-30", "2026-10-29")).toBe("due");
    expect(ackState("received", "2026-10-29", "2026-10-29")).toBe("due");
  });
  it("is overdue once the acknowledgement deadline has passed", () => {
    expect(ackState("received", "2026-10-28", "2026-10-29")).toBe("overdue");
  });
  it("shows nothing once the complaint is acknowledged or further along", () => {
    expect(ackState("acknowledged", "2026-10-28", "2026-10-29")).toBeNull();
    expect(ackState("closed", "2026-10-28", "2026-10-29")).toBeNull();
  });
  it("shows nothing without an acknowledgement date", () => {
    expect(ackState("received", null, "2026-10-29")).toBeNull();
  });
});

describe("status pill mapping", () => {
  it("maps every status to a defined tone", () => {
    for (const status of Object.keys(STATUSES) as Status[]) {
      expect(STATUS_TONES[status], status).toBeTruthy();
    }
  });
  it("uses only known tones", () => {
    const tones = new Set(["neutral", "teal", "progress", "wait", "review", "done", "closed", "alert"]);
    for (const tone of Object.values(STATUS_TONES)) expect(tones.has(tone)).toBe(true);
  });
});

describe("businessDaysBetween", () => {
  it("skips weekends", () => {
    expect(businessDaysBetween("2026-10-23", "2026-10-26")).toBe(1); // Fri → Mon
    expect(businessDaysBetween("2026-10-26", "2026-10-30")).toBe(4); // Mon → Fri
  });
  it("is zero on the same day and negative when reversed", () => {
    expect(businessDaysBetween("2026-10-26", "2026-10-26")).toBe(0);
    expect(businessDaysBetween("2026-10-30", "2026-10-26")).toBe(-4);
  });
});

describe("clockProgress", () => {
  it("is null for stopped clocks or missing dates", () => {
    expect(clockProgress("2026-10-01", "2026-11-01", 5, "closed")).toBeNull();
    expect(clockProgress(null, "2026-11-01", 5, "received")).toBeNull();
    expect(clockProgress("2026-10-01", null, 5, "received")).toBeNull();
    expect(clockProgress("2026-10-01", "2026-11-01", null, "received")).toBeNull();
  });
  it("is 0 at receipt and approaches 1 at the deadline", () => {
    const total = businessDaysBetween("2026-10-01", "2026-11-05"); // 25 business days
    expect(clockProgress("2026-10-01", "2026-11-05", total, "received")).toBe(0);
    expect(clockProgress("2026-10-01", "2026-11-05", 0, "received")).toBe(1);
  });
  it("clamps overdue clocks to 1", () => {
    expect(clockProgress("2026-10-01", "2026-11-05", -4, "received")).toBe(1);
  });
});

it("page size is 50", () => expect(PAGE_SIZE).toBe(50));
