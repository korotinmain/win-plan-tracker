---
name: premium-designer
description: "Premium UI design skill for Angular + Angular Material + SCSS apps. Use when: creating new components, redesigning existing UI, adding dark/light theme support, building design tokens, styling dialogs or cards, creating micro-animations, adding glassmorphism or elevated surfaces, implementing responsive layouts, or matching a luxury SaaS aesthetic. Triggers: design, style, UI, beautiful, premium, component, theme, SCSS, dark mode, layout, responsive, animation, visual."
argument-hint: "Describe the component or screen to design (e.g. 'dashboard card with stats', 'login page redesign')"
---

# Premium Designer

Instantly create **beautiful, premium-quality UI** for Angular + Angular Material + SCSS applications. Follows the project's established design language: Inter font, indigo/violet accent palette, CSS custom properties, dual light/dark themes.

## When to Use

- New Angular component needs styling from scratch
- Existing component looks dated or plain
- Adding dark/light theme tokens for a new surface
- Creating dialogs, cards, tables, forms, or navigation elements
- Implementing micro-animations or hover effects
- Building a new screen layout (dashboard, settings, auth page)

## Design Philosophy

| Principle     | Rule                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| **Space**     | 4px base grid. Sections: 24–48px. Elements: 8–16px.                                                  |
| **Type**      | Inter. Headings: 600–700 weight. Body: 400–500. Labels: 500, 0.75–0.8rem.                            |
| **Color**     | Accent `#6366f1` (indigo) + `#8b5cf6` (violet). Use CSS vars — never hardcode raw hex in components. |
| **Elevation** | Cards get `box-shadow`. Dialogs/menus get deeper shadow + slight backdrop blur.                      |
| **Motion**    | `transition: 0.18s ease` for hover/state changes. Entrances: `0.22s cubic-bezier(.4,0,.2,1)`.        |
| **Surfaces**  | Light: white / `#f8fafc`. Dark: `#111827` / `#1a2235`. Borders via `var(--c-border)`.                |

## Step-by-Step Procedure

### 1. Identify the Design Target

- What is this UI element (card, dialog, table row, form, nav)?
- Does it need dark + light mode support?
- Does it appear inside an Angular Material CDK overlay (dialog/menu)? → Styles must be **global** not component-scoped.

### 2. Map CSS Custom Properties

Use the project token set — see [design-tokens reference](./references/design-tokens.md).

- Surface → `var(--c-surface)` / `var(--c-surface-2)`
- Text → `var(--c-text)` / `var(--c-text-2)` / `var(--c-text-3)`
- Border → `var(--c-border)` / `var(--c-border-faint)`
- Accent → `var(--c-accent)` / `var(--c-accent-2)`
- Never hardcode color values in component SCSS.

### 3. Apply the Premium Surface Recipe

```scss
.my-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 16px;
  padding: 24px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.06),
    0 4px 16px rgba(0, 0, 0, 0.06);
  transition:
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover {
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.1),
      0 1px 4px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }
}
```

### 4. Typography Rules

```scss
.heading {
  font:
    700 1.25rem/1.3 "Inter",
    sans-serif;
  color: var(--c-text);
}
.subheading {
  font:
    600 0.9375rem/1.4 "Inter",
    sans-serif;
  color: var(--c-text);
}
.body {
  font:
    400 0.875rem/1.6 "Inter",
    sans-serif;
  color: var(--c-text-2);
}
.label {
  font:
    500 0.75rem/1 "Inter",
    sans-serif;
  color: var(--c-text-3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.meta {
  font:
    400 0.75rem/1.4 "Inter",
    sans-serif;
  color: var(--c-text-3);
}
```

### 5. Interactive States

```scss
// Accent buttons / interactive chips
.accent-btn {
  background: var(--c-accent);
  color: #fff;
  border-radius: 10px;
  padding: 8px 18px;
  font:
    600 0.875rem "Inter",
    sans-serif;
  border: none;
  cursor: pointer;
  transition:
    background 0.18s,
    box-shadow 0.18s,
    transform 0.15s;

  &:hover {
    background: var(--c-accent-2);
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
}
```

### 6. Angular Material Overrides

- Use `--mdc-*` and `--mat-*` CSS custom properties for Material component overrides.
- Overlay-based components (dialogs, select panels, menus) → override in **global** SCSS (`styles.scss` or a dedicated `*.theme.scss` file under `src/styles/`).
- See [component-patterns reference](./references/component-patterns.md) for ready-made recipes.

### 7. Dark/Light Duality

- Always add `[data-theme="dark"]` overrides when colors differ.
- Light-mode shadows use `rgba(0,0,0,...)`. Dark-mode: lighter opacity + glow with accent color.

```scss
:root,
[data-theme="light"] {
  .my-card {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
  }
}
[data-theme="dark"] {
  .my-card {
    box-shadow:
      0 2px 12px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.04);
  }
}
```

### 8. Animations & Micro-interactions

```scss
// Fade + slide-up entrance (apply with @keyframes in component or global)
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.enter {
  animation: fadeInUp 0.22s cubic-bezier(0.4, 0, 0.2, 1) both;
}

// Subtle scale pulse for KPI numbers / metrics
@keyframes countUp {
  0% {
    transform: scale(0.96);
    opacity: 0.6;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

### 9. Responsive Layout

- Mobile-first. Base styles for ≤600px, enhance upward.
- Column → row grid: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`.
- Use `gap` not margin for grid/flex spacing.
- Navigation collapses ≤768px.

### 10. Quality Checklist

Before finalizing any UI work:

- [ ] Both light and dark themes tested
- [ ] All colors use CSS vars (no hardcoded hex)
- [ ] Hover + focus + active states on all interactive elements
- [ ] Font family is Inter (check via DevTools)
- [ ] Consistent border-radius (8px small / 12px medium / 16px large / 20px card)
- [ ] Smooth transitions on state changes
- [ ] Mobile layout verified at 375px viewport
- [ ] Angular Material overrides in correct scope (global vs component)

## References

- [Design Tokens](./references/design-tokens.md) — Full token list for light + dark themes
- [Component Patterns](./references/component-patterns.md) — Ready-made SCSS recipes for common Angular components
- [SCSS Design System Template](./assets/design-system.scss) — Boilerplate for a new feature's styles
