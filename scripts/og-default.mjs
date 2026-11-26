/**
 * Genera `public/og-default.png` (1200 × 630): la imagen de vista previa por defecto del sitio
 * (milestone 41). La usan las páginas sin imagen propia (`DEFAULT_OG_IMAGE` en
 * `src/lib/seo/metadata.ts`). Es un archivo estático a propósito: no depende del servidor ni de
 * la base. Debajo del logo va el sello de la Municipalidad junto a «Municipalidad de /
 * Concepción del Uruguay» en dos líneas, con el sello del mismo alto que el texto (v1.3.1: antes
 * era una línea «Coworking · Laboratorio · Eventos — …» que mezclaba espacios, funciones y
 * lugar). El sello acompaña; nunca es la imagen entera.
 *
 * Uso: `node scripts/og-default.mjs` (requiere Playwright, ya instalado para mobile-shots).
 * Volver a correrlo solo si cambia la marca (logo o colores).
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const logo = readFileSync(
  new URL("../public/images/lanube-logo.svg", import.meta.url),
  "utf8",
);
// Blanco sobre transparente: se usa como máscara y el color lo pone el CSS (como en el sitio).
const seal = readFileSync(
  new URL("../public/images/logos/municipio-seal.png", import.meta.url),
).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 44px;
    font-family: "Helvetica Neue", Arial, sans-serif;
    background: radial-gradient(circle at 30% 20%, #2a6297 0%, #0e2a47 55%, #0a1a2e 100%); }
  .pill { background: #f1f5f9; border-radius: 999px; padding: 48px 88px; }
  .pill svg { width: 560px; height: auto; display: block; }
  .city { display: flex; align-items: center; gap: 24px; }
  .seal { aspect-ratio: 640 / 637; background: #75e3f1;
    mask: url(data:image/png;base64,${seal}) center / contain no-repeat;
    -webkit-mask: url(data:image/png;base64,${seal}) center / contain no-repeat; }
  .name { color: #e2f6fb; font-size: 36px; line-height: 1.15; letter-spacing: 0.5px; }
  .name span { display: block; }
  .name .city-name { font-weight: 600; }
</style></head><body>
  <div class="pill">${logo}</div>
  <div class="city">
    <div class="seal"></div>
    <div class="name">
      <span>Municipalidad de</span>
      <span class="city-name">Concepción del Uruguay</span>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "load" });
// El sello toma el alto del bloque de texto (dos líneas), medido ya con la fuente cargada.
await page.evaluate(() => {
  const h = document.querySelector(".name").getBoundingClientRect().height;
  document.querySelector(".seal").style.height = `${h}px`;
});
await page.screenshot({
  path: new URL("../public/og-default.png", import.meta.url).pathname,
});
await browser.close();
console.log("public/og-default.png");
