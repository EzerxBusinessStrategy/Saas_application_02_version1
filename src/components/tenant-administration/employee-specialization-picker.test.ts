import { describe, expect, it } from "vitest";
import { employeesForServiceAllocation, specializationLabel } from "./employee-specialization-picker";

describe("employee specialization picker helpers", () => {
  it("keeps employees without skills allocatable after specialists", () => {
    const sorted = employeesForServiceAllocation(
      [
        { name: "Priya", skills: [] },
        { name: "Aarav", skills: ["GST Compliance"] },
        { name: "Neha", skills: ["Payroll"] },
      ],
      "GST Compliance",
    );
    expect(sorted.map((employee) => employee.name)).toEqual(["Aarav", "Neha", "Priya"]);
  });

  it("labels missing skills as no specialization", () => {
    expect(specializationLabel([])).toBe("No specialization");
    expect(specializationLabel(["GST Compliance"])).toBe("GST Compliance");
  });
});
