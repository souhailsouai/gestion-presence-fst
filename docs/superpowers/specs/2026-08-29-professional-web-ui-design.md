# Professional Web Management UI — Design Specification

Date: 2026-08-29
Scope: Web HTML application only

## Objective
Refactor the existing FST attendance-management HTML into a polished, professional university management interface while preserving the existing Supabase backend, authentication, Edge Functions, persistent session behavior, data model, attendance/grade workflows, reports, administration functions, and academic year 2026/2027.

The Web UI must be visually distinct from the native Android APK. It should resemble a desktop-oriented institutional management system rather than a mobile application enlarged for the browser.

## Visual direction
Use a clean, compact professional management-system aesthetic. The primary canvas is a very light neutral gray with white working surfaces. FST/UTM institutional navy is used for navigation, headings and primary actions; gold is limited to identity accents and selected highlights. Avoid heavy gradients, oversized rounded cards, decorative waves, floating mobile-style controls and excessive animation.

Desktop density should be compact but readable: approximately 8–12 px radii, restrained shadows, 14–16 px body typography, clear separators, aligned form controls, and information-rich tables.

## Application shell
Desktop/tablet layout:
- Fixed/collapsible left navigation rail containing institutional identity and primary sections.
- Compact top bar for page title, contextual actions, current user and synchronization indicator.
- Main workspace with consistent page margins and a maximum useful content width rather than a centered mobile card.
- Navigation sections retain the existing application destinations and admin visibility rules.

Mobile layout:
- Responsive adaptation of the Web system, not a copy of the Android Compose interface.
- Sidebar becomes a compact drawer/menu.
- Tables may become horizontally scrollable or structured cards only where necessary for usability.
- Primary workflows remain usable with touch targets of appropriate size.

## Synchronization status
Do not display a permanent synchronization word/label in the top bar. Use a small colored status indicator:
- green: synchronized;
- orange: synchronization running or local modifications pending;
- red: synchronization error;
- gray: offline;
- blue: server connection/initialization.

Detailed status may be exposed through title/tooltip on desktop and an accessible interaction on mobile. Existing synchronization logic must remain authoritative; this is a presentation-layer mapping only.

## Dashboard
The landing dashboard should prioritize operational information:
- today's/upcoming sessions;
- total students;
- attendance rate or current attendance summary when data permits;
- grades still incomplete when derivable from existing data;
- recent activity/current sessions;
- concise shortcuts to attendance entry, students, sessions and reports.

Do not fabricate metrics that the current data model cannot derive. Dashboard values must be computed from existing application data.

## Data-management screens
Classes/groups, students, sessions, attendance and grades use a consistent management pattern:
- compact page heading and contextual primary action;
- filter/search controls where the current data can support them client-side;
- professional table layout on desktop;
- explicit empty states;
- consistent badges for status;
- compact edit/create forms in panels/modals rather than visually dominant forms;
- destructive actions visually separated from primary actions.

Attendance and grades remain optimized for rapid repetitive entry. Attendance states retain clear semantic colors. Grade validation remains 0–20 and optional.

## Reports
Reports retain the existing generation/export logic. The screen should separate session reports, general summaries and export actions visually, using a restrained toolbar/panel structure. No change to the underlying PDF/CSV behavior unless required to preserve compatibility after the markup refactor.

## Administration
Keep the existing administration capabilities: teacher-account creation, account table/actions, backup/restore, CSV export and global timetable where already implemented. Reorganize them into clearly separated management sections without changing Supabase authorization semantics or duplicating authentication code.

The UI must not expose admin controls to teacher mode merely because they exist in the DOM; existing role/mode visibility rules remain enforced.

## Authentication
Retain a single `loginTeacher()` implementation. Do not reintroduce a second login override or a second authentication layer.

Preserve:
- teacher authentication path;
- admin authentication path and required Edge Functions;
- persistent Supabase session restoration;
- explicit logout/account switching;
- `addMobileShell()` initialization from the established login/session flow if required by the current implementation.

The login screen receives the same professional Web visual language: institutional identity on one side/area and a compact authentication panel. It must not resemble the native APK login screen.

## Architecture constraints
This is primarily a presentation refactor. Preserve existing function names and DOM IDs used by JavaScript wherever practical to reduce regression risk. Prefer CSS classes and limited structural wrappers over rewriting business logic.

No service-role or secret key may be added to client code. The existing publishable Supabase key remains client-safe only under the existing RLS/auth model. No changes to RLS or Edge Functions are part of this UI scope.

Avoid duplicate mobile/desktop implementations of the same business behavior. Responsive behavior must share the same data and event handlers.

## Accessibility and usability
- Visible keyboard focus states.
- Sufficient text/background contrast.
- Buttons retain text or accessible labels where icons alone would be ambiguous.
- Synchronization color indicator also exposes a textual accessible description through ARIA/title rather than relying exclusively on color.
- Forms preserve labels and validation messages.
- Desktop tables remain readable at normal browser zoom.

## Verification
Before calling the refactor complete:
1. Validate all inline JavaScript for syntax errors.
2. Verify exactly one `loginTeacher()` implementation remains.
3. Verify persistent-session initialization remains present.
4. Verify Admin and Teacher mode visibility logic remains intact.
5. Verify synchronization states map to the specified color indicator and no permanent sync status word remains in the top bar.
6. Verify key DOM IDs/functions used by existing workflows remain available.
7. Verify responsive CSS at representative desktop, tablet and mobile widths.
8. Verify no Android/WebView-specific presentation is introduced.
9. Where backend execution is unavailable, explicitly distinguish static verification from end-to-end Supabase verification.

## Non-goals
- Rebuilding the Supabase backend.
- Changing Edge Functions.
- Replacing the data model.
- Modifying the native Android APK.
- Introducing a frontend framework solely for this redesign.
- Adding unrelated features beyond those supported by the existing management application.
