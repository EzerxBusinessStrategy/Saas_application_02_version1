import { describe, expect, it } from "vitest";
import { formatDashboardMoney } from "./dashboard-money";

describe("formatDashboardMoney", () => {
  it("formats INR without decimal noise for KPI cards", () => {
    expect(formatDashboardMoney("200000", "INR").exact).toBe("₹2,00,000");
  });

  it("uses compact lakh notation with exact amount preserved", () => {
    const formatted = formatDashboardMoney("1240000", "INR");
    expect(formatted.display).toBe("₹12.4L");
    expect(formatted.exact).toBe("₹12,40,000");
  });
});
