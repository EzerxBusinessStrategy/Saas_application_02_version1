import type { Meta, StoryObj } from "@storybook/nextjs";
import { StatusBadge } from "@/components/shared/status-badge";
const meta = {
  component: StatusBadge,
  args: { status: "on-track" },
} satisfies Meta<typeof StatusBadge>;
export default meta;
export const OnTrack: StoryObj<typeof meta> = {};
export const Blocked: StoryObj<typeof meta> = { args: { status: "blocked" } };
