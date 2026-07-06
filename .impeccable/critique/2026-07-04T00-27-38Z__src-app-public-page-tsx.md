---
target: src/app/(public)/page.tsx
total_score: 26
p0_count: 0
p1_count: 3
timestamp: 2026-07-04T00-27-38Z
slug: src-app-public-page-tsx
---

## Design Health Score

| #         | Heuristic                                   | Score     | Key Issue                                                                                                                               |
| --------- | ------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status                 | 3         | Typewriter + blinking cursor work well. No active nav state for current page. Event CTAs correctly reflect open/upcoming/closed phases. |
| 2         | Match System / Real World                   | 4         | Fluent Spanish throughout. Service names intuitive. Minor copy typo in Laboratorio.                                                     |
| 3         | User Control and Freedom                    | 3         | Nav always accessible. Marquee pauses on hover but not on keyboard focus.                                                               |
| 4         | Consistency and Standards                   | 2         | bg-slate-400/60 and text-slate-500 break brand token discipline. Footer has 4 h1 elements. Observatory Blue absent from Services.       |
| 5         | Error Prevention                            | 3         | Event registration states handled gracefully.                                                                                           |
| 6         | Recognition Rather Than Recall              | 2         | Service cards have link field but are not clickable. Primary action not surfaced contextually.                                          |
| 7         | Flexibility and Efficiency of Use           | 2         | No keyboard shortcut to pause marquees. No power-user shortcut to booking from landing.                                                 |
| 8         | Aesthetic and Minimalist Design             | 2         | Hero clean. Below the fold quality degrades — Services off-brand, Members/Partners structurally identical.                              |
| 9         | Help Users Recognize, Diagnose, and Recover | 3         | Beta badge tooltip hover-only. Event states clear.                                                                                      |
| 10        | Help and Documentation                      | 2         | No skip-to-content link. No onboarding path from hero. Contact footer-only.                                                             |
| **Total** |                                             | **26/40** | **Acceptable — significant improvements needed**                                                                                        |

## Anti-Patterns Verdict

**LLM assessment:** Partially AI-generated. Hero and event cards are genuine. Services is textbook identical-card-grid scaffolding. Members/Partners are near-duplicate template sections. Gradient text is intentional per DESIGN.md.

**Deterministic scan:** 11 findings (0 errors, 3 warnings, 8 advisories). animate-bounce easing is a real finding. Both gradient-text warnings are false positives (intentional per DESIGN.md). All 8 design-system-color advisories are shadow rgba values documented in design.json (false positives).

## Priority Issues

**[P1] No primary CTA in the hero** — emotional payoff goes nowhere. Fix: add "Reservar un espacio" button + "Conocer más" secondary link. Command: /impeccable layout

**[P1] Service cards are non-interactive dead ends** — link field unused. Fix: wrap in Link, add visible CTA affordance, add hover shadow. Command: /impeccable harden

**[P1] Services section uses off-brand tokens; Observatory Blue absent** — bg-slate-400/60, text-slate-500. Fix: replace with brand tokens, add Observatory Blue touch. Command: /impeccable colorize

**[P2] Services identical card grid** — clearest AI slop tell. Fix: differentiate by scale/character, add capacity chips, use event card as model. Command: /impeccable bolder

**[P2] Footer multiple h1 elements** — accessibility violation. Fix: change to h2 or styled p. Command: /impeccable audit

## Persona Red Flags

**Jordan:** Non-interactive service cards cause confusion. No sign-up CTA visible. Beta badge inaccessible on touch.
**Casey:** No above-fold CTA. Continuous marquee auto-scrolls. Dead service cards cause abandonment.
**Regular Member:** No events empty state when section is absent. No repeat-user shortcut to booking.

## Minor Observations

Laboratorio typo and near-identical service descriptions. animate-bounce has no prefers-reduced-motion override. Hero h2 brittle line break. No text-wrap: balance on headings. Members/Partners structurally identical. No skip-to-content link. No ParticlesLayout CSS fallback. Beta tooltip hover-only.
