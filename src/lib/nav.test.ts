import { expect, test } from "vitest";
import { flattenNavigation, navigationFor } from "@/lib/nav";

test("puts tenant Task review in the People & Teams menu and keeps client requests on Task request", () => {
  const navigation = navigationFor("admin");
  const peopleAndTeams = navigation.find((item) => item.label === "People & Teams");
  const operations = navigation.find((item) => item.label === "Operations");
  const taskReview = peopleAndTeams?.children?.find((item) => item.label === "Task review");

  expect(taskReview?.href).toBe("/task-review");
  expect(operations?.children?.some((item) => item.label === "Task request")).toBe(true);
  expect(operations?.children?.some((item) => item.label === "Task review")).toBe(false);
  expect(
    flattenNavigation(navigation).filter((item) => item.href === "/task-review"),
  ).toHaveLength(1);
});
