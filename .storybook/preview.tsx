import type { Preview } from "@storybook/nextjs";
import "../src/app/globals.css";
const preview: Preview = { parameters: { layout: "centered", controls: { expanded: true } } };
export default preview;
