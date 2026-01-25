# CSS Architecture Guide

## Overview

This project now uses a modern, maintainable CSS architecture with no inline styles. All styling is centralized in `/src/shared/styles/index.css`.

## Key Improvements

### ✅ What We Fixed

1. **Removed ALL inline styles** - Previously 40+ inline style attributes scattered across components
2. **Centralized styling** - Single CSS file with clear organization
3. **CSS Variables** - Consistent colors, spacing, and values throughout
4. **Semantic class names** - Classes describe purpose, not appearance
5. **BEM-inspired naming** - Component-scoped classes with clear hierarchy
6. **Utility classes** - Reusable classes for common patterns

### ❌ What We Removed

- Deleted `/src/shared/styles/styles.js` (JavaScript style objects)
- Removed all inline `style={}` attributes from JSX
- Eliminated magic numbers and hardcoded values

## CSS Structure

### 1. CSS Variables (`:root`)

All design tokens are defined as CSS variables for consistency:

```css
:root {
  /* Colors */
  --color-primary: #404040;
  --color-text-light: #ffffff;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-md: 1rem;
  
  /* Breakpoints */
  --breakpoint-mobile: 480px;
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
  --breakpoint-desktop-lg: 1280px;
  
  /* Z-Index */
  --z-modal: 1000;
}
```

**Benefits:**
- Easy theme changes (just update variables)
- Consistent spacing/colors across the app
- Self-documenting code
- Centralized breakpoint management

### 2. Component Classes (BEM-inspired)

Components use a block-element naming pattern:

```css
/* Block */
.buttonBar { }

/* Elements */
.buttonBar__gameCode { }
.buttonBar__label { }
.buttonBar__input { }

/* Modifiers */
.button--hidden { }
```

**Example Usage:**
```jsx
<div className="buttonBar">
  <span className="buttonBar__gameCode">Game: ABCD</span>
  <input className="buttonBar__input" />
</div>
```

### 3. Utility Classes

Common patterns available as single-purpose utilities:

```css
.flex { display: flex; }
.flex-column { flex-direction: column; }
.gap-sm { gap: var(--spacing-sm); }
.hidden { display: none; }
.text-center { text-align: center; }
```

**Example Usage:**
```jsx
<div className="flex flex-column gap-md">
  {/* Content */}
</div>
```

### 4. Responsive Breakpoint System

The app uses a **3-layout approach** (mobile, tablet, desktop) for pixel-perfect designs at each breakpoint:

**Breakpoints:**
- **Mobile**: `< 768px` (default, mobile-first)
- **Tablet**: `768px - 1023px`
- **Desktop**: `>= 1024px`

**Implementation Pattern:**
```css
/* Mobile Layout (default, < 768px) */
.myComponent {
  padding: var(--spacing-sm);
  font-size: 0.9rem;
}

/* Tablet Layout (768px - 1023px) */
@media (min-width: 768px) {
  .myComponent {
    padding: var(--spacing-md);
    font-size: 1rem;
  }
}

/* Desktop Layout (>= 1024px) */
@media (min-width: 1024px) {
  .myComponent {
    padding: var(--spacing-lg);
    font-size: 1.1rem;
  }
}
```

**Responsive Utilities:**
- `.show-mobile`, `.show-tablet`, `.show-desktop` - Show only on specific breakpoint
- `.hide-mobile`, `.hide-tablet`, `.hide-desktop` - Hide on specific breakpoint
- `.table__cell--hide-mobile` - Hide table columns on mobile

**Example Usage:**
```jsx
{/* Show different content per breakpoint */}
<div className="show-mobile">Mobile only</div>
<div className="show-tablet">Tablet only</div>
<div className="show-desktop">Desktop only</div>

{/* Hide less important columns on mobile */}
<th className="table__headerCell table__headerCell--hide-mobile">Last Turn</th>
```

## Component Patterns

### Modal/Dialog Pattern

```jsx
<div className="modal">
  <div className="modal__content">
    <h2 className="modal__title">Title</h2>
    <div className="modal__actions">
      <button className="button">Action</button>
    </div>
  </div>
</div>
```

### Table Pattern

```jsx
<table className="table">
  <thead>
    <tr className="table__header">
      <th className="table__headerCell">Header</th>
    </tr>
  </thead>
  <tbody>
    <tr className="table__row table__row--current">
      <td className="table__cell">Data</td>
    </tr>
  </tbody>
</table>
```

### Conditional Classes

Use template literals for conditional classes:

```jsx
// ✅ Good
<div className={`button ${isActive ? 'button--active' : ''}`}>

// ✅ Better (using array)
<div className={[
  'button',
  isActive && 'button--active',
  isDisabled && 'button--disabled'
].filter(Boolean).join(' ')}>
```

## Best Practices

### DO ✅

1. **Use CSS Variables** for any repeated value
2. **Use semantic names** - `.modal__title` not `.bold-text`
3. **Scope styles to components** - `.playerBoard__name` not `.name`
4. **Use utility classes** for simple, one-off layouts
5. **Add comments** to organize sections in CSS
6. **Start with mobile layout** - Use mobile-first approach, then add tablet/desktop overrides
7. **Define all 3 breakpoints** - Even if similar, explicitly define mobile/tablet/desktop for pixel-perfect control
8. **Use breakpoint variables** - Reference `var(--breakpoint-tablet)` in comments for clarity

### DON'T ❌

1. **No inline styles** - Always use CSS classes
2. **No JavaScript style objects** - Keep styles in CSS
3. **No magic numbers** - Use variables (`var(--spacing-md)`)
4. **No generic class names** - `.info` is too vague
5. **No duplicate styles** - DRY principle
6. **No fluid responsive** - Use discrete breakpoints, not continuous scaling
7. **Don't skip breakpoints** - Define all three layouts even if they're similar

## Adding New Styles

### For a New Component

1. **Add a CSS section with responsive breakpoints:**
```css
/* ========================================
   MY NEW COMPONENT
   ======================================== */

/* Mobile Layout (default, < 768px) */
.myComponent {
  padding: var(--spacing-sm);
  font-size: 0.9rem;
}

.myComponent__element {
  margin-bottom: var(--spacing-xs);
}

/* Tablet Layout (768px - 1023px) */
@media (min-width: 768px) {
  .myComponent {
    padding: var(--spacing-md);
    font-size: 1rem;
  }
  
  .myComponent__element {
    margin-bottom: var(--spacing-sm);
  }
}

/* Desktop Layout (>= 1024px) */
@media (min-width: 1024px) {
  .myComponent {
    padding: var(--spacing-lg);
    font-size: 1.1rem;
  }
}
```

2. **Use in JSX:**
```jsx
export function MyComponent() {
  return (
    <div className="myComponent">
      <span className="myComponent__element">Text</span>
    </div>
  );
}
```

### For a Variant/State

Use modifier classes with `--`:

```css
.button { /* Base styles */ }
.button--primary { background: blue; }
.button:disabled { opacity: 0.6; }
```

### For Layout Utilities

Add to the utilities section if it's reusable:

```css
.margin-auto { margin: auto; }
.width-full { width: 100%; }
```

## Migration Notes

### Before (inline styles ❌)

```jsx
<div style={{ 
  padding: '2rem',
  backgroundColor: 'white',
  borderRadius: '8px'
}}>
```

### After (CSS classes ✅)

```jsx
<div className="modal__content">
```

## Performance Benefits

1. **Smaller bundle** - CSS is more compressible than JS objects
2. **Better caching** - CSS files cache separately
3. **Faster rendering** - Browser-optimized CSS parsing
4. **Easier debugging** - Inspect styles in DevTools

## Maintenance Benefits

1. **Single source of truth** - All styles in one file
2. **Find/replace works** - Change colors globally
3. **No duplication** - Reuse classes and variables
4. **Type safety** - No runtime style errors
5. **Better IDE support** - CSS autocomplete and linting

## Responsive Design Philosophy

This app uses a **3-layout breakpoint system** rather than fluid responsive design:

1. **Mobile Layout** (`< 768px`) - Optimized for touch, vertical scrolling, compact information
2. **Tablet Layout** (`768px - 1023px`) - Balanced layout with more horizontal space
3. **Desktop Layout** (`>= 1024px`) - Full-featured layout with maximum information density

**Why 3 layouts instead of fluid?**
- Pixel-perfect control at each breakpoint
- Easier to maintain with small team (1-2 developers)
- Clear separation of concerns
- Better performance (no complex calculations)
- Matches the fixed screen set requirement

**Example: LobbyScreen Component**
- Mobile: Compact padding, smaller fonts, hidden "Last Turn" column
- Tablet: Medium padding, readable fonts, all columns visible
- Desktop: Spacious padding, larger fonts, full table with all details

## Future Improvements

Consider these enhancements as the app grows:

1. **CSS Modules** - Scoped styles per component file
2. **Sass/SCSS** - Variables, nesting, mixins for cleaner breakpoint management
3. **Design tokens** - JSON-based design system for programmatic access
4. **Container queries** - When browser support improves, for component-level responsiveness

For now, the current CSS architecture is:
- ✅ Simple and maintainable
- ✅ Well-organized and documented
- ✅ Scalable for future growth
- ✅ Zero inline styles
- ✅ Responsive with pixel-perfect breakpoints

## Quick Reference

### Common Patterns

```jsx
// Modals
<div className="modal">
  <div className="modal__content">

// Buttons
<button className="button">

// Layout
<div className="flex gap-md">
<div className="flex flex-column gap-sm">

// Hide/Show
<div className={`element ${condition ? '' : 'hidden'}`}>

// Player boards
<div className="playerBoard">
  <div className="playerBoard__player">
    <div className="playerBoard__info playerBoard__info--active">

// Responsive breakpoints
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }

// Hide/show by breakpoint
<div className="show-mobile">Mobile only</div>
<th className="table__headerCell table__headerCell--hide-mobile">Hidden on mobile</th>
```

---

**Last Updated:** January 25, 2026  
**Maintainer:** Development Team
