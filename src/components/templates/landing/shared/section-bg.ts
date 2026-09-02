/**
 * Alternating background applied to each landing section's own <Breakout>.
 *
 * Each section owns its Breakout and returns `null` (rendering no DOM node at all) when it
 * has nothing to show — so the CSS `nth-child` alternation counts only the sections that are
 * actually on the page. A hidden section (e.g. no upcoming events) therefore never leaves two
 * same-colored bands adjacent. Do NOT wrap sections in an extra always-rendered Breakout: that
 * reintroduces a phantom parity slot and breaks the alternation.
 */
export const LANDING_SECTION_BG =
  "odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15";
