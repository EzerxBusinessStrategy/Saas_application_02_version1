import type { Metadata } from "next";
import "@/app/globals.css";
import { Providers } from "@/components/providers";
export const metadata: Metadata = {
  title: "SaaS App",
  description: "Multi-tenant operations workspace",
  icons: { icon: "/branding/default-mark.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
