import type { Meta, StoryObj } from "@storybook/nextjs";
import { MetricCard } from "@/components/shared/metric-card";
const meta = {
  component: MetricCard,
  args: {
    metric: {
      label: "Open tasks",
      value: "86",
      change: "+8% this week",
      trend: "up",
    },
  },
} satisfies Meta<typeof MetricCard>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
export const LongContent: StoryObj<typeof meta> = {
  args: {
    metric: {
      label: "Outstanding invoices requiring manager confirmation",
      value: "$1,245,820.00",
      change: "Due in 4 business days",
      trend: "down",
    },
  },
};
