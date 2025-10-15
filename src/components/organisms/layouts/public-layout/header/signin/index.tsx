"use client"

import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"
import { useSession } from "next-auth/react"
import Link from "next/link"

export default function SignIn() {
    const { status } = useSession()
    return (
        <div className="flex flex-col items-center">
            {status === "authenticated" ? (
                <Link href="/user/dashboard" className="rounded-full">
                    <Button className="hidden md:block rounded-full">
                        Ir a mi perfil
                    </Button>
                    <LogIn className="md:hidden" />
                </Link>
            ) : (
                <Link href="/auth/signin" className="rounded-full">
                    <Button className="hidden md:block rounded-full">
                        Iniciar sesión
                    </Button>
                    <LogIn className="md:hidden" />
                </Link>
            )}
        </div>
    )
}