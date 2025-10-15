import { Building2, FlaskConical, LucideIcon, Presentation, Users } from "lucide-react";

interface Service {
    name: string;
    description: string;
    image: string;
    link: string;
    icon: LucideIcon;
}

const services: Service[] = [
    {
        name: "Coworking",
        description: "Espacios modernos y colaborativos para desarrollar tu proyecto",
        image: "/images/services/coworking.jpg",
        link: "/services/coworking",
        icon: Building2,
    },
    {
        name: "Laboratorio",
        description: "Accede a un espacio de trabajo personal en la ciudad de La Plata",
        image: "/images/services/laboratorio.jpg",
        link: "/services/laboratorio",
        icon: FlaskConical,
    },
    {
        name: "Auditorio",
        description: "Accede a un espacio de trabajo personal en la ciudad de La Plata",
        image: "/images/services/auditorio.jpg",
        link: "/services/auditorio",
        icon: Presentation,
    },
    {
        name: "Sala de reuniones",
        description: "Accede a un espacio de trabajo personal en la ciudad de La Plata",
        image: "/images/services/sala-de-reuniones.jpg",
        link: "/services/sala-de-reuniones",
        icon: Users,
    },
]

export { services };
export type { Service };

