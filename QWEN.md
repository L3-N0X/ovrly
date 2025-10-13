# SimpleOverlay Project Documentation

## Project Overview

SimpleOverlay is a React-based web application built with TypeScript and Vite that allows users to create, manage, and share customizable overlay elements for streaming services like Twitch. The application features a drag-and-drop interface for creating overlays with different element types (titles, counters, containers) and supports real-time updates via WebSockets.

### Key Features
- **Real-time Overlays**: Live updating overlays with WebSocket support
- **Drag-and-Drop Interface**: Pragmatic drag-and-drop functionality for arranging elements
- **Twitch Authentication**: Social login via Twitch OAuth
- **Multi-user Editing**: Support for owner and editor roles with permissions
- **Overlay Presets**: Predefined templates for quick overlay creation
- **Public Access**: Shareable public overlay endpoints
- **Responsive Design**: Modern UI with dark theme support

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Bun.js server
- **Database**: Prisma ORM with SQLite adapter
- **Authentication**: Better Auth with Twitch OAuth
- **UI Components**: Radix UI primitives, Tailwind CSS, shadcn/ui
- **State Management**: React hooks and context
- **Styling**: Tailwind CSS with custom theme

## Project Structure

```
SimpleOverlay/
├── auth.ts              # Authentication configuration (Better Auth)
├── server.ts            # Bun.js backend server with WebSocket support
├── index.html           # Main HTML entry point
├── package.json         # Project dependencies and scripts
├── vite.config.ts       # Vite configuration
├── components.json      # shadcn/ui configuration
├── public/              # Static assets and presets
│   └── presets/         # Overlay preset templates
└── src/                 # Frontend source code
    ├── components/      # React components and UI elements
    ├── pages/           # Route-specific pages
    ├── lib/             # Utility functions and shared code
    └── main.tsx         # React app entry point
```

## Building and Running

### Prerequisites
- Node.js (or Bun.js)
- SQLite database
- Twitch OAuth credentials

### Setup Instructions

1. **Install Dependencies**:
   ```bash
   bun install
   # or if using npm
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the project root with the following:
   ```env
   AUTH_SECRET=your_auth_secret_here
   AUTH_TWITCH_ID=your_twitch_client_id
   AUTH_TWITCH_SECRET=your_twitch_client_secret
   ```

3. **Database Setup**:
   Run Prisma migrations to set up the SQLite database:
   ```bash
   npx prisma migrate dev
   # or if using Bun
   bunx prisma migrate dev
   ```

4. **Run in Development**:
   The `dev` script starts both the backend server and the Vite frontend development server:
   ```bash
   bun run dev
   # or
   npm run dev
   ```
   This will start:
   - Backend server on port 3000
   - Frontend dev server on port 5173 (with proxy to backend)

5. **Build for Production**:
   ```bash
   bun run build
   # or
   npm run build
   ```

6. **Preview Production Build**:
   ```bash
   bun run preview
   # or
   npm run preview
   ```

### API Endpoints

#### Authentication
- `GET/POST/DELETE /api/auth/*` - Better Auth endpoints (login, register, etc.)

#### Overlays (requires authentication)
- `GET /api/overlays` - Get all overlays for the current user (includes shared overlays)
- `POST /api/overlays` - Create a new overlay with optional preset
- `GET /api/overlays/:id` - Get specific overlay details
- `PATCH /api/overlays/:id` - Update overlay properties
- `DELETE /api/overlays/:id` - Delete an overlay

#### Elements (requires authentication)
- `POST /api/overlays/:id/elements` - Add new element to overlay
- `PATCH /api/elements/:id` - Update element properties
- `DELETE /api/elements/:id` - Remove element from overlay
- `POST /api/elements/reorder` - Reorder elements in overlay

#### Editors (requires authentication)
- `GET /api/editors` - Get editors for current user's overlays
- `POST /api/editors` - Add a new editor
- `DELETE /api/editors` - Remove an editor

#### Presets
- `GET /api/presets/overlays` - Get available overlay templates

#### Public Access
- `GET /api/public/overlays/:id` - Get public overlay data

#### WebSocket
- `GET /ws?overlayId=:id` - WebSocket connection for real-time overlay updates

## Development Conventions

### Frontend Code Style
- TypeScript with strict type checking
- Component-based architecture with React hooks
- Tailwind CSS for styling with custom theme provider
- File-based routing with React Router DOM
- Protected routes for authenticated pages
- Alias imports using `@/*` paths (configured in tsconfig.json)

### Backend Architecture
- Bun.js server with WebSocket support
- RESTful API design with proper HTTP methods and status codes
- Prisma ORM for database operations
- Better Auth for authentication and session management
- CORS configuration for frontend integration
- Real-time updates using Bun's pub/sub system

### UI Components
- Built with Radix UI primitives for accessibility
- Styled with shadcn/ui and Tailwind CSS
- Dark theme as default with theme provider
- Responsive design using Tailwind utility classes
- Drag-and-drop using @atlaskit/pragmatic-drag-and-drop library

### Environment Variables
- VITE_ prefix for frontend environment variables
- Standard environment variables for backend configuration
- Dotenv for loading environment variables

## Key Dependencies

- `@atlaskit/pragmatic-drag-and-drop`: Advanced drag-and-drop functionality
- `better-auth`: Authentication framework with OAuth support
- `@prisma/client`: Database client with type safety
- `react-router-dom`: Client-side routing
- `@radix-ui/react-*`: Accessible UI components
- `tailwindcss`: Utility-first CSS framework
- `lucide-react`: Icon library
- `bun`: Runtime for the backend server
- `vite`: Frontend build tool and dev server

## Additional Notes

- The application uses a WebSocket connection to provide real-time overlay updates to clients
- Overlay presets are stored in the public/presets/overlay-presets.json file
- The project uses a monorepo-style structure with both frontend and backend in the same repository
- Authentication is required for most API operations, with some public endpoints available
- The UI supports both owner and editor roles with different permission levels