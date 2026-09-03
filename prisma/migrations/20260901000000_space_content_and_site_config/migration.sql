-- Space rich content: long-form markdown description + dynamic FAQ (shown on the public
-- "Espacios" page). The short `description` stays the landing/booking overview blurb.
ALTER TABLE "spaces" ADD COLUMN "long_description" TEXT;
ALTER TABLE "spaces" ADD COLUMN "faqs" JSONB;

-- Singleton site configuration (superadmin-editable public contact info). Seeded from the
-- values that previously lived in src/lib/constants/contact.ts.
CREATE TABLE "site_config" (
  "id"              TEXT NOT NULL DEFAULT 'site',
  "address_text"    TEXT NOT NULL,
  "address_url"     TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "phone_text"      TEXT NOT NULL,
  "phone_clickable" TEXT NOT NULL,
  "instagram_url"   TEXT NOT NULL,
  "instagram_text"  TEXT NOT NULL,
  "github_url"      TEXT NOT NULL,
  "github_text"     TEXT NOT NULL,
  "updated_at"      BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
  CONSTRAINT "site_config_pkey" PRIMARY KEY ("id")
);

INSERT INTO "site_config" (
  "id", "address_text", "address_url", "email",
  "phone_text", "phone_clickable",
  "instagram_url", "instagram_text", "github_url", "github_text"
) VALUES (
  'site',
  'Maipú esquina Posadas, Concepción del Uruguay, Entre Ríos',
  'https://www.google.com/maps/search/?api=1&query=Maip%C3%BA%20esquina%20Posadas%2C%20Concepci%C3%B3n%20del%20Uruguay%2C%20Entre%20R%C3%ADos',
  'polotecnologicolanube@gmail.com',
  '(+54) 9 3442 550836',
  '+5493442550836',
  'https://www.instagram.com/lanubepolotec',
  'lanubepolotec',
  'https://github.com/frannoriega/lanube',
  'lanube'
) ON CONFLICT ("id") DO NOTHING;

-- Backfill the existing spaces' long description + FAQ from the content that previously lived
-- hardcoded in the public "Servicios" page. Guarded by `long_description IS NULL` so it runs
-- once and never clobbers content a superadmin has since edited. (On a fresh DB the spaces
-- table is still empty here — these no-op, and the seed provides the same content.)
UPDATE "spaces" SET
  "long_description" = E'El espacio de coworking está pensado para que personas y equipos puedan trabajar, estudiar o desarrollar proyectos en un entorno colaborativo orientado a la tecnología.\n\nEs ideal para emprendedores, estudiantes, profesionales independientes y equipos de trabajo que necesitan un lugar tranquilo, cómodo y conectado para sus actividades diarias.',
  "faqs" = '[{"question":"¿Qué ofrecemos?","answer":"- **Puestos de trabajo flexibles** por hora, por día o por proyecto\n- **Conectividad a Internet**\n- **Acompañamiento y orientación básica** en el uso de herramientas tecnológicas"},{"question":"¿Qué equipos tenemos disponibles?","answer":"- **3 islas de trabajo** con 4 espacios por mesa, haciendo un total de **12 puestos de trabajo**.\n- **3 livings completos**, cada uno con mesa, sillones y pufs, ideales para reuniones informales o trabajo más distendido.\n- **Proyector y pantalla de alta definición**, que permiten realizar presentaciones, encuentros virtuales o instancias de capacitación.\n- **Conectividad Wi-Fi** de alta velocidad y **tomas eléctricas** para la conexión de notebooks y otros dispositivos."}]'::jsonb
WHERE "slug" = 'coworking' AND "long_description" IS NULL;

UPDATE "spaces" SET
  "long_description" = E'El laboratorio es un espacio destinado principalmente a **reuniones de trabajo y actividades en equipo**, pensado como ámbito de apoyo para proyectos, planificación y trabajos colaborativos.',
  "faqs" = '[{"question":"¿Qué ofrecemos?","answer":"- Reuniones de trabajo en equipo y espacios de coordinación\n- Desarrollo de actividades de planificación, diseño de proyectos y trabajo colaborativo\n- Uso como ámbito de apoyo para grupos que requieren un entorno tranquilo y con conectividad"},{"question":"¿Qué equipos tenemos disponibles?","answer":"- **Una mesa de trabajo** con capacidad para **8 a 10 personas**.\n- **Tomas corrientes** distribuidas para la conexión de notebooks y dispositivos electrónicos.\n- **Acceso a Wi-Fi**, que permite el trabajo conectado y el uso de herramientas digitales en línea.\n\nNo cuenta con otro tipo de equipamiento específico, lo que lo convierte en un espacio flexible que puede adaptarse a distintas dinámicas de trabajo grupal."}]'::jsonb
WHERE "slug" = 'lab' AND "long_description" IS NULL;

UPDATE "spaces" SET
  "long_description" = E'La sala de reuniones está diseñada para encuentros de trabajo en grupos reducidos, tutorías, entrevistas, mesas de planificación y reuniones institucionales, tanto presenciales como virtuales o híbridas orientadas a la tecnología.',
  "faqs" = '[{"question":"¿Qué ofrecemos?","answer":"- Realización de reuniones presenciales, virtuales e híbridas con alta calidad de audio y video\n- Presentaciones interactivas sobre la pantalla táctil (anotaciones, gráficos, esquemas, etc.)\n- Espacio confortable y reservado para trabajos que requieren concentración, toma de decisiones y confidencialidad"},{"question":"¿Qué equipos tenemos disponibles?","answer":"### Pantalla táctil interactiva\n- **Resolución:** 3840 x 2160 píxeles (UHD)\n- **Tecnología táctil:** multitáctil\n- **Conectividad física:** 1 puerto DisplayPort, 4 puertos HDMI, 1 puerto VGA (D-Sub)\n- **Conectividad inalámbrica:** Bluetooth 5.0 y Wi-Fi\n- **Software:** herramientas para gráficos, anotaciones y exposiciones en reuniones\n\n### Sistema de videoconferencia Poly Studio R30\n- **Altavoz integrado omnidireccional**, para escuchar con claridad a todos los participantes.\n- **Cámara de alta calidad** con campo de visión de **120°** y tecnología **Poly DirectorAI**.\n- **Matriz de 3 micrófonos** con tecnologías de audio que bloquean ruidos.\n\n### Isla de trabajo\n- **Mesa central** con capacidad para 6 a 8 personas."}]'::jsonb
WHERE "slug" = 'meeting-room' AND "long_description" IS NULL;

UPDATE "spaces" SET
  "long_description" = E'La sala de conferencias está pensada para actividades orientadas a la tecnología con mayor cantidad de asistentes: charlas, presentaciones, paneles, jornadas, capacitaciones y eventos institucionales.',
  "faqs" = '[{"question":"¿Qué ofrecemos?","answer":"- Realización de conferencias, charlas, paneles, jornadas y capacitaciones\n- Eventos presenciales e híbridos con soporte de audio, video y proyección\n- Uso del equipamiento para presentaciones multimedia y transmisión de contenidos"},{"question":"¿Qué equipos tenemos disponibles?","answer":"- **Capacidad para aproximadamente 50 personas**, con disposición adaptable según el tipo de actividad (filas, aula, trabajo en grupos, etc.).\n- **Pantalla gigante para charlas y conferencias**, integrada al sistema de sonido del espacio.\n- **Sistema de sonido integrado**, adecuado para presentaciones orales, proyecciones y actividades formativas.\n- **Cámara Logitech para conferencias**, que permite transmisiones, videoconferencias y actividades híbridas.\n- Posibilidad de conexión **USB y HDMI** al sistema de pantalla y sonido."}]'::jsonb
WHERE "slug" = 'auditorium' AND "long_description" IS NULL;
