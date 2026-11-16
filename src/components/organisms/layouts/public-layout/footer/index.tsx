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
import { buildCommit, SOURCE_LICENSE, sourceUrl } from "@/lib/build-info";
import { getPublicSiteConfig } from "@/lib/cache/public-reads";
import { APP_VERSION } from "@/lib/changelog/registry";
import { links } from "@/lib/constants/nav";
import { POLICIES, POLICY_KEYS } from "@/lib/policies/registry";
import { cn } from "@/lib/utils";
import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

export default async function Footer({ className }: { className?: string }) {
  const contact = await getPublicSiteConfig();
  // Identidad del build (milestone 28). Se resuelve al prerenderizar, con el commit de la imagen.
  const commit = buildCommit();
  // Azul noche de marca (milestone 18) en vez de `slate-950`: el casi-negro neutro no
  // pertenecía a ninguna paleta del sitio; éste es el mismo fondo de la franja de cifras.
  const cns = cn(
    `w-full h-fit bg-la-nube-night border-t border-la-nube-primary/20`,
    className,
  );
  return (
    <footer className={cns}>
      <Container>
        <div className="dark text-foreground p-8 flex flex-col md:flex-row gap-16">
          <section className="flex flex-col gap-2 w-fit md:max-w-1/3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <h2 className="text-xl font-bold">La Nube</h2>
                {/* La versión que corre (milestone 28; antes decía «Beta»). Lleva a las novedades. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="font-mono hover:bg-white/10"
                      asChild
                    >
                      <Link href="/changelog">v{APP_VERSION}</Link>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Versión {APP_VERSION}. Mirá qué hay de nuevo.</p>
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
                rel="noopener noreferrer"
                aria-label="Municipalidad de Concepción del Uruguay"
              >
                <LogoMunicipio size={200} />
              </Link>
            </div>
          </section>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-fit">
            <div className="flex flex-col gap-2 w-fit">
              <h2 className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-la-nube-secondary">
                Enlaces Rápidos
              </h2>
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
                  {/* Solo en el pie, no en la barra (milestone 28). */}
                  <li>
                    <Link
                      href="/changelog"
                      className="block py-2 hover:underline"
                    >
                      Novedades
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="flex flex-col gap-2 w-fit">
              <h2 className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-la-nube-secondary">
                Políticas
              </h2>
              <nav>
                <ul className="text-foreground flex flex-col">
                  {/* Del registro de políticas (milestone 19): una nueva aparece sola. */}
                  {POLICY_KEYS.map((key) => (
                    <li key={key}>
                      <Link
                        href={`/policies/${POLICIES[key].slug}`}
                        className="block py-2 hover:underline"
                      >
                        {POLICIES[key].title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="flex flex-col gap-2 max-w-100 w-fit">
              <h2 className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-la-nube-secondary">
                Contacto
              </h2>
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
        {/*
          Oferta del código fuente (AGPL-3.0 §13, milestone 28): quien usa el sistema por la red
          tiene que poder obtener el código de la versión que está usando. El enlace va al commit
          exacto del build y está en el código, no en la configuración del sitio, a propósito:
          una versión modificada que se despliegue tiene que apuntar a su propio código.
        */}
        <div className="dark mx-8 flex flex-col gap-1 border-t border-white/10 py-4 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
          <span>La Nube es software libre ({SOURCE_LICENSE}).</span>
          <a
            href={sourceUrl(commit)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Código fuente de esta versión
            {commit ? ` (v${APP_VERSION} · ${commit.slice(0, 7)})` : ""}
          </a>
        </div>
      </Container>
    </footer>
  );
}
