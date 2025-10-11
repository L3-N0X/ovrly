# Overlay Sharing Feature Plan

This document outlines the plan to implement a feature that allows users to grant access to all of their overlays to other users via their Twitch name.

## 1. Database Schema Changes

In `prisma/schema.prisma`, a new model `Viewer` will be added to manage the sharing of all overlays from one user to another.

```prisma
// prisma/schema.prisma

model Viewer {
  id              String   @id @default(cuid())
  userId          String   // The user who is sharing their overlays
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  viewerTwitchName String   // The Twitch username of the user who is granted access
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, viewerTwitchName])
}

model User {
  id               String    @id @default(cuid())
  name             String
  email            String    @unique
  emailVerified    Boolean   @default(false)
  image            String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  twoFactorEnabled Boolean   @default(false)
  Session          Session[]
  Account          Account[]
  Overlay          Overlay[]
  Viewers          Viewer[]
}
```

## 2. Backend API Endpoints

The following API endpoints will be created in `server.ts` to handle the viewer logic:

*   **`POST /api/viewers`**: Grant a user access to all your overlays by their Twitch name.
    *   **Body**: `{ "twitchName": "string" }`
*   **`GET /api/viewers`**: Get all users you have granted access to.
*   **`DELETE /api/viewers`**: Revoke a user's access to your overlays.
    *   **Body**: `{ "twitchName": "string" }`
*   **`GET /api/overlays`**: This endpoint will be updated. In addition to the user's own overlays, it will also return all overlays from users who have granted them viewer access.

## 3. Frontend UI Implementation

### Viewer Management UI (e.g., in a new "Settings" page)

*   A new section will be added to allow users to manage who has access to their overlays.
*   This section will contain an input field for the Twitch username and an "Add Viewer" button.
*   A list of users who currently have access will be displayed, with an option to "Revoke Access".

### Shared Overlays Display (`src/pages/HomePage.tsx`)

*   The `HomePage` will be updated to display both the user's own overlays and overlays from other users who have granted them access. These could be separated into different sections for clarity.

## 4. Workflow Diagram

Here is a Mermaid diagram illustrating the high-level workflow:

```mermaid
graph TD;
    A[User A navigates to Settings] --> B{Enters User B's Twitch name};
    B --> C[Clicks 'Add Viewer'];
    C --> D[API call to POST /api/viewers];
    D --> E[Backend creates Viewer entry];
    E --> F[User B logs in];
    F --> G[API call to GET /api/overlays];
    G --> H[Backend returns User B's overlays AND User A's overlays];
    H --> I[User B sees all of User A's overlays on their HomePage];