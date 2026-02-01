"use client";

import Container from "@/components/atoms/container";
import { Marquee } from "@/components/molecules/marquee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import { Member, members } from "@/lib/constants/members";
import Link from "next/link";
import Image from "next/image";

const MOBILE_BREAKPOINT = 768;

export default function MembersSection() {
    const viewportWidth = useViewportWidth();
    const gradientWidth = viewportWidth !== undefined
        ? viewportWidth < MOBILE_BREAKPOINT
            ? 40
            : 120
        : 120;

    return (
        <section className="w-full flex flex-col items-center">
            <Container className="px-8 py-16 gap-8 flex flex-col">
                <div className="flex flex-col gap-4">
                    <h2 className="text-5xl font-bold text-center md:text-left">Miembros</h2>
                    <h3 className="text-2xl text-slate-500">
                        Conoce a los profesionales que hacen posible la innovación en nuestro polo tecnológico
                    </h3>
                </div>
                <div className="w-full flex flex-row">
                    <Marquee gradientWidth={gradientWidth} speed={50} pauseOnHover className="py-4">
                        {members.map((member) => (
                            <MemberCard key={member.id} member={member} />
                        ))}
                    </Marquee>
                </div>
            </Container>
        </section>
    )
}

function MemberCard({ member }: { member: Member }) {
    return (
        <div className="mx-2">
            <Link href={member.url} target="_blank" className="block">
                <Card className="flex flex-col gap-4 bg-slate-50 grayscale transition-all duration-300 hover:grayscale-0 hover:scale-105">
                    <CardHeader className="sr-only text-center w-full">
                        <CardTitle className="text-2xl">{member.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] flex flex-col items-center justify-center rounded-md">
                        <Image src={member.img} alt={member.name} width={200} height={200} className="object-contain h-full rounded-md" />
                    </CardContent>
                </Card>
            </Link>
        </div>
    )
}