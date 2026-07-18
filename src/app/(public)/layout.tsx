import PublicLayout from "@/components/organisms/layouts/public-layout";
import { getThemeStorageKey } from "@/config";
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={getThemeStorageKey()}
    >
      <PublicLayout>{children}</PublicLayout>
    </ThemeProvider>
  );
}
