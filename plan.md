# Overlay Customization Plan

This plan outlines the steps to implement a flexible and customizable overlay system.

1.  **Database Schema (`prisma/schema.prisma`):**
    *   A `style` field of type `Json` will be added to the `Overlay` model. This will store all customization options in a single, easily extendable field.

2.  **Component Refactoring (`src/components/overlay/`):**
    *   `DisplayCounter.tsx` will be refactored into a container component.
    *   New components, `Title.tsx` and `Counter.tsx`, will be created to handle the rendering and styling of the title and counter number independently.

3.  **Configuration UI (`src/pages/OverlayPage.tsx`):**
    *   The UI will be updated to include controls for all new styling options.
    *   Primary controls (arrangement, font, size) will be immediately visible.
    *   Secondary controls will be in an "Advanced Settings" section.
    *   State management will be updated to handle the `style` object and persist changes to the database.

4.  **Backend and Real-time Updates:**
    *   The existing backend API will be used to save the `style` object.
    *   The WebSocket server will broadcast the updated overlay object, including styles, to ensure real-time updates on the public page.

5.  **Public Overlay Page (`src/pages/PublicCounterPage.tsx`):**
    *   This page will be updated to apply the new styles received via WebSocket.