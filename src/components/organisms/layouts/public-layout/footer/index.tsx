import Container from "@/components/atoms/container";
import Github from "@/components/atoms/icons/github";
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
import { cn } from "@/lib/utils";
import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

export default function Footer({ className }: { className?: string }) {
  const cns = cn(`w-full h-fit bg-slate-950 dark:bg-slate-950/80`, className);
  return (
    <footer className={cns}>
      <Container>
        <div className="dark text-foreground p-8 flex flex-col md:flex-row gap-16">
          <section className="flex flex-col gap-2 w-fit md:max-w-1/3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <h2 className="text-xl font-bold">La Nube</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="cursor-help">
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
              <p className="text-foreground max-w-prose">
                Impulsamos la Economía del Conocimiento en nuestra ciudad,
                conectando empresas, universidades, emprendedores y sector
                público para transformar el futuro.
              </p>
            </div>
            <div className="flex flex-row flex-wrap w-full items-center gap-4 justify-center md:justify-start">
              <div>
                <LogoLaNube />
              </div>
              <Link
                href="https://www.cdeluruguay.gob.ar/"
                target="_blank"
                aria-label="Municipalidad de Concepción del Uruguay"
              >
                <LogoMunicipio size={200} />
              </Link>
            </div>
          </section>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-fit">
            <div className="flex flex-col gap-2 w-fit">
              <h2 className="text-xl font-bold">Enlaces Rápidos</h2>
              <nav>
                <ul className="text-foreground flex flex-col">
                  {links.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="block py-2 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="flex flex-col gap-2 w-fit">
              <h2 className="text-xl font-bold">Políticas</h2>
              <nav>
                <ul className="text-foreground flex flex-col">
                  <li>
                    <Link
                      href="/policies/privacy"
                      className="block py-2 hover:underline"
                    >
                      Política de Privacidad
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="flex flex-col gap-2 max-w-100 w-fit">
              <h2 className="text-xl font-bold">Contacto</h2>
              <ul className="text-foreground flex flex-col">
                <li className="flex flex-row gap-2 items-center py-1.5">
                  <MapPin size={16} className="shrink-0" />
                  <span>
                    {address.street}, {address.city}, {address.state}
                  </span>
                </li>
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <Mail size={16} className="shrink-0" />
                    <span>{email}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`tel:${clickablePhone}`}
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <Phone size={16} className="shrink-0" />
                    <span>{phone}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={socialMedia.instagram.url}
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <Instagram size={16} className="shrink-0" />
                    <span>{socialMedia.instagram.text}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={socialMedia.github.url}
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <Github size={16} className="shrink-0" />
                    <span>{socialMedia.github.text}</span>
                  </a>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </Container>
    </footer>
  );
}
