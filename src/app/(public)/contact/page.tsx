import Container from "@/components/atoms/container";
import Github from "@/components/atoms/icons/github";
import Instagram from "@/components/atoms/icons/instagram";
import { Card, CardContent } from "@/components/ui/card";
import {
  address,
  clickablePhone,
  email,
  phone,
  socialMedia,
} from "@/lib/constants/contact";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
  description: `Contactá a La Nube - Polo Tecnológico: ${address.street}, ${address.city}, ${address.state}, ${address.country}. Teléfono ${phone} y correo ${email}.`,
  alternates: { canonical: "/contact" },
};

const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}, ${address.country}`;
const mapsQuery = encodeURIComponent(fullAddress);

export default function ContactPage() {
  return (
    <Container className="flex flex-col gap-8 px-8 py-16">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
          ~/ contacto
          <span className="animate-blink">▌</span>
        </span>
        <h1 className="text-5xl font-bold">
          Hablemos de tu{" "}
          <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
            proyecto
          </span>
        </h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          Escribinos para reservar un espacio, proponer un evento o sumarte al
          ecosistema tecnológico de Concepción del Uruguay.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="flex flex-col gap-2 p-6">
            <h2 className="text-xl font-bold">Dónde estamos</h2>
            <ul className="flex flex-col">
              <li className="flex flex-row items-center gap-2 py-1.5">
                <MapPin size={16} className="shrink-0" />
                <span>{fullAddress}</span>
              </li>
              <li>
                <a
                  href={`mailto:${email}`}
                  className="flex flex-row items-center gap-2 py-1.5 hover:underline"
                >
                  <Mail size={16} className="shrink-0" />
                  <span>{email}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${clickablePhone}`}
                  className="flex flex-row items-center gap-2 py-1.5 hover:underline"
                >
                  <Phone size={16} className="shrink-0" />
                  <span>{phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={socialMedia.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-row items-center gap-2 py-1.5 hover:underline"
                >
                  <Instagram size={16} className="shrink-0" />
                  <span>{socialMedia.instagram.text}</span>
                </a>
              </li>
              <li>
                <a
                  href={socialMedia.github.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-row items-center gap-2 py-1.5 hover:underline"
                >
                  <Github size={16} className="shrink-0" />
                  <span>{socialMedia.github.text}</span>
                </a>
              </li>
            </ul>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex w-fit flex-row items-center gap-2 font-medium text-la-nube-primary hover:underline dark:text-la-nube-secondary"
            >
              Cómo llegar
              <ExternalLink size={14} />
            </a>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border border-border">
          <iframe
            title={`Ubicación de La Nube: ${fullAddress}`}
            src={`https://www.google.com/maps?q=${mapsQuery}&output=embed&hl=es`}
            className="h-80 w-full lg:h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </Container>
  );
}
