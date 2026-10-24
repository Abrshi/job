Markdown
# Stormy Morning UI/UX Design System & Master Agent Guidelines

This document serves as the single source of truth for all frontend, UI/UX, and component styling decisions in this project. All AI agents, developers, and tools generating code must strictly adhere to these color hierarchies, layout primitives, accessibility guidelines, and Tailwind CSS specifications.

---

## 1. Design Vision & Visual Language

The visual foundation is built around the **"Stormy Morning"** palette[cite: 1]: a muted, professional blend of slate, atmospheric blue, mist, and deep ocean navy[cite: 1]. 

* **Emotional Tone:** Trustworthy, crisp, focused, modern, and calm[cite: 1].
* **60-30-10 Rule Execution:**
  * **60% Dominant (Neutrals & Canvases):** Off-white `#F8FAFC`, pure white `#FFFFFF`, or subtle slate surfaces.
  * **30% Structural (Structure & Depth):** Slate Navy (`#384959`) for headers, primary controls, and main layout lines; Slate Blue (`#6A89A7`) for borders and secondary elements[cite: 1].
  * **10% Accent (Interactive High-Energy):** Sky Blue (`#88BDF2`) for primary calls to action, active indicators, and focus rings[cite: 1].

---

## 2. Core Palette Tokens

### Primary Brand Palette
* **Dark Slate Navy:** `#384959` — Primary actions, navbar backgrounds, dominant titles[cite: 1].
* **Medium Slate Blue:** `#6A89A7` — Secondary accents, borders, subheadings, muted icons[cite: 1].
* **Sky Blue:** `#88BDF2` — Highlights, primary focal points, energetic CTAs, focus rings[cite: 1].
* **Mist Blue / Tint:** `#BDDDFC` — Badges, subtle hover states, input highlights, card backdrops[cite: 1].

### Neutral System (Cool Slate)
* **Canvas Light (Page Bg):** `#F8FAFC`
* **Surface Light (Cards/Modals):** `#FFFFFF`
* **Subtle Light (Table rows, inputs):** `#F1F5F9`
* **Border Light:** `#E2E8F0`
* **Border Focused:** `#88BDF2`[cite: 1]
* **Text Main:** `#0F172A` (WCAG AAA contrast against white)
* **Text Muted:** `#475569`
* **Text Disabled:** `#94A3B8`

### Semantic Feedback System
* **Success (Green):**
  * Surface: `#ECFDF5` | Border: `#A7F3D0` | Solid/Badge: `#10B981` | Text/Icon: `#065F46`
* **Warning (Amber):**
  * Surface: `#FFFBEB` | Border: `#FDE68A` | Solid/Badge: `#F59E0B` | Text/Icon: `#92400E`
* **Alert / Destructive (Crimson):**
  * Surface: `#FEF2F2` | Border: `#FECACA` | Solid/Badge: `#EF4444` | Text/Icon: `#991B1B`
* **Info (Atmospheric Blue):**
  * Surface: `#F0F7FF` | Border: `#BDDDFC`[cite: 1] | Solid/Badge: `#88BDF2`[cite: 1] | Text/Icon: `#1E3A5F`

---

## 3. Tailwind CSS Setup

### A. Tailwind Configuration (`tailwind.config.ts` or `tailwind.config.js`)

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        stormy: {
          dark: '#384959',        // Slate Navy
          darkHover: '#293642',
          slate: '#6A89A7',       // Medium Slate
          sky: '#88BDF2',         // Sky Accent
          skyHover: '#6EA8E2',
          mist: '#BDDDFC',        // Surface Tint
          canvas: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          main: '#0F172A',
          muted: '#475569',
        },
        feedback: {
          success: {
            bg: '#ECFDF5',
            border: '#A7F3D0',
            DEFAULT: '#10B981',
            text: '#065F46',
          },
          warning: {
            bg: '#FFFBEB',
            border: '#FDE68A',
            DEFAULT: '#F59E0B',
            text: '#92400E',
          },
          danger: {
            bg: '#FEF2F2',
            border: '#FECACA',
            DEFAULT: '#EF4444',
            text: '#991B1B',
          },
          info: {
            bg: '#F0F7FF',
            border: '#BDDDFC',
            DEFAULT: '#88BDF2',
            text: '#1E3A5F',
          },
        },
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(56, 73, 89, 0.06), 0 1px 2px -1px rgba(56, 73, 89, 0.04)',
        card: '0 4px 6px -1px rgba(56, 73, 89, 0.07), 0 2px 4px -2px rgba(56, 73, 89, 0.05)',
        elevated: '0 10px 15px -3px rgba(56, 73, 89, 0.1), 0 4px 6px -4px rgba(56, 73, 89, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
4. UI/UX Rules for the Agent
Hierarchy Before Decoration: Never rely purely on font color to create hierarchy. Combine font-semibold / font-medium, size variation, and color contrast.

Accessible Text Contrast (WCAG 2.1 AA):

Never use light text on #BDDDFC or #88BDF2. Always use dark navy text (#0F172A or #1E293B) on sky/mist colors.

White text (#FFFFFF) is permitted on #384959.

Interactive Predictability:

Interactive elements must always have distinct states: default, hover, active, and focus-visible.

Form inputs must always have explicit focus rings: focus:outline-none focus:ring-2 focus:ring-stormy-sky focus:border-stormy-sky.

Spacing & Layout Standard:

Minimum touch targets: 44px by 44px (h-11 min-w-[44px]) on mobile.

Consistent component vertical rhythm using standard increments: gap-2 (8px), gap-4 (16px), gap-6 (24px).

No Visual Noise: Avoid jarring bright neon tones. Status elements must always pair a gentle pastel background with saturated icons/borders and dark readable text.

5. Canonical Component Templates
A. Buttons
TypeScript
// 1. Primary Solid (Slate Navy)
<button className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-stormy-dark hover:bg-stormy-darkHover active:scale-[0.98] transition-all shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stormy-sky focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none">
  Primary Action
</button>

// 2. High-Impact CTA (Sky Blue)
<button className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold text-stormy-dark bg-stormy-sky hover:bg-stormy-skyHover active:scale-[0.98] transition-all shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stormy-slate focus-visible:ring-offset-2">
  Get Started Now
</button>

// 3. Secondary / Outline
<button className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-stormy-dark bg-transparent border border-stormy-slate/40 hover:bg-stormy-canvas hover:border-stormy-slate active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stormy-sky">
  Cancel
</button>

// 4. Ghost / Minimal
<button className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-stormy-slate hover:text-stormy-dark hover:bg-stormy-mist/30 transition-colors">
  View Details
</button>

// 5. Destructive Button
<button className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-feedback-danger hover:bg-red-600 active:scale-[0.98] transition-all shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
  Delete Record
</button>
B. Form Inputs
TypeScript
<div className="flex flex-col gap-1.5 w-full">
  <label className="text-sm font-medium text-stormy-main">
    Email Address <span className="text-feedback-danger">*</span>
  </label>
  <input 
    type="email" 
    placeholder="you@company.com" 
    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stormy-border rounded-lg text-stormy-main placeholder:text-stormy-muted/60 transition-all focus:outline-none focus:ring-2 focus:ring-stormy-sky focus:border-stormy-sky disabled:bg-slate-100 disabled:cursor-not-allowed"
  />
  <p className="text-xs text-stormy-muted">We will never share your email with third parties.</p>
</div>
C. Alerts & Notifications
TypeScript
// 1. Success Alert
<div className="flex items-start gap-3 p-4 border rounded-xl bg-feedback-success-bg border-feedback-success-border text-feedback-success-text">
  <CheckCircleIcon className="w-5 h-5 flex-shrink-0 text-feedback-success"/>
  <div className="text-sm">
    <strong className="font-semibold">Update successful!</strong> Your settings have been saved.
  </div>
</div>

// 2. Warning Alert
<div className="flex items-start gap-3 p-4 border rounded-xl bg-feedback-warning-bg border-feedback-warning-border text-feedback-warning-text">
  <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 text-feedback-warning"/>
  <div className="text-sm">
    <strong className="font-semibold">Attention required:</strong> Your trial expires in 2 days.
  </div>
</div>

// 3. Error Alert
<div className="flex items-start gap-3 p-4 border rounded-xl bg-feedback-danger-bg border-feedback-danger-border text-feedback-danger-text">
  <XCircleIcon className="w-5 h-5 flex-shrink-0 text-feedback-danger"/>
  <div className="text-sm">
    <strong className="font-semibold">Error:</strong> Unable to process request. Please retry.
  </div>
</div>

// 4. Info Alert (Atmospheric Stormy)
<div className="flex items-start gap-3 p-4 border rounded-xl bg-feedback-info-bg border-feedback-info-border text-feedback-info-text">
  <InformationCircleIcon className="w-5 h-5 flex-shrink-0 text-stormy-dark"/>
  <div className="text-sm">
    <strong className="font-semibold">System update:</strong> Maintenance scheduled for 02:00 UTC.
  </div>
</div>
D. Badges & Status Chips
TypeScript
// Active / Live
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-feedback-success-bg text-feedback-success-text border border-feedback-success-border">
  Active
</span>

// Pending
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border">
  Pending
</span>

// Primary Brand Badge
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stormy-mist/50 text-stormy-dark border border-stormy-mist">
  Pro Plan
</span>
E. Cards & Containers
TypeScript
<div className="bg-white border border-stormy-border rounded-xl p-6 shadow-card hover:shadow-elevated transition-shadow duration-200">
  <div className="flex items-center justify-between pb-4 border-b border-stormy-border">
    <h3 className="text-base font-semibold text-stormy-main">System Analytics</h3>
    <span className="text-xs font-medium text-stormy-muted">Real-time</span>
  </div>
  <div className="py-4 text-sm text-stormy-muted">
    Clean surface with high-contrast text and a balanced slate border structure.
  </div>
  <div className="pt-4 flex justify-end gap-2">
    <button className="px-3 py-1.5 text-xs font-medium text-stormy-dark hover:bg-stormy-canvas rounded-md transition-colors">Dismiss</button>
    <button className="px-3 py-1.5 text-xs font-medium text-white bg-stormy-dark rounded-md hover:bg-stormy-darkHover transition-colors">Inspect</button>
  </div>
</div>
6. Layout Archetypes (Next.js App Router)
Dashboard Header (<nav>): Use bg-stormy-dark text-white for a grounded top bar, or bg-white border-b border-stormy-border for an open, airy SaaS aesthetic with #384959 active links.

Side Navigation: bg-stormy-canvas with border-r border-stormy-border. Active nav items: bg-stormy-mist/40 text-stormy-dark font-medium.

Main Area: bg-stormy-canvas min-h-screen text-stormy-main.

