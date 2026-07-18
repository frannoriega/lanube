import { z } from "zod";

/** Deployment-tunable settings for the events module (the `modules.events.config` block). */
export const eventsConfigSchema = z.object({
  /** Show upcoming events on the public landing page. */
  showOnLanding: z.boolean().default(true),
  /** How many events the landing section lists. */
  landingLimit: z.number().int().positive().max(24).default(8),
});

export type EventsConfig = z.infer<typeof eventsConfigSchema>;

export const eventsDefaultConfig: EventsConfig = {
  showOnLanding: true,
  landingLimit: 8,
};
