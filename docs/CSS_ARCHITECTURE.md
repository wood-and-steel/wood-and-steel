# CSS Architecture Guide

Plain CSS, no framework and no preprocessor. Global stylesheets, BEM-style class names, design tokens in custom properties, and no inline styles.

## Files

The player app's CSS is all imported, in order, through `src/shared/styles/index.css` (loaded once by `src/index.tsx`):

| File | Holds |
|------|-------|
| `variables.css` | Design tokens (`:root` custom properties) and the dark theme |
| `base.css` | Element defaults: `body`, headings, `code`, the keyboard focus ring |
| `layout.css` | The board page frame and the money strip's height |
| `buttons.css` | `.button` and its modifiers |
| `player-board.css` | Toolbar, money strip, avatars, the home screen's engines and contract rows |
| `modal.css` | `.modal` scrim and dialog, the sheet layout on phones, the playtest dialog |
| `sheets.css` | Sheet contents: Loans, Actions, upgrades, track, receipts, round report, cargo |
| `tables.css` | `.table` (the lobby's game list) |
| `popup-menu.css` | `.popupMenu` |
| `nav-bar.css` | Floating menu button (phones, tablets) and the desktop nav row |
| `lobby-screen.css`, `waiting-screen.css` | The two pre-game screens |
| `utilities.css` | The few single-purpose classes (`.text-center`, `.padding-xl`) |

Later files win ties, so `utilities.css` comes last. Put a new component's rules in the file that holds its neighbors, or a new file imported from `index.css`.

### Outside `index.css`

- `board.css` is imported only by `src/board/BoardApp.tsx`, so it ships in the lazy board chunk and stays out of production builds. See [BOARD_AGENT_GUIDE.md](BOARD_AGENT_GUIDE.md).
- `bots.css` is imported only by `src/bots/` components, never by `index.css` (a test checks this). See [BOT_PLAN.md](BOT_PLAN.md).
- Dev tools (`/sim`, `/pick-coords`, `/board/edit-paths`) import their own CSS next to their page.

## Rules

1. **No inline styles.** No `style={}` and no JavaScript style objects. When a value is only known at run time (a player's color, a measured position), set a custom property from a ref and let the CSS read it:

   ```tsx
   const ref = React.useRef<HTMLSpanElement>(null);
   React.useLayoutEffect(() => {
     ref.current?.style.setProperty("--avatar-bg", avatarColor);
   }, [avatarColor]);
   return <span ref={ref} className="playerAvatar" />;
   ```

   ```css
   .playerAvatar { background-color: var(--avatar-bg); }
   ```

   `PlayerAvatar`, `EngineIcon`, `PopupMenu` and the board's popover and drag ghost all work this way. SVG geometry and fill colors may be attributes.
2. **Tokens, not literals.** Colors, spacing, font sizes, radii, borders, shadows and z-indexes come from `variables.css`. Add a token rather than repeat a literal; a color literal outside `variables.css` won't follow the theme.
3. **BEM-style names.** `.block`, `.block__element`, `.block--modifier`, with camelCase words (`.playerToolbar__roundDot`, `.contractRow--fulfilled`). Name by purpose, not looks. Keep selectors to one class where you can; style states with pseudo-classes (`:hover`, `:disabled`, `:focus-visible`) on that class.
4. **rem, not px.** Sizes are in rem so the app follows the browser's text size (16px = 1rem). Breakpoints are in px. Round rem values as below.
5. **Mobile first.** Write the phone layout first, then override with `min-width` media queries only. Add a breakpoint only where the layout actually changes.

## Theme

Light is the default. Dark follows the system setting through `@media (prefers-color-scheme: dark)` in `variables.css`, which overrides the color tokens; nothing in JavaScript sets the theme.

- Only the player app has a dark theme. `App.tsx` wraps it in `.playerApp`, and the dark block applies to `:root:has(.playerApp)`, so the playtest board and dev tools stay light.
- `color-scheme` is set with each theme so native controls (selects, checkboxes, scrollbars) match.
- Write colors as tokens and the dark theme comes for free. If a component truly needs its own dark colors, put them in a `prefers-color-scheme: dark` block next to the light ones.

## Focus

`base.css` gives every focusable element one keyboard focus ring (`:focus-visible`, `--color-highlight`). Mouse and touch focus show none. Don't write `outline: none` unless something else shows focus instead, as `.track__field:focus-within` does for its borderless input.

## Responsive layout

Three layouts:

| Layout | Width | Query |
|--------|-------|-------|
| Mobile | < 768px | none (default) |
| Tablet | 768px to 1023px | `@media (min-width: 768px)` |
| Desktop | >= 1024px | `@media (min-width: 1024px)` |

Custom properties can't be used in media queries, so write the numbers. Mark each block with a comment (`/* Tablet Layout (768px - 1023px) */`).

```css
/* Mobile Layout (default, < 768px) */
.myComponent {
  padding: var(--spacing-sm);
}

/* Tablet Layout (768px - 1023px) */
@media (min-width: 768px) {
  .myComponent {
    padding: var(--spacing-md);
  }
}
```

Phone-specific pieces of the layout:

- `--safe-area-inset-top` and `--safe-area-inset-bottom` (from `env()`) keep content clear of notches and the home indicator.
- `--money-strip-height` is the room the fixed money strip takes at the top; it's `0px` unless the strip is on screen (`:root:has(.moneyStrip)` in `layout.css`). Fixed and sticky things that sit below it use it.
- Use `dvh` for heights that must fit the visible screen, with a `vh` fallback before it.
- Respect `prefers-reduced-motion` for anything that slides or moves.

## Patterns

```jsx
// Buttons
<button className="button">Pay</button>
<button className="button sheet__primary">Pay $3K</button>

// A dialog or sheet
<div className="modal modal--sheet">
  <div className="modal__content">…</div>
</div>

// Conditional modifiers
<button className={`contractRow${fulfilled ? " contractRow--fulfilled" : ""}`}>

// Hide a table column on phones
<th className="table__headerCell table__headerCell--hide-mobile">Last Turn</th>
```

Hide things with a modifier on their own block, or don't render them; there is no global `.hidden` class.

## Rem value rounding

Round rem values so there are fewer distinct sizes:

1. **Under 1rem:** nearest 0.0625 (`0.7rem` → `0.75rem`, `0.9rem` → `0.875rem`)
2. **1rem to 4rem:** nearest 0.25 (`1.1rem` → `1rem`, `1.625rem` → `1.75rem`)
3. **4rem to 10rem:** nearest 0.5 (`7.1875rem` → `7.5rem`)
4. **Over 10rem:** nearest whole number (`12.5rem` → `13rem`, `31.25rem` → `31rem`)

```css
/* Correct */
.icon {
  width: 1.5rem;
  border-width: 0.0625rem; /* a 1px hairline: --border-width-md */
}

/* Incorrect */
.icon {
  width: 1.47rem;          /* 1.5rem */
  min-width: 12.5rem;      /* 13rem */
}
```

Some older rules still use px or raw sizes (`--nav-height-desktop`, a few 1px and 2px values, the lobby spinner). Don't copy them; convert them when you're in the area.
