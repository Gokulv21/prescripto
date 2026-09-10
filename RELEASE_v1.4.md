# 🚀 PreScripto v1.4.0 Release Notes

**Release Date:** September 10, 2026  
**Status:** Production Ready / Stable  
**Version:** `v1.4.0`  

---

## 🌟 Executive Summary

PreScripto `v1.4` introduces a major visual and ergonomics overhaul inspired by **Apple VisionOS and iOS 18 design systems**, focused on effortless mobile usability, instantaneous page navigation, responsive TV queue displays, and hardened clinic data security.

---

## 📱 What's New in v1.4

### 1. 🧲 VisionOS-Inspired Floating Glass Dock (Freely Draggable)
- **Fluid Floating Navigation:** Replaced the static bottom navigation bar with a frosted glass floating dock (`backdrop-blur-2xl`, ultra-fine border, soft ambient shadow).
- **Free Drag Repositioning:** Users can freely drag and reposition the dock anywhere on their mobile device to suit their dominant thumb reach or avoid on-screen keyboards and forms.
- **Position Persistence Across Sessions:** Dock `{ x, y }` coordinates are automatically persisted in `localStorage` (`prescripto_mobile_dock_pos`). When reopening the app or refreshing the page, the dock remains exactly where you left it.
- **Double-Tap Center Reset:** Double-tapping the subtle grab handle immediately resets the dock back to its default bottom-center anchor.
- **Accidental Tap Protection:** Drag actions are isolated from tap triggers, preventing unintended page navigation while dragging.

### 2. ⚡ Zero-Lag Navigation & Borderless Design
- **Eliminated Route-Switching Stutter:** Removed the heavy Framer Motion shared layout container (`layoutId="mobile-dock-active-pill"`) that caused frame drops during page mount.
- **Instantaneous Micro-Transitions:** Navigation across core clinical tabs (Home, Patients, Entry, Consult, Menu) is now instantaneous and silky-smooth.
- **Illuminated Glow Indicator:** Active tabs are highlighted with a sleek accent scale and an illuminated glowing indicator dot (`bg-primary` with accent glow) beneath the icon.

### 3. 🍱 Ultra-Compact "All Modules" Launcher (Zero Scrolling)
- **Ergonomic 4-Column Grid:** Redesigned the "All Modules" slide-up launcher sheet into an ultra-compact 4-column matrix.
- **Proportional Icon Tiles:** Reduced icon tiles to compact `w-8 h-8` dimensions with crisp typography, ensuring the entire launcher fits 100% on any smartphone screen without requiring any scrolling.
- **Streamlined Header & Theme Switcher:** Integrated quick dark/light/system mode controls and sign-out buttons in a neat, single-view layout.

### 4. 🔄 Mobile Header Ergonomics (Profile Swapped to Top)
- **Thumb-Zone Optimization:** The Doctor avatar profile and quick settings trigger have been swapped to the sticky top navigation header alongside the clinic logo and notification center.
- **Dedicated Clinical Dock:** Keeps the bottom floating dock exclusively reserved for high-frequency clinical actions.

### 5. 🔔 TV Queue Display Default Audio Chime
- **Automatic Audio Activation:** The TV Display token calling chime is now enabled and audible by default (`isAudioEnabled = true`).
- **Web Audio Context Unlock:** Automatically unlocks and resumes the Web Audio API context upon initial user interaction.
- **Multi-Device Responsive Layout:** Optimized typography, queue cards, and audio controls for widescreen smart TVs, iPads/tablets, and mobile displays.

### 6. 🛡️ Superadmin & Clinic Branding Isolation
- **Role Isolation:** Clinic branding, clinic name customisations, and clinic facility photo uploads are strictly isolated to clinic owners and doctors. Superadmins cannot accidentally overwrite clinic identity.
- **TV Display Clinic Photo:** Clinic photos uploaded in Clinic Branding are seamlessly reflected on the TV Queue Display header.

---

## 🛠️ Technical Details & Changes

| Area | Component / File | Description |
|---|---|---|
| **App Layout** | `src/components/AppLayout.tsx` | Integrated draggable mobile dock with coordinate persistence, borderless tabs, top header profile swap, and compact launcher sheet. |
| **TV Display** | `src/pages/TVDisplay.tsx` | Enabled default chime audio with Web Audio API resume and responsive grid. |
| **Consultation** | `src/pages/DoctorConsultation.tsx` | Updated version changelog modal to v1.4 with key updates and acknowledged flag `prescripto_version_1_4_acknowledged`. |
| **About Page** | `src/pages/About.tsx` | Updated `CURRENT_VERSION` to `1.4` with detailed timeline changelog and feature icons. |
| **Package** | `package.json` | Bumped version to `1.4.0`. |

---

## 🧪 Verification & Test Results

- **Unit & Integration Tests**: 22 / 22 passed across 4 test suites (`npm test`).
  - `src/test/example.test.ts` (1 passed)
  - `src/test/medical-safety.test.ts` (6 passed)
  - `src/test/age-calculation.test.ts` (10 passed)
  - `src/test/api-integrity.test.ts` (5 passed)
- **TypeScript Typecheck**: 0 errors (`npx tsc --noEmit`).
- **Production Build**: Verified with Vite production bundler (`npm run build`).

---

## 🚀 Deployment Checklist

When pushing to GitHub and deploying (e.g. via `npm run deploy` / `gh-pages`):
1. `git add .`
2. `git commit -m "feat(v1.4.0): release v1.4 with visionos mobile dock, zero-scroll launcher, and tv chime"`
3. `git push origin main`
4. Run `npm run deploy` (which runs `predeploy: npm run build` and publishes to GitHub Pages).
