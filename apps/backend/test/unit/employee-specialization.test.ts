import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  replaceEmployeeSpecialization,
  resolveServiceIdsForSpecialization,
} from "../../src/platform/employee-specialization";

describe("employee specialization", () => {
  it("uses explicit service ids when provided", async () => {
    const ids = await resolveServiceIdsForSpecialization(
      { query: vi.fn() } as never,
      "tenant-1",
      ["11111111-1111-4111-8111-111111111111"],
      ["GST"],
    );
    expect(ids).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });

  it("maps leftover skill names to active services", async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: "22222222-2222-4222-8222-222222222222" }],
      rowCount: 1,
    }));
    const ids = await resolveServiceIdsForSpecialization(
      { query } as never,
      "tenant-1",
      [],
      ["GST Compliance"],
    );
    expect(ids).toEqual(["22222222-2222-4222-8222-222222222222"]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("from public.services"),
      ["tenant-1", ["gst compliance"]],
    );
  });

  it("keeps employees without skills unmapped", async () => {
    const ids = await resolveServiceIdsForSpecialization({ query: vi.fn() } as never, "tenant-1", [], []);
    expect(ids).toEqual([]);
  });

  it("rejects unknown service ids", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from public.services")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
    await expect(
      replaceEmployeeSpecialization(
        { query } as never,
        "tenant-1",
        "employee-1",
        ["11111111-1111-4111-8111-111111111111"],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("writes service capabilities and matching skill names", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from public.services")) {
        return { rows: [{ id: "11111111-1111-4111-8111-111111111111", name: "GST Compliance" }], rowCount: 1 };
      }
      if (sql.includes("insert into public.skills")) {
        return { rows: [{ id: "skill-1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const names = await replaceEmployeeSpecialization(
      { query } as never,
      "tenant-1",
      "employee-1",
      ["11111111-1111-4111-8111-111111111111"],
    );

    expect(names).toEqual(["GST Compliance"]);
    expect(query.mock.calls.some((call) => String(call[0]).includes("insert into public.employee_service_capabilities"))).toBe(true);
    expect(query.mock.calls.some((call) => String(call[0]).includes("insert into public.employee_skills"))).toBe(true);
  });
});
