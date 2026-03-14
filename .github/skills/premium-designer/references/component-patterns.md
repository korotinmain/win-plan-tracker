# Component Patterns Reference

Ready-made SCSS recipes for Angular + Angular Material components.
All patterns use project CSS tokens and the Inter design language.

---

## Stat / KPI Card

```scss
.kpi-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 16px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.07),
    0 1px 3px rgba(0, 0, 0, 0.05);
  transition:
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .kpi-label {
    font:
      500 0.75rem/1 "Inter",
      sans-serif;
    color: var(--c-text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .kpi-value {
    font:
      700 2rem/1 "Inter",
      sans-serif;
    color: var(--c-text);
  }

  .kpi-delta {
    font:
      500 0.8125rem "Inter",
      sans-serif;
    &.positive {
      color: #22c55e;
    }
    &.negative {
      color: #ef4444;
    }
  }
}
```

---

## Data Table

```scss
.premium-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-family: "Inter", sans-serif;

  th {
    font:
      500 0.75rem/1 "Inter",
      sans-serif;
    color: var(--c-text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 10px 16px;
    border-bottom: 1px solid var(--c-border);
    background: var(--c-surface-2);
    text-align: left;
  }

  td {
    padding: 14px 16px;
    font:
      400 0.875rem/1.4 "Inter",
      sans-serif;
    color: var(--c-text-2);
    border-bottom: 1px solid var(--c-border-faint);
    transition: background 0.12s;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: var(--c-surface-2);
  }
}
```

---

## Dialog / Modal

Angular CDK overlay — styles must be **global** (in `styles.scss` or a `.theme.scss` file):

```scss
.mat-mdc-dialog-container .mdc-dialog__surface {
  background: var(--c-surface) !important;
  border: 1px solid var(--c-border);
  border-radius: 20px !important;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.14),
    0 2px 8px rgba(0, 0, 0, 0.08) !important;
  overflow: hidden;
}

// Dialog header
.dialog-header {
  padding: 24px 24px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .dialog-title {
    font:
      700 1.125rem/1.3 "Inter",
      sans-serif;
    color: var(--c-text);
  }

  .dialog-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--c-surface-2);
    border: 1px solid var(--c-border);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: background 0.15s;
    &:hover {
      background: var(--c-border);
    }
  }
}

// Dialog body
.dialog-body {
  padding: 20px 24px;
}

// Dialog footer
.dialog-footer {
  padding: 16px 24px 24px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  border-top: 1px solid var(--c-border-faint);
}
```

---

## Pill / Badge / Status Chip

```scss
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 9999px;
  font:
    500 0.75rem/1 "Inter",
    sans-serif;
  background: var(--c-pill-bg);
  color: var(--c-pill-text);
  white-space: nowrap;

  // Status variants
  &.success {
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
  }
  &.warning {
    background: rgba(234, 179, 8, 0.12);
    color: #b45309;
  }
  &.danger {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
  }
  &.info {
    background: rgba(99, 102, 241, 0.12);
    color: var(--c-accent);
  }
}
```

---

## Accent / Primary Button

```scss
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  background: var(--c-accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  font:
    600 0.875rem "Inter",
    sans-serif;
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
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
}

.btn-ghost {
  @extend .btn-primary;
  background: transparent;
  color: var(--c-text-2);
  border: 1px solid var(--c-border);
  &:hover {
    background: var(--c-surface-2);
    color: var(--c-text);
    box-shadow: none;
    transform: none;
  }
}
```

---

## Avatar

```scss
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-accent), var(--c-accent-2));
  display: grid;
  place-items: center;
  font:
    600 0.8125rem "Inter",
    sans-serif;
  color: #fff;
  flex-shrink: 0;

  &.sm {
    width: 28px;
    height: 28px;
    font-size: 0.6875rem;
  }
  &.lg {
    width: 48px;
    height: 48px;
    font-size: 1rem;
  }
  &.xl {
    width: 64px;
    height: 64px;
    font-size: 1.25rem;
  }
}
```

---

## Form Field (Angular Material Outline)

Add to a global `.theme.scss` file:

```scss
.mat-mdc-form-field.mat-form-field-appearance-outline {
  --mdc-outlined-text-field-container-shape: 10px;

  // Light
  --mdc-outlined-text-field-outline-color: var(--c-border);
  --mdc-outlined-text-field-hover-outline-color: var(--c-accent);
  --mdc-outlined-text-field-focus-outline-color: var(--c-accent);
  --mdc-outlined-text-field-label-text-color: var(--c-text-3);
  --mdc-outlined-text-field-input-text-color: var(--c-text);
  --mdc-outlined-text-field-container-color: var(--c-surface);
}
```

---

## Navigation Item

```scss
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 10px;
  color: var(--c-nav-text);
  font:
    500 0.875rem "Inter",
    sans-serif;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  mat-icon {
    font-size: 18px;
    width: 18px;
    height: 18px;
    transition: color 0.15s;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--c-nav-active);
  }

  &.active {
    background: rgba(196, 181, 253, 0.1);
    color: var(--c-nav-active);
    mat-icon {
      color: var(--c-nav-active);
    }
  }
}
```

---

## Section Empty State

```scss
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  text-align: center;

  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--c-surface-2);
    border: 1px solid var(--c-border);
    display: grid;
    place-items: center;
    mat-icon {
      font-size: 26px;
      color: var(--c-text-3);
    }
  }

  .empty-title {
    font:
      600 1rem "Inter",
      sans-serif;
    color: var(--c-text);
  }
  .empty-message {
    font:
      400 0.875rem "Inter",
      sans-serif;
    color: var(--c-text-3);
    max-width: 280px;
  }
}
```

---

## Glassmorphism Card (premium overlay variant)

```scss
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

[data-theme="light"] .glass-card {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
}
```

---

## Page Layout Shell

```scss
.page-shell {
  display: grid;
  gap: 24px;
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;

    .page-title {
      font:
        700 1.5rem/1.25 "Inter",
        sans-serif;
      color: var(--c-text);
    }
    .page-subtitle {
      font:
        400 0.875rem "Inter",
        sans-serif;
      color: var(--c-text-3);
      margin-top: 4px;
    }
  }

  .content-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
}
```
