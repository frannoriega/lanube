// Captura de pantallas en teléfono / tablet / escritorio para el milestone 14
// (docs/milestones/milestones-14-mobile-redesign.md).
//
// Uso:  node scripts/mobile-shots.mjs <nombre> [filtro]
//   - <nombre>: carpeta de salida dentro de `.mobile-shots/` (gitignored), p. ej. "after-drawer".
//   - [filtro]: substring opcional del nombre de la captura (p. ej. "admin-spaces").
// Variables: NO_WARMUP=1 salta el precalentado de rutas; RESUME=1 no re-captura PNGs que ya existen
// (pero sí vuelve a medir el overflow).
//
// Requiere la app corriendo en http://localhost:3000 (stack Docker de este repo) con la base sembrada
// (usuarios u1 / sa1, contraseña 123123123). Usa el `playwright` del repo y el Chromium cacheado.
// Además de las capturas, detecta scroll horizontal a nivel de página (elementos cuyo borde derecho
// supera el viewport fuera de un ancestro con scroll) y lo imprime como "OVF"; `report.jsonl` lo
// guarda por captura.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(REPO, "package.json"));
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const OUT = path.join(REPO, ".mobile-shots", process.argv[2] ?? "shots");
const FILTER = process.argv[3];

// Resolve sample ids from THIS repo's postgres container only.
const q = (sql) =>
  execSync(
    `docker exec lanube-postgres psql -U postgres -d postgres -Atc ${JSON.stringify(sql)}`,
  )
    .toString()
    .trim();
const ids = {
  event: q(
    "select id from events where deleted_at is null order by start_time desc limit 1",
  ),
  news: q("select id from news_posts limit 1"),
  space: q("select id from spaces limit 1"),
  form: q("select id from forms where is_template limit 1"),
  theme: q("select id from landing_themes limit 1"),
  role: q("select id from roles where not is_system limit 1"),
  slug: q(
    "select ef.slug from event_forms ef join events e on e.id=ef.event_id where e.status='PUBLISHED' and e.deleted_at is null limit 1",
  ),
};

const VIEWPORTS = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  tablet: {
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
// Light everywhere; dark only on phone (the main redesign target).
const COMBOS = [
  ["phone", "light"],
  ["phone", "dark"],
  ["tablet", "light"],
  ["desktop", "light"],
];

/** @type {Array<{name:string,user:"user"|"admin"|null,url:string,action?:(p:any)=>Promise<void>}>} */
const SHOTS = [
  { name: "public-landing", user: null, url: "/" },
  { name: "public-signin", user: null, url: "/auth/signin" },
  { name: "public-signup", user: null, url: "/auth/signup" },
  { name: "public-form", user: null, url: `/forms/${ids.slug}` },
  { name: "user-dashboard", user: "user", url: "/user/dashboard" },
  { name: "user-calendar", user: "user", url: "/user/spaces/coworking" },
  {
    name: "user-calendar-booking",
    user: "user",
    url: "/user/spaces/coworking",
    action: async (p) => {
      // Go to next week (this week may be fully blocked by the 24h notice rule); JS click
      // because on narrow viewports the nav buttons are clipped by overflow-hidden.
      await p
        .getByRole("button", { name: /siguiente/i })
        .evaluate((b) => b.click());
      await settle(p);
      await p
        .getByRole("button", { name: /Reservar/ })
        .first()
        .evaluate((b) => b.click());
    },
  },
  { name: "user-events", user: "user", url: "/user/events" },
  { name: "user-settings", user: "user", url: "/user/settings" },
  {
    name: "user-drawer",
    user: "user",
    url: "/user/dashboard",
    onlyNarrow: true,
    action: async (p) => {
      await p.getByRole("button", { name: "Abrir menu" }).click();
    },
  },
  {
    // Menú de admin con "Configuración" expandido: el caso largo que no scrolleaba (hallazgo C).
    name: "admin-drawer",
    user: "admin",
    url: "/admin/dashboard",
    onlyNarrow: true,
    action: async (p) => {
      await p.getByRole("button", { name: "Abrir menu" }).click();
      await p.waitForTimeout(600);
      await p.getByRole("button", { name: /Configuración/ }).click();
    },
  },
  { name: "admin-dashboard", user: "admin", url: "/admin/dashboard" },
  { name: "admin-reservations", user: "admin", url: "/admin/reservations" },
  { name: "admin-users", user: "admin", url: "/admin/users" },
  { name: "admin-checkin", user: "admin", url: "/admin/checkin" },
  { name: "admin-closed-days", user: "admin", url: "/admin/closed-days" },
  {
    name: "admin-closed-day-new",
    user: "admin",
    url: "/admin/closed-days/new",
  },
  { name: "admin-events", user: "admin", url: "/admin/events" },
  { name: "admin-event-new", user: "admin", url: "/admin/events/new" },
  {
    name: "admin-event-edit",
    user: "admin",
    url: `/admin/events/${ids.event}`,
  },
  {
    name: "admin-event-sessions",
    user: "admin",
    url: `/admin/events/${ids.event}?sessions=1`,
  },
  {
    name: "admin-event-participants",
    user: "admin",
    url: `/admin/events/${ids.event}/participants`,
  },
  { name: "admin-forms", user: "admin", url: "/admin/forms" },
  { name: "admin-form-edit", user: "admin", url: `/admin/forms/${ids.form}` },
  { name: "admin-news", user: "admin", url: "/admin/news" },
  { name: "admin-news-new", user: "admin", url: "/admin/news/new" },
  { name: "admin-news-edit", user: "admin", url: `/admin/news/${ids.news}` },
  { name: "admin-reports", user: "admin", url: "/admin/reports" },
  { name: "admin-audit", user: "admin", url: "/admin/audit" },
  { name: "admin-spaces", user: "admin", url: "/admin/spaces" },
  {
    name: "admin-space-edit",
    user: "admin",
    url: `/admin/spaces/${ids.space}/edit`,
  },
  { name: "admin-resources", user: "admin", url: "/admin/resources" },
  {
    name: "admin-resource-dialog",
    user: "admin",
    url: "/admin/resources",
    action: async (p) => {
      await p.getByRole("button", { name: /Nuevo recurso/ }).click();
    },
  },
  {
    name: "admin-reservation-types",
    user: "admin",
    url: "/admin/reservation-types",
  },
  {
    name: "admin-reservation-type-dialog",
    user: "admin",
    url: "/admin/reservation-types",
    action: async (p) => {
      await p.getByRole("button", { name: /Nuevo tipo/ }).click();
    },
  },
  { name: "admin-site", user: "admin", url: "/admin/site" },
  { name: "admin-themes", user: "admin", url: "/admin/themes" },
  // Milestone 14: el tema se edita en su propia página (antes, un diálogo).
  { name: "admin-theme-new", user: "admin", url: "/admin/themes/new" },
  {
    name: "admin-theme-edit",
    user: "admin",
    url: `/admin/themes/${ids.theme}/edit`,
  },
  { name: "admin-roles", user: "admin", url: "/admin/roles" },
  // Milestone 14: el rol se edita en su propia página (antes, un diálogo).
  { name: "admin-role-new", user: "admin", url: "/admin/roles/new" },
  {
    name: "admin-role-edit",
    user: "admin",
    url: `/admin/roles/${ids.role}/edit`,
  },
];

const ACCOUNTS = { user: "u1@lanube.local", admin: "sa1@lanube.local" };

async function login(browser, who) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/auth/signin`);
  await p.locator('input[name="email"]').first().fill(ACCOUNTS[who]);
  await p.locator('input[name="password"]').first().fill("123123123");
  await p.locator('input[name="password"]').first().press("Enter");
  await p.waitForURL(/\/user\//, { timeout: 30000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

/** Elements whose right edge pokes past the viewport — the "page scrolls sideways" bug. */
async function overflowReport(p) {
  return p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    if (sw <= vw) return null;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      // Skip children of an element that itself scrolls/clips horizontally.
      let a = el.parentElement,
        clipped = false;
      while (a && a !== document.body) {
        const ox = getComputedStyle(a).overflowX;
        if (ox !== "visible") {
          clipped = true;
          break;
        }
        a = a.parentElement;
      }
      if (clipped) continue;
      const cls = (el.getAttribute("class") ?? "").slice(0, 80);
      offenders.push(
        `${el.tagName.toLowerCase()}.${cls} → right=${Math.round(r.right)}`,
      );
      if (offenders.length >= 4) break;
    }
    return { viewport: vw, scrollWidth: sw, offenders };
  });
}

const browser = await chromium.launch();
const states = {
  user: await login(browser, "user"),
  admin: await login(browser, "admin"),
};
const report = [];

/** Wait for data to land: network quiet + no skeleton/spinner left on screen. */
async function settle(p) {
  await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await p
    .waitForFunction(
      () =>
        !document.querySelector(
          '[data-slot="skeleton"], .animate-pulse, .animate-spin',
        ),
      null,
      { timeout: 12000 },
    )
    .catch(() => {});
  await p.waitForTimeout(500);
}

async function gotoRetry(p, url, timeout = 60000) {
  for (let i = 0; ; i++) {
    try {
      return await p.goto(url, { waitUntil: "load", timeout });
    } catch (e) {
      if (i >= 2) throw e;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Warm-up: compile every route once (dev server compiles on first hit) so the capture
// pass isn't racing the compiler.
if (!process.env.NO_WARMUP) {
  for (const who of [null, "user", "admin"]) {
    const ctx = await browser.newContext({
      storageState: who ? states[who] : undefined,
    });
    const p = await ctx.newPage();
    const seen = new Set();
    for (const s of SHOTS.filter((s) => s.user === who)) {
      if (FILTER && !s.name.includes(FILTER)) continue;
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      const t = Date.now();
      try {
        await gotoRetry(p, BASE + s.url, 180000);
        console.log(`warm ${s.url} ${Date.now() - t}ms`);
      } catch (e) {
        console.log(`warm FAIL ${s.url}: ${String(e).split("\n")[0]}`);
      }
    }
    await ctx.close();
  }
}

for (const [vpName, scheme] of COMBOS) {
  const dir = path.join(OUT, `${vpName}-${scheme}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const who of [null, "user", "admin"]) {
    const ctx = await browser.newContext({
      ...VIEWPORTS[vpName],
      colorScheme: scheme,
      storageState: who ? states[who] : undefined,
      locale: "es-AR",
      timezoneId: "America/Argentina/Buenos_Aires",
    });
    const p = await ctx.newPage();
    for (const s of SHOTS.filter((s) => s.user === who)) {
      if (FILTER && !s.name.includes(FILTER)) continue;
      if (s.onlyNarrow && vpName === "desktop") continue;
      const file = path.join(dir, `${s.name}.png`);
      const skipShot = process.env.RESUME && fs.existsSync(file);
      try {
        await gotoRetry(p, BASE + s.url);
        await settle(p);
        if (s.action) {
          await s.action(p);
          await p.waitForTimeout(800);
        }
        const ov = await overflowReport(p);
        report.push({ shot: s.name, vp: vpName, scheme, overflow: ov });
        fs.appendFileSync(
          path.join(OUT, "report.jsonl"),
          JSON.stringify(report.at(-1)) + "\n",
        );
        if (!skipShot) await p.screenshot({ path: file, fullPage: !s.action });
      } catch (e) {
        report.push({
          shot: s.name,
          vp: vpName,
          scheme,
          error: String(e).split("\n")[0],
        });
        fs.appendFileSync(
          path.join(OUT, "report.jsonl"),
          JSON.stringify(report.at(-1)) + "\n",
        );
      }
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(
  path.join(OUT, "report.json"),
  JSON.stringify(report, null, 2),
);
for (const r of report) {
  if (r.error) console.log(`ERR  ${r.vp}-${r.scheme} ${r.shot}: ${r.error}`);
  else if (r.overflow)
    console.log(
      `OVF  ${r.vp}-${r.scheme} ${r.shot}: ${r.overflow.scrollWidth}>${r.overflow.viewport} ${r.overflow.offenders.join(" | ")}`,
    );
}
console.log(`done: ${report.length} shots`);
