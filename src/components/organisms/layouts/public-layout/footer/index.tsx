import Container from "@/components/atoms/container";
import Instagram from "@/components/atoms/icons/instagram";
import LogoLaNube from "@/components/atoms/logos/lanube";
import LogoMunicipio from "@/components/atoms/logos/municipio";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  address,
  clickablePhone,
  email,
  phone,
  socialMedia,
} from "@/lib/constants/contact";
import { links } from "@/lib/constants/nav";
import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

export default function Footer({
  transparent = true,
}: {
  transparent?: boolean;
}) {
  return (
    <footer
      className={`w-full h-fit ${transparent ? "bg-slate-300/60 dark:bg-slate-950/60  backdrop-blur-xs" : "bg-slate-300 dark:bg-slate-950"}`}
    >
      <Container>
        <div className="p-8 flex flex-row justify-evenly">
          <section className="flex flex-col gap-2 max-w-1/3 justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <h1 className="text-xl font-bold">La Nube</h1>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="cursor-default">
                      Beta
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Versión inicial del sistema. Estamos trabajando para
                      mejorar la experiencia de usuario.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="dark:text-muted-foreground text-slate-600">
                Impulsamos la Economía del Conocimiento en nuestra ciudad,
                conectando empresas, universidades, emprendedores y sector
                público para transformar el futuro.
              </p>
            </div>
            <div className="flex flex-row gap-12 items-center justify-start">
              <LogoLaNube />
              <Link
                href="https://www.cdeluruguay.gob.ar/"
                target="_blank"
                aria-label="Municipalidad de Concepción del Uruguay"
              >
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
            <h1 className="text-xl font-bold">Políticas</h1>
            <nav>
              <ul className="dark:text-muted-foreground text-slate-600 flex flex-col gap-1">
                <li>
                  <Link href="/policies/privacy">Política de Privacidad</Link>
                </li>
              </ul>
            </nav>
          </section>
          <section className="flex flex-col gap-2 max-w-1/3 px-4">
            <h1 className="text-xl font-bold">Contacto</h1>
            <ul className="dark:text-muted-foreground text-slate-600 flex flex-col gap-1">
              <li className="flex flex-row gap-2 items-start justify-start">
                <MapPin size={16} className="mt-[4px]" />
                <span>
                  {address.street}, {address.city}, {address.state}
                </span>
              </li>
              <li className="flex flex-row gap-2 items-start justify-start">
                <a
                  href={`mailto:${email}`}
                  className="flex flex-row gap-2 items-start justify-start"
                >
                  <Mail size={16} className="mt-[4px]" />
                  <span>{email}</span>
                </a>
              </li>
              <li className="flex flex-row gap-2 items-start justify-start">
                <a
                  href={`tel:${clickablePhone}`}
                  className="flex flex-row gap-2 items-start justify-start"
                >
                  <Phone size={16} className="mt-[4px]" />
                  <span>{phone}</span>
                </a>
              </li>
              <li className="flex flex-row gap-2 items-start justify-start">
                <a
                  href={socialMedia.instagram.url}
                  className="flex flex-row gap-2 items-start justify-start"
                >
                  <Instagram size={16} className="mt-[4px]" />
                  <span>{socialMedia.instagram.text}</span>
                </a>
              </li>
            </ul>
          </section>
        </div>
      </Container>
    </footer>
  );
}
