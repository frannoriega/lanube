import Container from "@/components/atoms/container";
import Github from "@/components/atoms/icons/github";
import Instagram from "@/components/atoms/icons/instagram";
import Brand from "@/components/atoms/logos/brand";
import LogoMunicipio from "@/components/atoms/logos/municipio";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getBrand, getCopy } from "@/config";
import { getSiteConfig } from "@/lib/db/siteConfig";
import { links } from "@/lib/constants/nav";
import { cn } from "@/lib/utils";
import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

export default async function Footer({ className }: { className?: string }) {
  const contact = await getSiteConfig();
  const brand = getBrand();
  const copy = getCopy();
  const cns = cn(`w-full h-fit bg-slate-950 dark:bg-slate-950/80`, className);
  return (
    <footer className={cns}>
      <Container>
        <div className="dark text-foreground p-8 flex flex-col md:flex-row gap-16">
          <section className="flex flex-col gap-2 w-fit md:max-w-1/3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <h2 className="text-xl font-bold">{brand.name}</h2>
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
                {copy.hero.description}
              </p>
            </div>
            <div className="flex flex-row flex-wrap w-full items-center gap-4 justify-center md:justify-start">
              <div>
                <Brand />
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
                <li>
                  <a
                    href={contact.addressUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <MapPin size={16} className="shrink-0" />
                    <span>{contact.addressText}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <Mail size={16} className="shrink-0" />
                    <span>{contact.email}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`tel:${contact.phoneClickable}`}
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <Phone size={16} className="shrink-0" />
                    <span>{contact.phoneText}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={contact.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <Instagram size={16} className="shrink-0" />
                    <span>{contact.instagramText}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={contact.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-row gap-2 items-center py-1.5 hover:underline"
                  >
                    <Github size={16} className="shrink-0" />
                    <span>{contact.githubText}</span>
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
