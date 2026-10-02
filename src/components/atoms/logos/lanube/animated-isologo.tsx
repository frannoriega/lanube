"use client";

import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import { useId } from "react";

/**
 * Isologo de La Nube (la nube sin el texto) dibujado pieza por pieza para poder animarlo
 * (milestone 17). La geometría es la del SVG oficial (`LogoLaNube`, grupo `ISOLOGO`): tres
 * trazos gruesos que forman la nube, diez conectores finos y ocho nodos de color.
 *
 * Cambios respecto del SVG original, ninguno visible en el resultado final:
 * - Los anillos blancos de los nodos y los trazos blancos que "cortan" la nube se pintan con
 *   `var(--background)` en vez de `#fff`, así se leen como huecos tanto en claro como en
 *   oscuro (en blanco puro, en modo oscuro aparecían como bandas blancas).
 * - Los círculos venían con `transform="translate(..) rotate(..)"` de Illustrator; rotar un
 *   círculo sobre su centro no lo cambia, así que se usan `cx/cy` directos (mismo lugar) para
 *   que framer-motion pueda moverlos sin pelearse con ese transform.
 *
 * Dos coreografías (`mode`), ambas controladas desde afuera con `state`:
 * - `"fly"` (hero de la landing): los nodos llegan volando desde fuera de la pantalla, en
 *   espiral y acelerando como atraídos por gravedad; al juntarse hay un destello y una onda,
 *   y recién entonces se dibujan los trazos de la nube y los conectores.
 * - `"draw"` ("La leyenda del logo"): sigue el relato — primero los tres trazos, uno por vez,
 *   después los conectores y por último los nodos ("luego llegaron los nodos").
 *
 * `state`: `"hidden"` (nada visible: el primer render, antes de decidir si se anima),
 * `"play"` (corre la coreografía) o `"static"` (el logo terminado, sin animación: visitas
 * repetidas y `prefers-reduced-motion`).
 */
export type IsologoState = "hidden" | "play" | "static";

/**
 * Trazos de la nube, **en el orden de pintado del SVG original** (importa: ver `gap`).
 *
 * - `step`: en qué turno se dibuja (0 = primero). Es independiente del orden de pintado: se
 *   dibujan abajo-izquierda → arriba → derecha, pero se pintan derecha → arriba → abajo.
 * - `gap`: un trazo del color del fondo, apenas corrido, que se pinta **antes** que su trazo
 *   y **después** de los anteriores: así "corta" el trazo que queda debajo donde se cruzan
 *   (el arco de arriba corta la punta del de la derecha; el de abajo, la punta del de arriba).
 *   Pintarlo encima de su propio trazo —como en la primera versión de este componente— borra
 *   casi todo ese trazo, porque el hueco es prácticamente el mismo camino.
 */
const STROKES: { d: string; gap?: string; step: number }[] = [
  {
    // A la derecha.
    d: "M134.09,120.26c19.15,8.24,39.38-3.91,44.38-22.45,6.02-22.32-11.36-45.32-28.7-47.99-2.46-.38-4.82-.33-7.02,0",
    step: 2,
  },
  {
    // Arriba (el arco grande).
    gap: "M134.09,84.65c12.54-25.43,8.53-53.17-7.89-67.4-14.31-12.41-33.01-10.15-34.14-9.99",
    d: "M132.06,84.65c12.54-25.43,8.53-53.17-7.89-67.4-14.31-12.41-33.01-10.15-34.14-9.99-16.44,2.24-30.6,13.98-37.02,30.59-.37,1.77-.74,3.55-1.11,5.32",
    step: 1,
  },
  {
    // Abajo a la izquierda.
    gap: "M59.97,45.82c-57.6-.02-52.52,43.89-52.44,44.34,0,0,0,0,0,0,0,0,1.77,19.05,15.26,25.19,10.87,8.95,49.7,10.28,75.64-8.56",
    d: "M59.79,47.83c-57.6-.02-52.52,43.89-52.44,44.34,0,0,0,0,0,0,0,0,1.77,19.05,15.26,25.19,10.87,8.95,49.7,10.28,75.64-8.56",
    step: 0,
  },
];

/** Conectores finos entre nodos. */
const CONNECTORS = [
  "M51.65,77.53c1.39,13.23,4.95,31.63,14.46,50.18,2.57,5.02,5.28,9.45,7.96,13.35",
  "M76.29,139.76c-1.37-19.94.12-41.44,6.69-63.25.46-1.53.94-3.04,1.44-4.53",
  "M80.19,58.82c-2.44-2.99-7.1-7.82-13.82-9.74-2.45-.7-4.69-.88-6.58-.82",
  "M111.55,134.59c-5.88,3.63-12.67,6.98-20.42,9.52-1.11.36-2.2.7-3.29,1.01",
  "M167.62,78.23c-3.08,1.58-8.68,4.25-16.31,6.79-3.97,1.32-7.43,2.25-10.09,2.89",
  "M92.06,60.28c15.45-.85,39.22-.72,63.52,5.83,4.65,1.25,8.88,2.63,12.71,4.04",
  "M89.44,56.64c6.06-8.17,17.31-20.32,34.25-24.13,1.82-.41,3.62-.7,5.37-.89",
  "M120.93,123.07c2.71-8.31,5.41-16.63,8.12-24.94",
  "M24.14,98.27c4.98-3.79,10.75-9.09,15.64-16.2,1.63-2.38,2.98-4.68,4.1-6.87",
  "M103.76,106.03c5.92-2.4,12.8-6.16,19.23-12.2,1.14-1.07,2.2-2.15,3.18-3.23",
];

/**
 * Nodos: relleno (centro, radio, color) y, si lo tiene, el anillo-hueco que lo rodea. Las
 * coordenadas son las del SVG original tal cual (anillo y relleno no siempre comparten centro
 * exacto: diferencias de décimas que vienen del archivo de diseño).
 */
const NODES: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  ring?: { cx: number; cy: number; r: number };
}[] = [
  {
    cx: 14.62,
    cy: 106.26,
    r: 12.43,
    fill: "#1c62a3",
    ring: { cx: 14.71, cy: 106.4, r: 14.71 },
  },
  { cx: 79.52, cy: 147.96, r: 8.8, fill: "#336bb3" },
  {
    cx: 131.31,
    cy: 88.25,
    r: 10.01,
    fill: "#3db7e4",
    ring: { cx: 131.59, cy: 88.24, r: 11.91 },
  },
  {
    cx: 133.86,
    cy: 27.12,
    r: 11.44,
    fill: "#1c62a3",
    ring: { cx: 134, cy: 27.01, r: 13.35 },
  },
  {
    cx: 176.27,
    cy: 74.25,
    r: 9.53,
    fill: "#56c3eb",
    ring: { cx: 176.27, cy: 74.25, r: 11.91 },
  },
  { cx: 85.74, cy: 63.77, r: 8.66, fill: "#5bc1d2" },
  { cx: 118.97, cy: 130.85, r: 8.31, fill: "#4189c8" },
  { cx: 50.08, cy: 68.53, r: 9.7, fill: "#91d1db" },
];

/** Centro aproximado de la nube: desde acá sale el destello. */
const CENTER = { x: 96, y: 86 };

/**
 * Trayectoria de llegada de cada nodo (en unidades del viewBox; el logo del hero mide ~200
 * unidades, así que 900 unidades quedan bien afuera de la pantalla). Ángulos repartidos
 * alrededor del logo para que vengan "de todos lados"; el punto intermedio está girado
 * ~50° y mucho más cerca, lo que dibuja una espiral. Determinístico (sin `Math.random`) para
 * que sea igual en cada visita.
 */
function flightPath(i: number) {
  const angle = (i / NODES.length) * Math.PI * 2 + 0.35;
  const swirl = angle + 0.9;
  const far = 900;
  const near = 150;
  return {
    x: [
      Math.cos(angle) * far * 1.4,
      Math.cos(swirl) * near,
      -Math.cos(swirl) * 6,
      0,
    ],
    y: [Math.sin(angle) * far, Math.sin(swirl) * near, -Math.sin(swirl) * 6, 0],
  };
}

/** Tiempos de la coreografía "fly", en segundos (el destello marca el centro). */
const FLY = { land: 1.25, flash: 1.1, strokes: 1.25, connectors: 1.6 };
/** Tiempos de la coreografía "draw". */
const DRAW = { strokeGap: 0.55, strokeDur: 0.9, connectors: 1.7, nodes: 2.1 };

/** Cuánto tarda en total la coreografía "fly": el hero muestra el texto a partir de acá. */
export const ISOLOGO_FLY_TEXT_DELAY = 1.75;

const done = { opacity: 1, pathLength: 1, x: 0, y: 0, scale: 1 };

function strokeVariants(mode: "fly" | "draw"): Variants {
  return {
    hidden: { pathLength: 0, opacity: 0 },
    static: { ...done, transition: { duration: 0 } },
    play: (i: number) => {
      const delay =
        mode === "fly" ? FLY.strokes + i * 0.12 : i * DRAW.strokeGap;
      return {
        pathLength: 1,
        opacity: 1,
        transition: {
          pathLength: {
            delay,
            duration: mode === "fly" ? 0.7 : DRAW.strokeDur,
            ease: "easeInOut",
          },
          opacity: { delay, duration: 0.01 },
        },
      };
    },
  };
}

function connectorVariants(mode: "fly" | "draw"): Variants {
  return {
    hidden: { pathLength: 0, opacity: 0 },
    static: { ...done, transition: { duration: 0 } },
    play: (i: number) => {
      const delay =
        (mode === "fly" ? FLY.connectors : DRAW.connectors) + i * 0.04;
      return {
        pathLength: 1,
        opacity: 1,
        transition: {
          pathLength: { delay, duration: 0.5, ease: "easeOut" },
          opacity: { delay, duration: 0.01 },
        },
      };
    },
  };
}

function nodeVariants(mode: "fly" | "draw"): Variants {
  if (mode === "draw") {
    return {
      hidden: { opacity: 0, scale: 0 },
      static: { ...done, transition: { duration: 0 } },
      play: (i: number) => ({
        opacity: 1,
        scale: 1,
        transition: {
          delay: DRAW.nodes + i * 0.08,
          type: "spring",
          stiffness: 320,
          damping: 14,
        },
      }),
    };
  }
  return {
    hidden: (i: number) => ({
      opacity: 0,
      x: flightPath(i).x[0],
      y: flightPath(i).y[0],
      scale: 0.35,
    }),
    static: { ...done, transition: { duration: 0 } },
    play: (i: number) => {
      const path = flightPath(i);
      return {
        x: path.x,
        y: path.y,
        opacity: [0, 1, 1, 1],
        scale: [0.35, 0.75, 1.1, 1],
        transition: {
          duration: FLY.land - i * 0.03,
          delay: i * 0.03,
          times: [0, 0.62, 0.88, 1],
          // Acelera al acercarse (gravedad), frena y rebota apenas al llegar.
          ease: ["easeIn", "easeOut", "easeInOut"],
        },
      };
    },
  };
}

const flashVariants: Variants = {
  hidden: { opacity: 0, scale: 0.2 },
  static: { opacity: 0, scale: 0.2, transition: { duration: 0 } },
  play: {
    opacity: [0, 1, 0],
    scale: [0.2, 1.4, 2.6],
    transition: {
      delay: FLY.flash,
      duration: 0.9,
      times: [0, 0.3, 1],
      ease: "easeOut",
    },
  },
};

const shockwaveVariants: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  static: { opacity: 0, scale: 0.4, transition: { duration: 0 } },
  play: {
    opacity: [0, 0.8, 0],
    scale: [0.4, 1.8, 4.5],
    transition: {
      delay: FLY.flash + 0.05,
      duration: 1.1,
      times: [0, 0.25, 1],
      ease: "easeOut",
    },
  },
};

export function AnimatedIsologo({
  mode,
  state,
  className,
  title = "La Nube",
}: {
  mode: "fly" | "draw";
  state: IsologoState;
  className?: string;
  title?: string;
}) {
  // Ids únicos por instancia: puede haber más de un isologo en la página.
  const gradientId = `isologo-flash-${useId().replace(/:/g, "")}`;
  const strokes = strokeVariants(mode);
  const connectors = connectorVariants(mode);
  const nodes = nodeVariants(mode);

  return (
    <motion.svg
      viewBox="-4 -4 204 168"
      role="img"
      aria-label={title}
      className={cn("overflow-visible", className)}
      initial="hidden"
      animate={state}
    >
      <defs>
        <radialGradient id={gradientId}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#c8f1fc" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#75e3f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#75e3f1" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Trazos de la nube: cada "hueco" se pinta antes que su trazo (ver STROKES). */}
      {STROKES.map((s) => (
        <g key={s.d}>
          {s.gap && (
            <motion.path
              d={s.gap}
              custom={s.step}
              variants={strokes}
              fill="none"
              stroke="var(--background)"
              strokeWidth={14}
              strokeLinecap="round"
            />
          )}
          <motion.path
            d={s.d}
            custom={s.step}
            variants={strokes}
            fill="none"
            stroke="#a4b9cb"
            strokeWidth={14}
            strokeLinecap="round"
          />
        </g>
      ))}

      {CONNECTORS.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          custom={i}
          variants={connectors}
          fill="none"
          stroke="#a4b9cb"
          strokeWidth={1}
        />
      ))}

      {NODES.map((n, i) => (
        <motion.g key={`${n.cx}-${n.cy}`} custom={i} variants={nodes}>
          {n.ring && (
            <circle
              cx={n.ring.cx}
              cy={n.ring.cy}
              r={n.ring.r}
              fill="var(--background)"
            />
          )}
          <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} />
        </motion.g>
      ))}

      {mode === "fly" && (
        <>
          <motion.circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={70}
            fill={`url(#${gradientId})`}
            variants={flashVariants}
            style={{ pointerEvents: "none" }}
          />
          <motion.circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={40}
            fill="none"
            stroke="#75e3f1"
            strokeWidth={1.5}
            // La onda se agranda con `scale`: sin esto el trazo engordaría junto con ella.
            vectorEffect="non-scaling-stroke"
            variants={shockwaveVariants}
            style={{ pointerEvents: "none" }}
          />
        </>
      )}
    </motion.svg>
  );
}
