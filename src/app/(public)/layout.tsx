import PublicLayout from "@/components/organisms/layouts/public-layout";
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="la-nube-theme">
            <PublicLayout>
                {children}
            </PublicLayout>
        </ThemeProvider>
    )
}