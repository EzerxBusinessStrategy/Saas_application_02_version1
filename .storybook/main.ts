import type { StorybookConfig } from "@storybook/nextjs";
const config: StorybookConfig = { stories: ["../src/**/*.stories.@(ts|tsx)"], addons: ["@storybook/addon-a11y"], framework: "@storybook/nextjs" };
export default config;
