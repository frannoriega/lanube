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
        description: "Espacio flexible para trabajo individual y colaborativo. Mesas compartidas y livings con puntos de energía y conectividad de alta velocidad. Ideal para programar, diseñar, investigar, atender reuniones breves y avanzar proyectos tecnológicos.",
        image: "/images/services/coworking.jpg",
        link: "/services/coworking",
        icon: Building2,
    },
    {
        name: "Laboratorio",
        description: "Ámbito reservado para 6–10 personas (según montaje). Mesa de trabajo,. Pensada para planificaciones, presentaciones a equipos y entrevistas",
        image: "/images/services/laboratorio.jpg",
        link: "/services/laboratorio",
        icon: FlaskConical,
    },
    {
        name: "Auditorio",
        description: "Ambiente amplio y modular para charlas, talleres y presentaciones. Soporte de proyección/sonido y posibilidad de transmisión en línea. Apto para actividades académicas, empresariales y comunitarias. Capacidad para 50 personas",
        image: "/images/services/auditorio.jpg",
        link: "/services/auditorio",
        icon: Presentation,
    },
    {
        name: "Sala de reuniones",
        description: "Ámbito reservado para 6–10 personas (según montaje). Mesa de trabajo, pantalla/pizarra digital. Pensada para planificaciones, presentaciones a equipos y entrevistas.",
        image: "/images/services/sala-de-reuniones.jpg",
        link: "/services/sala-de-reuniones",
        icon: Users,
    },
]

export { services };
export type { Service };

