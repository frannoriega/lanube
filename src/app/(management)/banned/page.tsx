"use client"

import LogoLaNube from "@/components/atoms/logos/lanube"
import LoadingLogo from "@/components/molecules/loading/loading-logo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils/date"
import { useSession } from "next-auth/react"


export default function BannedPage() {
    const { data: session, status } = useSession()
    const formattedDate = formatDate(session?.bannedUntil ?? new Date())

    if (status === "loading") {
        return <LoadingLogo />
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative">


            {/* Content */}
            <Card className="w-full max-w-md relative z-20 glass-card text-white">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-slate-100 flex items-center justify-center rounded-full p-4">
                        <LogoLaNube size={256} />
                    </div>
                    <CardTitle className="text-2xl">Acceso denegado</CardTitle>
                    <CardDescription className="text-white sr-only">
                        Has sido baneado
                    </CardDescription>
                </CardHeader>
                <CardContent className="w-full space-y-4">
                    <div className="w-full space-y-2">
                        <p className="w-full text-white">Se te ha prohibido ingresar a La Nube por el siguiente motivo:</p>
                        <div className="w-full border bg-slate-800/20 rounded-md p-2">
                            <p className="text-white text-sm whitespace-pre-line">{session?.bannedReason}</p>
                        </div>
                        <p className="text-white">Esta prohibición expirará el {formattedDate}</p>
                    </div>
                    <div>
                        <p>Si consideras que es un error, por favor contacta a la administración.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}