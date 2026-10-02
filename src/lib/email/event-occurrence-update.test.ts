import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture every sendMail call so we can assert the batch fans out to ONE email per participant.
// vi.hoisted so the fns exist when the (hoisted) vi.mock factories run.
const { sendMail, listEventParticipants, notify } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  listEventParticipants: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}));
vi.mock("@/lib/db/participants", () => ({ listEventParticipants }));
// The in-app bell goes through notify() (src/lib/notifications/dispatch.ts), which pulls in
// "server-only" transitively — stub it out here the same way the email/DB deps are stubbed,
// so this stays a focused test of the email batching behaviour.
vi.mock("@/lib/notifications/dispatch", () => ({ notify }));

import { notifyEventParticipantsBatch } from "@/lib/email/event-occurrence-update";

const START = Date.UTC(2026, 6, 9, 13, 0); // 2026-07-09 10:00 ART
const HOUR = 3_600_000;

beforeEach(() => {
  sendMail.mockReset();
  sendMail.mockResolvedValue({ rejected: [] });
  listEventParticipants.mockReset();
  notify.mockReset();
  notify.mockResolvedValue(undefined);
});

describe("notifyEventParticipantsBatch", () => {
  it("sends a single email per participant covering all changes + the shared reason", async () => {
    listEventParticipants.mockResolvedValue([
      {
        email: "a@x.com",
        displayEmail: "a@x.com",
        editToken: "t1",
        status: "APPROVED",
      },
      {
        email: "b@x.com",
        displayEmail: "b@x.com",
        editToken: "t2",
        status: "PENDING",
      },
      {
        email: "c@x.com",
        displayEmail: "c@x.com",
        editToken: "t3",
        status: "CANCELLED",
      },
    ]);

    const res = await notifyEventParticipantsBatch("ev1", {
      eventName: "Taller",
      reason: "Vacaciones del docente",
      changes: [
        {
          kind: "cancelled",
          originalStartMs: START,
          originalEndMs: START + 3 * HOUR,
        },
        {
          kind: "rescheduled",
          originalStartMs: START + 7 * 24 * HOUR,
          originalEndMs: START + 7 * 24 * HOUR + 3 * HOUR,
          newStartMs: START + 8 * 24 * HOUR,
          newEndMs: START + 8 * 24 * HOUR + 3 * HOUR,
        },
      ],
    });

    // 2 non-cancelled participants → exactly 2 emails (one each), NOT one-per-change.
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(res.sent).toBe(2);

    const html = sendMail.mock.calls[0][0].html as string;
    expect(html).toContain("Cancelada");
    expect(html).toContain("Reprogramada");
    expect(html).toContain("Vacaciones del docente");
    // Both sessions listed in one email.
    expect((html.match(/<li/g) ?? []).length).toBe(2);
  });

  it("no-ops when there are no changes", async () => {
    const res = await notifyEventParticipantsBatch("ev1", {
      eventName: "Taller",
      changes: [],
    });
    expect(sendMail).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(res).toEqual({ sent: 0, failed: 0 });
  });

  it("also rings the bell (one notify() call per change) for participants with an account", async () => {
    listEventParticipants.mockResolvedValue([
      // No account: email only, no in-app notify() call possible.
      {
        email: "a@x.com",
        displayEmail: "a@x.com",
        editToken: "t1",
        status: "APPROVED",
        userId: null,
      },
      // Has an account: gets both the email (asserted above) and an in-app notification.
      {
        email: "b@x.com",
        displayEmail: "b@x.com",
        editToken: "t2",
        status: "APPROVED",
        userId: "ru_b",
      },
    ]);

    await notifyEventParticipantsBatch("ev1", {
      eventName: "Taller",
      changes: [
        {
          kind: "cancelled",
          originalStartMs: START,
          originalEndMs: START + 3 * HOUR,
        },
        {
          kind: "restored",
          originalStartMs: START + 7 * 24 * HOUR,
          originalEndMs: START + 7 * 24 * HOUR + 3 * HOUR,
        },
      ],
    });

    // One notify() call per change, only for the participant with an account.
    expect(notify).toHaveBeenCalledTimes(2);
    for (const call of notify.mock.calls) {
      expect(call[0].type).toBe("event.sessionChanged");
      expect(call[0].recipient).toEqual({ registeredUserId: "ru_b" });
    }
  });
});
