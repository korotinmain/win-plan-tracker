# Design Tokens Reference

Full CSS custom property token set used in this project.
Tokens are declared on `:root` / `[data-theme="light"]` and overridden on `[data-theme="dark"]`.

## Surfaces

| Token           | Light     | Dark      | Usage                             |
| --------------- | --------- | --------- | --------------------------------- |
| `--c-bg`        | `#f0f2f5` | `#0b0f19` | Page/app background               |
| `--c-surface`   | `#ffffff` | `#111827` | Cards, panels, dialogs            |
| `--c-surface-2` | `#f8fafc` | `#1a2235` | Secondary surfaces, nested panels |

## Borders

| Token              | Light     | Dark                    | Usage              |
| ------------------ | --------- | ----------------------- | ------------------ |
| `--c-border`       | `#e2e8f0` | `rgba(255,255,255,.08)` | Card/input borders |
| `--c-border-faint` | `#f1f5f9` | `rgba(255,255,255,.05)` | Subtle dividers    |

## Text

| Token        | Light     | Dark      | Usage                        |
| ------------ | --------- | --------- | ---------------------------- |
| `--c-text`   | `#0f172a` | `#f1f5f9` | Primary headings & body      |
| `--c-text-2` | `#475569` | `#94a3b8` | Secondary body, descriptions |
| `--c-text-3` | `#94a3b8` | `#64748b` | Captions, placeholders, meta |

## Accent / Brand

| Token          | Light + Dark | Usage                               |
| -------------- | ------------ | ----------------------------------- |
| `--c-accent`   | `#6366f1`    | Primary accent, CTAs, active states |
| `--c-accent-2` | `#8b5cf6`    | Hover on accent, gradients          |

## Navigation

| Token            | Light     | Dark      |
| ---------------- | --------- | --------- |
| `--c-nav-bg`     | `#0f172a` | `#0b0f19` |
| `--c-nav-text`   | `#64748b` | `#64748b` |
| `--c-nav-active` | `#c4b5fd` | `#c4b5fd` |

## Header

| Token               | Light     | Dark                    |
| ------------------- | --------- | ----------------------- |
| `--c-header-bg`     | `#ffffff` | `#111827`               |
| `--c-header-border` | `#e8ecf0` | `rgba(255,255,255,.07)` |

## Pill / Badge

| Token           | Light     | Dark                    |
| --------------- | --------- | ----------------------- |
| `--c-pill-bg`   | `#f1f5f9` | `rgba(255,255,255,.07)` |
| `--c-pill-text` | `#475569` | `#94a3b8`               |

## Menu / Overlay

| Token                   | Light     | Dark                    |
| ----------------------- | --------- | ----------------------- |
| `--c-menu-bg`           | `#ffffff` | `#1e293b`               |
| `--c-menu-border`       | `#e2e8f0` | `rgba(255,255,255,.08)` |
| `--c-menu-item-text`    | `#334155` | `#e2e8f0`               |
| `--c-menu-item-icon-bg` | `#f1f5f9` | `rgba(255,255,255,.07)` |
| `--c-menu-divider`      | `#e2e8f0` | `rgba(255,255,255,.07)` |

## Calendar Specific

| Token              | Light                 | Dark                  |
| ------------------ | --------------------- | --------------------- |
| `--c-today-col-bg` | `rgba(79,70,229,.04)` | `rgba(79,70,229,.10)` |

---

## Spacing Scale (4px grid)

| Name | Value | Use                       |
| ---- | ----- | ------------------------- |
| xs   | 4px   | Icon padding, tight gaps  |
| sm   | 8px   | Inner element gap         |
| md   | 12px  | Button padding horizontal |
| base | 16px  | Card inner gap            |
| lg   | 24px  | Card padding              |
| xl   | 32px  | Section gap               |
| 2xl  | 48px  | Page section spacing      |

## Border Radius Scale

| Scale | Value  | Use                       |
| ----- | ------ | ------------------------- |
| sm    | 6px    | Tags, badges, chips       |
| md    | 10px   | Buttons, inputs           |
| lg    | 12px   | Input fields, small cards |
| xl    | 16px   | Cards, panels             |
| 2xl   | 20px   | Large cards, dialogs      |
| full  | 9999px | Avatar, pills             |

## Elevation (Box Shadow)

| Level       | Value                                                   | Use                 |
| ----------- | ------------------------------------------------------- | ------------------- |
| 0           | none                                                    | Flat                |
| 1           | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`  | Subtle card         |
| 2           | `0 2px 8px rgba(0,0,0,.07), 0 1px 3px rgba(0,0,0,.05)`  | Card default        |
| 3           | `0 4px 20px rgba(0,0,0,.10), 0 2px 6px rgba(0,0,0,.06)` | Card hover          |
| 4           | `0 8px 32px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.08)` | Dialog / popover    |
| accent-glow | `0 4px 14px rgba(99,102,241,.35)`                       | Accent button hover |

## Typography Scale

| Name    | Size      | Weight | Line-height | Use                     |
| ------- | --------- | ------ | ----------- | ----------------------- |
| display | 2rem      | 700    | 1.2         | Hero / page title       |
| h1      | 1.5rem    | 700    | 1.25        | Section heading         |
| h2      | 1.25rem   | 600    | 1.3         | Card title              |
| h3      | 1.0625rem | 600    | 1.35        | Sub-section             |
| body    | 0.875rem  | 400    | 1.6         | Default body            |
| small   | 0.8125rem | 400    | 1.5         | Helper text             |
| label   | 0.75rem   | 500    | 1           | Field labels, uppercase |
| micro   | 0.6875rem | 400    | 1.4         | Timestamps, meta        |

Font family for all: `'Inter', Roboto, 'Helvetica Neue', sans-serif`
