"use client";

import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function SignIn() {
  const { status } = useSession();
  return (
    <div className="flex flex-col items-center">
      {status === "authenticated" ? (
        <Link href="/user/dashboard" className="rounded-full">
          <Button className="rounded-full">Ir a mi perfil</Button>
        </Link>
      ) : (
        <Link href="/auth/signin" className="lg:rounded-full">
          <Button className="lg:rounded-full">Iniciar sesión</Button>
        </Link>
      )}
    </div>
  );
}
