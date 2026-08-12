"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { FormValidationGuard } from "@/components/shared/form-validation-guard";
import { FormDraftPersistence } from "@/components/shared/form-draft-persistence";

function ThemeAwareToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const updateTheme = () =>
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return <Toaster richColors theme={theme} />;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 3,
            retryDelay: (attempt) => Math.min(250 * 2 ** attempt, 2_000),
          },
        },
      }),
  );
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableColorScheme
      enableSystem
      storageKey="ezerx-theme"
    >
      <QueryClientProvider client={client}>
        {children}
        <FormValidationGuard />
        <FormDraftPersistence />
        <ThemeAwareToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
