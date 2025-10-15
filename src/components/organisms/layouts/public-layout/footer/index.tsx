import Container from "@/components/atoms/container";
import LogoLaNube from "@/components/atoms/logos/lanube";
import LogoMunicipio from "@/components/atoms/logos/municipio";
import { address, email, phone } from "@/lib/constants/contact";
import { links } from "@/lib/constants/nav";
import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

export default function Footer() {
    return (
        <footer className="w-full h-fit bg-slate-300/60 dark:bg-slate-950/60 backdrop-blur-xs">
            <Container>
                <div className="p-8 flex flex-row justify-evenly">
                    <section className="flex flex-col gap-2 max-w-1/3 justify-between">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-xl font-bold">La Nube</h1>
                            <p className="dark:text-muted-foreground text-slate-600">Impulsamos la Economía del Conocimiento en nuestra ciudad, conectando empresas, universidades, emprendedores y sector público para transformar el futuro.</p>
                        </div>
                        <div className="flex flex-row gap-12 items-center justify-start">
                            <LogoLaNube />
                            <Link href="https://www.cdeluruguay.gob.ar/" target="_blank" aria-label="Municipalidad de Concepción del Uruguay">
                                <LogoMunicipio size={200} />
                            </Link>
                        </div>
                    </section>
                    <section className="flex flex-col gap-2 max-w-1/3 px-4">
                        <h1 className="text-xl font-bold">Enlaces Rápidos</h1>
                        <nav>
                            <ul className="dark:text-muted-foreground text-slate-600 flex flex-col gap-1">
                                {links.map((item) => (
                                    <li key={item.name}>
                                        <Link href={item.href}>{item.name}</Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </section>
                    <section className="flex flex-col gap-2 max-w-1/3 px-4">
                        <h1 className="text-xl font-bold">Contacto</h1>
                        <ul className="dark:text-muted-foreground text-slate-600 flex flex-col gap-1">
                            <li className="flex flex-row gap-2 items-start justify-start">
                                <MapPin size={16} className="mt-[4px]" />
                                <span>{address.street}, {address.city}, {address.state}</span>
                            </li>
                            <li className="flex flex-row gap-2 items-start justify-start">
                                <Mail size={16} className="mt-[4px]" />
                                <span>{email}</span>
                            </li>
                            <li className="flex flex-row gap-2 items-start justify-start">
                                <Phone size={16} className="mt-[4px]" />
                                <span>{phone}</span>
                            </li>
                        </ul>
                    </section>
                </div>
            </Container>
        </footer>
    )
}