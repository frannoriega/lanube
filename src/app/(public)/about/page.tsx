import Container from "@/components/atoms/container";

export default function AboutPage() {
  return (
    <Container className="h-fit">
      <div className="h-fit flex flex-col gap-8 my-12 bg-slate-200/30 dark:bg-slate-900/30 backdrop-blur-sm p-4 rounded-xl mx-8">
        <div className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Misión, Visión y Valores</h1>
          <h2 className="text-xl font-bold">Misión</h2>
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
          <h2 className="text-xl font-bold">Visión</h2>
          <p>
            Ser reconocidos como el{" "}
            <b>polo tecnológico de referencia del litoral argentino</b>,
            caracterizado por su capacidad de innovación, la calidad de su
            talento humano y su contribución al desarrollo económico y social
            regional.
          </p>
          <h2 className="text-xl font-bold">Valores Institucionales</h2>
          <ol className="list-disc list-inside">
            <li>
              <b>Colaboración</b>: articulación entre sectores.
            </li>
            <li>
              <b>Innovación</b>: fomento de la creatividad y la investigación
              aplicada.
            </li>
            <li>
              <b>Inclusión</b>: acceso equitativo a la formación y
              oportunidades.
            </li>
            <li>
              <b>Sostenibilidad</b>: crecimiento con enfoque social, ambiental y
              económico.
            </li>
            <li>
              <b>Compromiso local</b>: desarrollo desde y para Concepción del
              Uruguay.
            </li>
          </ol>
        </div>
      </div>
    </Container>
  );
}
