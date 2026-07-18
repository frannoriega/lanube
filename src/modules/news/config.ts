import { z } from "zod";

/** Deployment-tunable settings for the news module. */
export const newsConfigSchema = z.object({
  /** Show the latest news on the public landing page. */
  showOnLanding: z.boolean().default(true),
  /** How many news items the landing section lists. */
  landingLimit: z.number().int().positive().max(24).default(6),
});

export type NewsConfig = z.infer<typeof newsConfigSchema>;

export const newsDefaultConfig: NewsConfig = {
  showOnLanding: true,
  landingLimit: 6,
};
