import { expect, test } from "vitest";
import { flattenNavigation, navigationFor } from "@/lib/nav";

test("puts tenant Task review in Operations below Calendar", () => {
  const navigation = navigationFor("admin");
  const peopleAndTeams = navigation.find((item) => item.label === "People & Teams");
  const operations = navigation.find((item) => item.label === "Operations");
  const operationLabels = operations?.children?.map((item) => item.label) ?? [];

  expect(peopleAndTeams?.children?.some((item) => item.label === "Task review")).toBe(false);
  expect(operationLabels).toEqual(["Services", "Task request", "Calendar", "Task review"]);
  expect(operations?.children?.find((item) => item.label === "Task review")?.href).toBe("/task-review");
  expect(
    flattenNavigation(navigation).filter((item) => item.href === "/task-review"),
  ).toHaveLength(1);
});
