import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/transport", () => ({
  transporter: { sendMail: vi.fn() },
  FROM_EMAIL: "x",
}));
vi.mock("@/lib/email/edit-link", () => ({
  emailBaseUrl: () => "https://lanube.example",
}));

import { invitationHtml } from "./event-invitation";

describe("invitationHtml (milestone 43)", () => {
  it("lleva el botón al formulario, escapa el texto y no lleva enlace de edición", () => {
    const html = invitationHtml({
      name: "Hackatón <b>2027</b>",
      summary: "Equipos & ideas",
      imageUrl: "/uploads/events/a.jpg",
      formSlug: "abc123",
    });
    expect(html).toContain('href="https://lanube.example/forms/abc123"');
    expect(html).toContain("Hackatón &lt;b&gt;2027&lt;/b&gt;");
    expect(html).toContain("Equipos &amp; ideas");
    expect(html).toContain("https://lanube.example/uploads/events/a.jpg");
    expect(html).not.toContain("/forms/response/");
  });
});
