import Container from "@/components/atoms/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Heart, Target } from "lucide-react";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <section className="w-full h-full flex flex-col items-center justify-center">
        <Container className="h-fit my-12 flex flex-col gap-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <h1 className="text-4xl font-bold">Quienes somos</h1>
            <p className="max-w-prose text-center">El Polo Tecnológico “La Nube” es un espacio de innovación creado para articular y potenciar el ecosistema tecnológico de Concepción del Uruguay. Somos el punto de encuentro entre talento, sector productivo, universidades y Estado, con el propósito de generar soluciones tecnológicas que impulsen el desarrollo económico y social.</p>
          </div>
          <div className="flex flex-col w-full items-start gap-8">
            <h2 className="text-2xl font-bold">Presentación institucional</h2>
            <div className="md:hidden w-full h-full rounded-sm overflow-hidden">
              <Image src="/images/stock/coworking.webp" alt="Polo Tecnológico La Nube" width={1024} height={1024} objectFit="contain" />
            </div>
            <div className="flex flex-row w-full items-start gap-8">
              <div className="flex flex-col gap-4 w-full">
                <p>
                  El <b>Polo Tecnológico La Nube</b> es una iniciativa estratégica
                  impulsada por el Gobierno Municipal de Concepción del Uruguay junto
                  con instituciones educativas, el sector privado y organizaciones
                  sociales. Su objetivo principal es{" "}
                  <b>
                    convertir a la ciudad en un referente regional en innovación,
                    desarrollo tecnológico y economía del conocimiento
                  </b>
                  .
                </p>
                <p>
                  Este proyecto nació de un proceso participativo realizado en agosto
                  de 2025, donde distintos actores locales y regionales diseñaron un
                  plan conjunto para impulsar la diversificación productiva, el
                  talento local y la creación de empleo de calidad.
                </p>
                <p>
                  Nuestra misión es ser el punto de encuentro entre empresas,
                  universidades, emprendedores y el sector público, fomentando la
                  creación de empresas y soluciones tecnológicas que impulsen el
                  desarrollo económico y social de la región. {`"La Nube"`} nace con
                  la visión de transformar a Concepción del Uruguay en un referente
                  regional de la Economía del Conocimiento, promoviendo la innovación,
                  el talento y la competitividad en un mundo cada vez más digital y
                  globalizado.
                </p>
              </div>
              <div className="hidden md:block w-full h-full rounded-sm overflow-hidden">
                <Image src="/images/stock/coworking.webp" alt="Polo Tecnológico La Nube" width={1024} height={1024} objectFit="contain" />
              </div>
            </div>
            <div className="flex flex-col gap-4 w-full">
              <p>
                <b>Concepción del Uruguay</b>, con una población cercana a los
                80.000 habitantes y más de 25 empresas activas en el sector de
                Software y Servicios Informáticos, se posiciona como la segunda
                ciudad de la provincia en cantidad de empresas del rubro y la
                primera en densidad por habitante. Además, es sede de destacadas
                instituciones universitarias que la consolidan como un polo
                tecnológico y de servicios informáticos en pleno crecimiento.
              </p>
              <p>
                Por ello en este sentido nos acompañan en la gestión del polo la
                CISCU (Cámara de Industria del Software de Concepción del Uruguay) y
                las Universidades: Universidad Nacional de Entre Ríos (UNER),
                Universidad Tecnológica Nacional (UTN), Universidad Autónoma de
                Entre Ríos (UADER) y Universidad de Concepción del Uruguay (UCU).
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-12 items-stretch justify-between">
            <InfoCard data="+25" title="Empresas SSI" />
            <InfoCard data="+130" title="Carreras superiores" />
            <InfoCard data="+500" title="Estudiantes de carreras tecnológicas por año" />
          </div>
        </Container>
      </section>
      <section className="w-full h-full bg-slate-400/60 flex flex-col items-center justify-center">
        <Container className="h-fit flex flex-col py-16 gap-8 w-full">
          <div className="flex flex-row items-center justify-center w-full py-8">
            <h1 className="text-4xl font-bold">Misión, Visión y Valores</h1>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-3xl font-semibold">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Target size={48} />
                    <h2>Nuestra misión</h2>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Promover el desarrollo del ecosistema tecnológico de Concepción del
                  Uruguay y la región,{" "}
                  <b>
                    articulando actores públicos, privados, académicos y de la
                    sociedad civil
                  </b>{" "}
                  para generar innovación, empleo de calidad y soluciones tecnológicas
                  que contribuyan al desarrollo sustentable.
                </p>
              </CardContent>
            </Card>
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-3xl font-semibold">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Eye size={48} />
                    <h2>Nuestra visión</h2>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>Ser reconocidos como el polo tecnológico de referencia del litoral argentino, caracterizado por su capacidad de innovación, la calidad de su talento humano y su contribución al desarrollo económico y social regional.</p>
              </CardContent>
            </Card>
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-3xl font-semibold">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Heart size={48} />
                    <h2>Nuestros valores</h2>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>Ser reconocidos como el polo tecnológico de referencia del litoral argentino, caracterizado por su capacidad de innovación, la calidad de su talento humano y su contribución al desarrollo económico y social regional.</p>
              </CardContent>
            </Card>
          </div>
        </Container>
      </section>
    </div>
  );
}

function InfoCard({ data, title }: { data: string, title: string }) {
  return (
    <Card className="flex w-full">
      <CardHeader className="sr-only">
        <CardTitle className="text-2xl">{data} {title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 w-full h-full flex flex-col text-center items-center justify-start">
        <p className="text-4xl font-bold text-la-nube-primary">{data}</p>
        <p className="text-slate-700 dark:text-slate-200 font-semibold text-lg max-w-50">{title}</p>
      </CardContent>
    </Card>
  )
}
