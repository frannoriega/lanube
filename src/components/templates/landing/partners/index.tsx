"use client";

import Container from "@/components/atoms/container";
import { Marquee } from "@/components/molecules/marquee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import Link from "next/link";
import Image from "next/image";
import { Partner, partners } from "@/lib/constants/partners";

const MOBILE_BREAKPOINT = 768;

export default function PartnersSection() {
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
                    <h2 className="text-5xl font-bold text-center md:text-left">Socios</h2>
                    <h3 className="text-2xl text-slate-500">
                        Empresas y organizaciones que confían en nosotros y forman parte de nuestro ecosistema
                    </h3>
                </div>
                <div className="w-full flex flex-row">
                    <Marquee direction="right" gradientWidth={gradientWidth} speed={50} pauseOnHover className="py-4">
                        {partners.map((partner) => (
                            <PartnerCard key={partner.id} partner={partner} />
                        ))}
                    </Marquee>
                </div>
            </Container>
        </section>
    )
}

function PartnerCard({ partner }: { partner: Partner }) {
    return (
        <div className="mx-2">
            <Link href={partner.url} target="_blank">
                <Card className="flex flex-col gap-4 bg-slate-50 grayscale transition-all duration-300 hover:grayscale-0 hover:scale-105">
                    <CardHeader className="sr-only text-center w-full">
                        <CardTitle className="text-2xl">{partner.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] flex flex-col items-center justify-center rounded-md">
                        <Image src={partner.img} alt={partner.name} width={200} height={200} className="object-contain h-full rounded-md" />
                    </CardContent>
                </Card>
            </Link>
        </div>
    )
}