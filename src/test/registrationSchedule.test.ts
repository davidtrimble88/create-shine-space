import { describe, expect, it } from "vitest";
import { isZoomRegistrationSession } from "../../supabase/functions/_shared/registration-schedule";

describe("registration session delivery", () => {
  it("uses Zoom for Wednesday MTC sessions", () => {
    expect(isZoomRegistrationSession("basic", 3)).toBe(true);
  });
  it("uses Zoom for Friday MTC sessions", () => {
    expect(isZoomRegistrationSession("basic", 5)).toBe(true);
  });
  it("keeps weekend MTC sessions in person", () => {
    expect(isZoomRegistrationSession("basic", 6)).toBe(false);
    expect(isZoomRegistrationSession("basic", 0)).toBe(false);
  });
  it("does not treat other courses as Zoom classes", () => {
    for (const course of ["intermediate", "premier", "advanced", null]) {
      expect(isZoomRegistrationSession(course, 3)).toBe(false);
      expect(isZoomRegistrationSession(course, 5)).toBe(false);
    }
  });
});