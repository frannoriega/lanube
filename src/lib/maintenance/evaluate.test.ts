import { describe, expect, it } from "vitest";
import {
  blockedMessage,
  findBlockingWindow,
  findWriteBlockForArea,
  isAreaSuspended,
  isGlobalReadOnly,
  pathMatches,
  windowState,
  type StatefulWindow,
} from "./evaluate";
import { MAINTENANCE_AREAS } from "./areas";

const NOW = 1_000_000;

function win(partial: Partial<StatefulWindow>): StatefulWindow {
  return {
    id: "w1",
    title: "Migración",
    reasonMd: "Motivo",
    mode: "READ_ONLY",
    areas: ["all"],
    startsAt: null,
    endsAt: null,
    endedAt: null,
    state: "active",
    ...partial,
  };
}

describe("windowState", () => {
  it("sin extremos está vigente desde que se crea", () => {
    expect(
      windowState({ startsAt: null, endsAt: null, endedAt: null }, NOW),
    ).toBe("active");
  });
  it("antes del inicio es futura; el inicio es inclusivo", () => {
    expect(
      windowState({ startsAt: NOW + 1, endsAt: null, endedAt: null }, NOW),
    ).toBe("scheduled");
    expect(
      windowState({ startsAt: NOW, endsAt: null, endedAt: null }, NOW),
    ).toBe("active");
  });
  it("el fin es exclusivo", () => {
    expect(
      windowState({ startsAt: null, endsAt: NOW + 1, endedAt: null }, NOW),
    ).toBe("active");
    expect(
      windowState({ startsAt: null, endsAt: NOW, endedAt: null }, NOW),
    ).toBe("ended");
  });
  it("finalizada a mano termina aunque no haya llegado su fin", () => {
    expect(
      windowState({ startsAt: null, endsAt: NOW + 999, endedAt: NOW - 1 }, NOW),
    ).toBe("ended");
  });
});

describe("pathMatches", () => {
  it("coincide con el prefijo y con lo que cuelga, no con un vecino de nombre parecido", () => {
    expect(pathMatches("/api/forms", "/api/forms")).toBe(true);
    expect(pathMatches("/api/forms/x/upload", "/api/forms")).toBe(true);
    expect(pathMatches("/api/formsx", "/api/forms")).toBe(false);
  });
});

describe("findBlockingWindow — solo lectura global", () => {
  const ro = [win({})];
  it("frena los cambios y deja pasar las lecturas", () => {
    expect(findBlockingWindow(ro, "POST", "/api/admin/events")).not.toBeNull();
    expect(findBlockingWindow(ro, "PUT", "/api/user/profile")).not.toBeNull();
    expect(findBlockingWindow(ro, "DELETE", "/api/resources/x")).not.toBeNull();
    expect(findBlockingWindow(ro, "GET", "/api/admin/events")).toBeNull();
    expect(findBlockingWindow(ro, "HEAD", "/api/admin/events")).toBeNull();
  });
  it("una ruta nueva que escribe queda bloqueada sola (falla del lado seguro)", () => {
    expect(findBlockingWindow(ro, "POST", "/api/algo/nuevo")).not.toBeNull();
  });
  it("frena el registro (una cuenta creada en plena migración se perdería)", () => {
    expect(findBlockingWindow(ro, "POST", "/api/auth/register")).not.toBeNull();
    expect(findBlockingWindow(ro, "POST", "/api/auth/reset")).not.toBeNull();
  });
  it("deja pasar el ingreso, las políticas, el cron, el conector y el propio panel", () => {
    for (const p of [
      "/api/auth/callback/credentials",
      "/api/auth/signin/credentials",
      "/api/auth/signout",
      "/api/auth/passkey/options",
      "/api/policies/accept",
      "/api/oauth/token",
      "/api/cron/maintain-reservations",
      "/api/mcp",
      "/api/admin/maintenance",
      "/api/admin/maintenance/abc/end",
      "/api/user/notifications/read",
    ]) {
      expect(findBlockingWindow(ro, "POST", p), p).toBeNull();
    }
  });
  it("un NOTICE, una ventana futura o una terminada no frenan nada", () => {
    expect(
      findBlockingWindow(
        [win({ mode: "NOTICE" })],
        "POST",
        "/api/user/profile",
      ),
    ).toBeNull();
    expect(
      findBlockingWindow(
        [win({ state: "scheduled" })],
        "POST",
        "/api/user/profile",
      ),
    ).toBeNull();
    expect(
      findBlockingWindow(
        [win({ state: "ended" })],
        "POST",
        "/api/user/profile",
      ),
    ).toBeNull();
  });
});

describe("findBlockingWindow — áreas", () => {
  it("UNAVAILABLE frena cualquier método de las rutas del área, y solo esas", () => {
    const w = [
      win({ mode: "UNAVAILABLE", areas: ["signup", "password-recovery"] }),
    ];
    expect(findBlockingWindow(w, "POST", "/api/auth/register")).not.toBeNull();
    expect(findBlockingWindow(w, "POST", "/api/auth/reset")).not.toBeNull();
    expect(findBlockingWindow(w, "PATCH", "/api/auth/reset")).not.toBeNull();
    expect(findBlockingWindow(w, "GET", "/api/auth/reset")).not.toBeNull();
    expect(findBlockingWindow(w, "POST", "/api/auth/signup")).toBeNull();
    expect(findBlockingWindow(w, "POST", "/api/admin/events")).toBeNull();
  });
  it("READ_ONLY en un área frena solo lo que escribe", () => {
    const w = [win({ mode: "READ_ONLY", areas: ["reservations"] })];
    expect(findBlockingWindow(w, "POST", "/api/resources/s1")).not.toBeNull();
    expect(findBlockingWindow(w, "GET", "/api/resources/s1")).toBeNull();
    expect(findBlockingWindow(w, "POST", "/api/admin/events")).toBeNull();
  });
  it("un área que ya no existe o que no es de rutas se ignora", () => {
    expect(
      findBlockingWindow(
        [win({ mode: "UNAVAILABLE", areas: ["inexistente", "event-emails"] })],
        "POST",
        "/api/admin/events",
      ),
    ).toBeNull();
  });
});

describe("findBlockingWindow — cuál mensaje gana", () => {
  it("si frenan la solo lectura global y un área, se muestra la del área", () => {
    const global = win({ id: "g", title: "Migración" });
    const mail = win({
      id: "m",
      title: "Correo caído",
      mode: "UNAVAILABLE",
      areas: ["password-recovery"],
    });
    expect(
      findBlockingWindow([global, mail], "POST", "/api/auth/reset")?.id,
    ).toBe("m");
    expect(
      findBlockingWindow([global, mail], "POST", "/api/user/profile")?.id,
    ).toBe("g");
  });
});

describe("findWriteBlockForArea / isAreaSuspended / isGlobalReadOnly", () => {
  it("el registro y el reseteo quedan bloqueados por la solo lectura global", () => {
    const w = [win({})];
    expect(findWriteBlockForArea(w, "signup")).not.toBeNull();
    expect(findWriteBlockForArea(w, "password-recovery")).not.toBeNull();
  });
  it("los correos de eventos no los apaga la solo lectura global, sí su propia ventana", () => {
    expect(isAreaSuspended([win({})], "event-emails")).toBe(false);
    expect(
      isAreaSuspended(
        [win({ mode: "UNAVAILABLE", areas: ["event-emails"] })],
        "event-emails",
      ),
    ).toBe(true);
    expect(
      isAreaSuspended(
        [win({ mode: "NOTICE", areas: ["event-emails"] })],
        "event-emails",
      ),
    ).toBe(false);
  });
  it("un NOTICE no bloquea la escritura de un área", () => {
    expect(
      findWriteBlockForArea(
        [win({ mode: "NOTICE", areas: ["signup"] })],
        "signup",
      ),
    ).toBeNull();
  });
  it("isGlobalReadOnly solo mira ventanas vigentes con `all` y modo que bloquea", () => {
    expect(isGlobalReadOnly([win({})])).not.toBeNull();
    expect(isGlobalReadOnly([win({ mode: "NOTICE" })])).toBeNull();
    expect(isGlobalReadOnly([win({ areas: ["news"] })])).toBeNull();
    expect(isGlobalReadOnly([win({ state: "scheduled" })])).toBeNull();
  });
});

describe("catálogo de áreas", () => {
  it("toda área de rutas declara al menos un prefijo de /api", () => {
    for (const [id, area] of Object.entries(MAINTENANCE_AREAS)) {
      if (area.effect !== "paths") continue;
      expect(area.paths.length, id).toBeGreaterThan(0);
      for (const p of area.paths) expect(p.startsWith("/api/"), id).toBe(true);
    }
  });
});

describe("blockedMessage", () => {
  it("distingue solo lectura de no disponible y nombra el motivo", () => {
    expect(blockedMessage({ title: "Migración", mode: "READ_ONLY" })).toContain(
      "solo lectura",
    );
    expect(blockedMessage({ title: "SMTP", mode: "UNAVAILABLE" })).toContain(
      "no está disponible",
    );
  });
});
