import { expect, test } from "vitest";
import { employees } from "@/mocks/workforce";

test("workforce fixtures cover the required employee directory states", () => {
  expect(
    employees.every(
      (employee) =>
        employee.code && employee.department && employee.skills.length,
    ),
  ).toBe(true);
  expect(new Set(employees.map((employee) => employee.workload.risk))).toEqual(
    new Set(["balanced", "at-risk", "overloaded"]),
  );
  expect(
    new Set(employees.map((employee) => employee.employmentStatus)),
  ).toEqual(new Set(["active", "on-leave", "inactive"]));
});
