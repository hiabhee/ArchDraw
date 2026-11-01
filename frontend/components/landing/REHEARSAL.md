# Rehearsal: LiveMapShot

Gold: none copied. Written from the skill's rules, with `examples/presence` (agent cursors with name flags) and `examples/dark-hero` (dark window, one lit color) as references. Layout is a corner bleed: window inset 24/20px, off the right and bottom edges. Replaced an earlier draft that used a hand-built window, raw hex colors and a cursor-less figure.

Beats (about 12 s, then loops):
1. Gecko walks web, gateway, auth, reading files. Otter and Fox work in place.
2. Fox asks for permission: its flag goes up, its row opens in "Needs you".
3. Cursor opens Payments, its history card pops (payoff, held about 3.4 s).
4. Cursor clicks the pane, the card closes, Fox gets its answer, the agents return to their start.

Captured: wide design (548 x 400) in Chrome at the card's real width (about 547 px), dark theme, several frames of the loop including the payoff.

Film: not run. `film.mjs` and its `--gate` were never run, so no gate lines were cleared or judged.

Review: no fresh-eye review (`references/review.md`) was done.

Assumptions:
- The card slot is about 547 px wide, so `compact` switches below 480. The wide design is drawn for that slot.
- Session colors come from `SESSION_COLORS` and the attention color from `--signal-attention`, so the demo has no raw hex colors (`designSystemGuard.test.ts` passes).

Unresolved:
- The history card sits over the lower-left of the map and, at rest, that area is empty dot grid (only the Overview/Detailed switch is there). Judge it against the gold for "void under a pane".
- The cursor rests on empty canvas, but the loop restart has not been filmed at 60 ms to check the seam.
- Fox's star under the dashed plot overlaps the plot's lower edge slightly.

Not checked:
- The `compact` layout (358 wide): never opened, so it may not fit.
- Reduced motion: the `poster` frame was set but not viewed.
- 390 px viewport, light page theme, and the contact sheet.
- Framing rules (gutters, bleed 10 to 40%) were judged by eye, not by the script.
- Cursor kinds (`data-cursor="pointer"` on nodes) and the click ripple.
