# Changelog

All notable changes to the PreScripto project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-09-10

### Added
- **VisionOS Floating Glass Dock**: Freely draggable mobile navigation bar with persistent coordinates stored in `localStorage`.
- **Zero-Scroll "All Modules" Launcher**: Ultra-compact 4-column quick-launch grid fitting 100% within mobile viewport without scrolling.
- **TV Display Default Audio Chime**: Audible token call notifications enabled by default with automatic Web Audio API context unlock.
- **Dedicated Release Documentation**: `RELEASE_v1.4.md` and updated `About.tsx` version history.

### Changed
- **Removed Tab Lag & Box Outline**: Replaced heavy Framer Motion layout animations with instant CSS micro-transitions and an illuminated glowing accent dot.
- **Mobile Header Ergonomics**: Swapped Doctor profile avatar and settings trigger to sticky top bar for easier one-handed use.
- **Updated About Page**: Current version set to `1.4` with interactive changelog timeline.
- **Doctor Consultation Changelog**: Modal dialog updated with `v1.4` release highlights and acknowledged flag.

### Fixed
- Fixed mobile dock 50% cut-off caused by CSS transform conflict with Framer Motion inline styles.
- Hardened clinic branding and name editing security so superadmin cannot overwrite individual clinic identities.

---

## [1.3.0] - 2026-07-15

### Added
- **About & Version History Page**: Dedicated `/about` view displaying release notes and updates.
- **Modern User Management**: Glassmorphism redesign for staff and role assignments.

### Changed
- Streamlined UI by removing redundant in-app staff consultation calls.
- Vitals UI cleanup and improved BP display icons.

---

## [1.2.0] - 2026-07-01

### Added
- Draggable floating canvas toolbar for digital handwriting with stylus support.
- Marching ants bounding box animation for active prescription drawings.
- Patient queue real-time wait timers.
- Abnormal vitals triage warning flags.
- Patient vitals trend sparklines.
- Visual frequency buttons (1-0-1 shorthand).
- Pre-printed stationery toggle.

---

## [1.1.0] - 2026-06-15

### Added
- Modular consultation sub-components (`QueuePanel`, `ConsultationForm`, `HistoryViewer`).
- Optimistic UI updates with automatic rollback on network failure.
- Multi-tag diagnosis system with autocomplete.
- Custom prescription snippet delete controls.

---

## [1.0.0] - 2026-05-01

### Added
- Initial stable release of PreScripto clinic management platform.
- Digital handwriting canvas for stylus prescriptions.
- Patient vitals recording (BP, Pulse, SpO₂, Temp, Weight, CBG).
- Dedicated reception print queue module.
