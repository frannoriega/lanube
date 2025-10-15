import UserProfile from "@/components/molecules/user-profile";
import ParticlesLayout from "@/components/organisms/layouts/particles-layout";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ParticlesLayout className="bg-red-400">
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="w-full h-full flex flex-row items-center justify-end">
          <UserProfile />
        </div>
        <div className="w-full h-full flex items-center justify-center">
          {children}
        </div>
      </div>
      <Toaster />
    </ParticlesLayout>
  );
}
