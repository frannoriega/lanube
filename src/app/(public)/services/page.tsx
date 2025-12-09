import Container from "@/components/atoms/container";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function ServicesPage() {
  return (
    <Container className="h-fit">
      <div className="h-fit flex flex-col gap-4 my-12 rounded-xl mx-8">
        <h1 className="text-4xl font-bold w-full text-center">
          Nuestros servicios
        </h1>
        <ServiceCard
          title="Coworking"
          description={() => (
            <>
              <p>
                El espacio de coworking está pensado para que personas y equipos
                puedan trabajar, estudiar o desarrollar proyectos en un entorno
                colaborativo orientados a la tecnología.
              </p>
              <p>
                Es ideal para emprendedores, estudiantes, profesionales
                independientes y equipos de trabajo que necesitan un lugar
                tranquilo, cómodo y conectado para sus actividades diarias.
              </p>
            </>
          )}
          image="/images/coworking.jpg"
          services={() => (
            <ul className="list-disc list-inside">
              <li>
                <b>Puestos de trabajo flexibles</b> por hora, por día o por
                proyecto
              </li>
              <li>
                <b>Conectividad a Internet</b>
              </li>
              <li>
                <b>Acompañamiento y orientación básica</b> en el uso de
                herramientas tecnológicas
              </li>
            </ul>
          )}
          equipments={() => (
            <ul className="list-disc list-inside">
              <li>
                <b>3 islas de trabajo</b> con 4 espacios por mesa, haciendo un
                total de <b>12 puestos de trabajo</b>.
              </li>
              <li>
                <b>3 livings completos</b>, cada uno con mesa, sillones y pufs,
                ideales para reuniones informales o trabajo más distendido.
              </li>
              <li>
                <b>Proyector y pantalla de alta definición</b>, que permiten
                realizar presentaciones, encuentros virtuales o instancias de
                capacitación dentro del mismo espacio.
              </li>
              <li>
                <b>Conectividad Wi-Fi</b> de alta velocidad y{" "}
                <b>tomas eléctricas</b> para la conexión de notebooks y otros
                dispositivos.
              </li>
            </ul>
          )}
          pos="left"
        />
        <ServiceCard
          title="Sala de reuniones"
          description={() => (
            <p>
              La sala de reuniones está diseñada para encuentros de trabajo en
              grupos reducidos, tutorías, entrevistas, mesas de planificación y
              reuniones institucionales, tanto presenciales como virtuales o
              híbridas orientadas a la tecnología.
            </p>
          )}
          services={() => (
            <ul className="list-disc list-inside">
              <li>
                Realización de reuniones presenciales, virtuales e híbridas con
                alta calidad de audio y video
              </li>
              <li>
                Presentaciones interactivas sobre la pantalla táctil
                (anotaciones, gráficos, esquemas, etc.)
              </li>
              <li>
                Espacio confortable y reservado para trabajos que requieren
                concentración, toma de decisiones y confidencialidad
              </li>
            </ul>
          )}
          equipments={() => (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold">
                  Pantalla táctil interactiva
                </h2>
                <ul className="list-disc list-inside">
                  <li>
                    <b>Resolución:</b> 3840 x 2160 píxeles (UHD)
                  </li>
                  <li>
                    <b>Tecnología táctil:</b> multitáctil
                  </li>
                  <li>
                    <b>Conectividad física:</b>
                    <ul className="pl-4 list-[square] list-inside">
                      <li>1 puerto DisplayPort</li>
                      <li>4 puertos HDMI</li>
                      <li>1 puerto VGA (D-Sub)</li>
                    </ul>
                  </li>
                  <li>
                    <b>Conectividad inalámbrica:</b>
                    <ul className="pl-4 list-[square] list-inside">
                      <li>Bluetooth 5.0</li>
                      <li>Conexión a Wi-Fi</li>
                    </ul>
                  </li>
                  <li>
                    <b>Software:</b> Programas y herramientas para gráficos,
                    anotaciones y exposiciones en reuniones, que facilitan el
                    trabajo colaborativo sobre la pantalla.
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold">
                  Sistema de videoconferencia Poly Studio R30
                </h2>
                <ul className="list-disc list-inside">
                  <li>
                    <b>Altavoz integrado omnidireccional</b>, que mejora la
                    calidad del sonido para escuchar con claridad a todas las
                    personas que participan.
                  </li>
                  <li>
                    <b>Cámara de alta calidad</b> con campo de visión de{" "}
                    <b>120°</b> y tecnología de cámara inteligente{" "}
                    <b>Poly DirectorAI</b>, que encuadra automáticamente y
                    optimiza la imagen de quienes hablan.
                  </li>
                  <li>
                    <b>Matriz de 3 micrófonos</b> con tecnologías de audio que
                    bloquean ruidos que distraen y permiten que las voces se
                    escuchen con nitidez.
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold">Isla de trabajo</h2>
                <ul className="list-disc list-inside">
                  <li>
                    <b>Mesa central</b> con capacidad para 6 a 8 personas,
                    pensada para reuniones de equipo, trabajo colaborativo y
                    planificación.
                  </li>
                </ul>
              </div>
            </div>
          )}
          image="/images/meeting.jpg"
          pos="right"
        />
        <ServiceCard
          title="Sala de conferencias"
          description={() => (
            <p>
              La sala de conferencias está pensada para actividades orientadas a
              la tecnología con mayor cantidad de asistentes: charlas,
              presentaciones, paneles, jornadas, capacitaciones y eventos
              institucionales.
            </p>
          )}
          services={() => (
            <ul className="list-disc list-inside">
              <li>
                Realización de conferencias, charlas, paneles, jornadas y
                capacitaciones
              </li>
              <li>
                Eventos presenciales e híbridos con soporte de audio, video y
                proyección
              </li>
              <li>
                Uso del equipamiento para presentaciones multimedia y
                transmisión de contenidos
              </li>
            </ul>
          )}
          equipments={() => (
            <ul className="list-disc list-inside">
              <li>
                <b>Capacidad para aproximadamente 50 personas</b>, con
                disposición adaptable según el tipo de actividad (filas, aula,
                trabajo en grupos, etc.).
              </li>
              <li>
                <b>Pantalla gigante para charlas y conferencias</b>, integrada
                al sistema de sonido del espacio.
              </li>
              <li>
                <b>Sistema de sonido integrado</b>, adecuado para presentaciones
                orales, proyecciones y actividades formativas.
              </li>
              <li>
                <b>Cámara Logitech para conferencias</b>, que permite realizar
                transmisiones, videoconferencias y actividades híbridas
                (presencial + virtual).
              </li>
              <li>
                Posibilidad de conexión <b>USB y HDMI</b> al sistema de pantalla
                y sonido, facilitando la vinculación de notebooks y otros
                dispositivos para presentaciones.
              </li>
            </ul>
          )}
          image="/images/auditorium.jpg"
          pos="left"
        />
        <ServiceCard
          title="Laboratorio"
          description={() => (
            <p>
              El laboratorio es un espacio destinado principalmente a{" "}
              <b>reuniones de trabajo y actividades en equipo</b>, pensado como
              ámbito de apoyo para proyectos, planificación y trabajos
              colaborativos.
            </p>
          )}
          services={() => (
            <ul className="list-disc list-inside">
              <li>Reuniones de trabajo en equipo y espacios de coordinación</li>
              <li>
                Desarrollo de actividades de planificación, diseño de proyectos
                y trabajo colaborativo
              </li>
              <li>
                Uso como ámbito de apoyo para grupos que requieren un entorno
                tranquilo y con conectividad
              </li>
            </ul>
          )}
          equipments={() => (
            <>
              <ul className="list-disc list-inside">
                <li>
                  <b>Una mesa de trabajo</b> con capacidad para{" "}
                  <b>8 a 10 personas</b>.
                </li>
                <li>
                  <b>Tomas corrientes</b> distribuidas para la conexión de
                  notebooks y dispositivos electrónicos.
                </li>
                <li>
                  <b>Acceso a Wi-Fi</b>, que permite el trabajo conectado y el
                  uso de herramientas digitales en línea.
                </li>
              </ul>
              <p>
                No cuenta con otro tipo de equipamiento específico, lo que lo
                convierte en un espacio flexible que puede adaptarse a distintas
                dinámicas de trabajo grupal.
              </p>
            </>
          )}
          image="/images/lab.jpg"
          pos="right"
        />
      </div>
    </Container>
  );
}

function ServiceCard({
  title,
  description,
  image,
  services,
  equipments,
  pos,
}: {
  title: string;
  description: () => React.ReactNode;
  image: string;
  services: () => React.ReactNode;
  equipments?: () => React.ReactNode;
  pos: "left" | "right";
}) {
  return (
    <Card className="h-fit w-full flex flex-col gap-4 glass-card dark:glass-card-dark">
      <CardHeader>
        <CardTitle className="sr-only">{title}</CardTitle>
        <CardDescription className="sr-only">{description()}</CardDescription>
      </CardHeader>
      <CardContent className="h-fit w-full flex flex-col gap-4">
        <div className="h-fit w-full space-y-4">
          <ImageWithTitle
            image={image}
            title={title}
            pos={pos}
            className="rounded-xl overflow-hidden w-3/5 mb-2"
          />
          {description()}
        </div>
        <Accordion
          type="multiple"
          className="w-full dark:bg-white/20 bg-slate-700/20 px-4 rounded-xl"
        >
          <AccordionItem value="services">
            <AccordionTrigger className="text-base">
              ¿Qué ofrecemos?
            </AccordionTrigger>
            <AccordionContent className="text-base">
              {services()}
            </AccordionContent>
          </AccordionItem>
          {equipments && (
            <AccordionItem value="equipments">
              <AccordionTrigger className="text-base">
                ¿Qué equipos tenemos disponibles?
              </AccordionTrigger>
              <AccordionContent className="text-base">
                {equipments()}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function ImageWithTitle({
  image,
  title,
  pos,
  className,
}: {
  image: string;
  title: string;
  pos: "left" | "right";
  className?: string;
}) {
  const cns = cn(
    `relative flex flex-col gap-4 h-fit mb-0 mt-0 ${pos === "left" ? "float-left mr-4" : "float-right ml-4"}`,
    className,
  );
  return (
    <div className={cns}>
      <Image
        src={image}
        alt={title}
        width={1024}
        height={1024}
        objectFit="contain"
        className="self-start"
      />
      <div
        className={`absolute py-8 px-24 bg-la-nube-primary/50 backdrop-blur-xs top-4 ${pos === "left" ? "left-0 rounded-r-full" : "right-0 rounded-l-full"}`}
      >
        <h3 className="text-2xl font-bold text-white">{title}</h3>
      </div>
    </div>
  );
}
