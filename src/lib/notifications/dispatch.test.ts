import { beforeEach, describe, expect, it, vi } from "vitest";

const { inAppSend, emailSend, loggerError } = vi.hoisted(() => ({
  inAppSend: vi.fn(),
  emailSend: vi.fn(),
  loggerError: vi.fn(),
}));
vi.mock("./providers/in-app", () => ({
  inAppProvider: { channel: "in-app", send: inAppSend },
}));
vi.mock("./providers/email", () => ({
  emailProvider: { channel: "email", send: emailSend },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: loggerError } }));
// dispatch.ts is `import "server-only"`-gated (correctly — it's never meant to reach a
// client bundle); vitest has no bundler boundary to enforce that against, so stub the
// package the same way Next.js's webpack config does for a server-only test context.
vi.mock("server-only", () => ({}));

import { notify } from "./dispatch";

const EVENT = {
  type: "reservation.approved" as const,
  recipient: { registeredUserId: "u1" },
  data: {
    reservationId: "r1",
    spaceName: "Sala A",
    reservationTypeName: "Reunión",
    startTime: 0,
    endTime: 1,
  },
};

beforeEach(() => {
  inAppSend.mockReset().mockResolvedValue(undefined);
  emailSend.mockReset().mockResolvedValue(undefined);
  loggerError.mockReset();
});

describe("notify", () => {
  it("fans the event out to every configured provider", async () => {
    await notify(EVENT);
    expect(inAppSend).toHaveBeenCalledWith(EVENT);
    expect(emailSend).toHaveBeenCalledWith(EVENT);
  });

  it("never throws, and logs only the provider that actually failed", async () => {
    emailSend.mockRejectedValue(new Error("smtp down"));
    await expect(notify(EVENT)).resolves.toBeUndefined();
    expect(inAppSend).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerError.mock.calls[0][2]).toMatchObject({ channel: "email" });
  });
});
