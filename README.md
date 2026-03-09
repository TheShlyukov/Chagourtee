# Chagourtee

Self-hosted messenger: the owner runs the server on their computer, creates invites and verifies participants with a codeword. In perspective — federation between servers.

[English version](./README.md) | [Версия на русском](./README.ru.md)

## Stack

- **Server:** Node.js, Fastify, SQLite (better-sqlite3), WebSocket (ws)
- **Client:** React, TypeScript, Vite

## Features

- **Self-hosting**: Full control over your data, deployment on your own server
- **User verification**: Ability to verify participants with a codeword
- **Real-time chat**: Real-time communication with typing and presence indicators
- **User management**: Owner, moderator and member roles
- **Security**: Authorization via sessions, password hashing
- **Administration**: Control panel for creating rooms and invites
- **Message editing**: Ability to edit and delete own messages
- **Message grouping**: Visual grouping of messages from the same user
- **Multi-message selection**: For bulk deletion

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Development mode

In two terminals:

```bash
# Server (port 3000)
npm run dev:server

# Client (port 5173, proxies /api and /ws to server)
npm run dev:client
```

Or with a single command:

```bash
npm run dev
```

Open http://localhost:5173

**Access from phone or other device on the same Wi-Fi:** open in browser `http://YOUR_COMPUTER_NAME_OR_IP:5173` (e.g., `http://macbook-dana.local:5173`). To make invite links point to this address (instead of localhost), create in the project root or in `client/` folder a `.env` file with:
```bash
VITE_APP_PUBLIC_URL=http://<YOUR_IP_ADDRESS>:5173
```
After changing, restart the client (`npm run dev:client`).

### 3. First owner

If there are no users in the database yet, the first owner can be created as follows:

1. Set environment variable (or add to `server/config.example.env` and rename to `.env`):
   ```bash
   export CHAGOURTEE_BOOTSTRAP_SECRET=your-secret-key
   ```
2. On the registration page (/register) or call the API:
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"login":"admin","password":"your-password","bootstrap":"your-secret-key"}'
   ```
3. Then log in with the created login – you are the owner. Create invites in Admin and rooms if needed.

### 4. Participants

- Owner (or moderator) creates an invite in Admin and shares the link like:  
  `https://your-address/register?invite=INVITE_CODE`
- Participant goes to the link, enters login, password and codeword if required.
- If a codeword is specified, the account remains in "waiting for verification" status until the owner in Admin checks the word and clicks "Approve".

## Deployment at owner's premises

### Production build

```bash
npm run build
```

The built client will be in `client/dist`. Serve it through any HTTP server (Nginx, Caddy, etc.), setting `client/dist` as the root directory and proxying `/api` and `/ws` to the server process.

### Running the server

```bash
cd server
PORT=3000 node src/index.js
```

Recommended environment variables (or `.env` file in `server/`):

- `PORT` – port (default 3000)
- `HOST` – host (0.0.0.0 for access from other machines)
- `CHAGOURTEE_DB_PATH` – SQLite file path (default `./data/chagourtee.db`)
- `CHAGOURTEE_SESSION_SECRET` – secret for cookies (must be changed)
- `CHAGOURTEE_BOOTSTRAP_SECRET` – secret for creating the first owner (see above)
- `CHAGOURTEE_MAX_FILE_SIZE` – maximum file size for upload in bytes (default 52428800 = 50MB)
- `CHAGOURTEE_MEDIA_ENCRYPTION_KEY` – encryption key for media files (32 bytes for AES-256)

### Internet access

A server behind NAT/home router is not accessible by external IP without port forwarding. Options:

- **Port forwarding** on the router to the machine with the server.
- **Tailscale / ZeroTier** – participants connect via assigned VPN addresses.
- **Cloudflare Tunnel** – tunnel from your machine to the internet via domain.

The client must open on the same origin as the API (or CORS configured and cookies with the correct domain).

### DB Backup

```bash
npm run db:backup
```

SQLite copy is saved to `data/backups/` (or alongside `CHAGOURTEE_DB_PATH` in subdirectory `backups`).

## Update the Service

To update your Chagourtee installation to the latest available version:

### From the project root:
```bash
npm run update
```

### Or run directly from the server:
```bash
cd server && npm run update-service
```

The update script will:
1. Check the current version of your installation
2. Fetch the latest available tags from the remote repository
3. Compare your current version with the latest available version
4. Prompt you to update if a newer version is available
5. Perform the update by:
   - Fetching the latest changes
   - Checking out the target version tag
   - Installing dependencies for all workspaces

> **Note**: Make sure you have committed any local changes before running the update, as the script will switch to a specific tag which may overwrite uncommitted changes.

## API (briefly)

- `POST /api/auth/login` – login
- `POST /api/auth/logout` – logout
- `GET /api/auth/me` – current user
- `POST /api/auth/register` – registration (inviteId or bootstrap)
- `GET/POST/PATCH/DELETE /api/rooms` – rooms (CRUD for owner/moderator)
- `GET /api/rooms/:id/messages`, `POST /api/rooms/:id/messages` – messages
- `GET/POST/DELETE /api/invites` – invites
- `GET /api/verification/pending`, `POST /api/verification/approve`, `reject` – verification by codeword
- `POST /api/profile/change-password`, `change-login`, `codeword` – profile
- WebSocket `/ws` – new messages, typing, presence (after login via cookie)

## Architecture

### Client side

Frontend implemented with React using TypeScript and Vite. The application is organized into the following components:

- **AuthContext**: Authentication management and user state
- **Layout**: Main application layout
- **Pages**: Page components (Login, Register, Chat, Profile, Admin, VerificationWaiting)
- **API**: Module for server communication
- **WebSocket**: Real-time communication implementation

### Server side

Backend built on Fastify using SQLite for data storage:

- **DB**: Database connection via better-sqlite3
- **Auth**: Authentication and session management
- **Routes**: REST API for working with rooms, messages, invites, etc.
- **WS**: WebSocket server for real-time communication

### Security

- Password hashing with bcrypt
- Session protection via cookies with httpOnly and secure settings
- Permission checks for access to protected routes
- User verification checks for specific actions
- Protection against unauthorized room access

## Functional capabilities

### For users:
- Registration via invites
- Login and logout
- Viewing and filtering rooms
- Sending, editing and deleting own messages
- Showing "typing..." status
- Showing online status of other users
- Changing personal data and password

### For administrators (owner):
- Creating and renaming rooms
- Managing all users (including assigning moderator roles)
- Creating invites with restrictions
- Verifying users by codeword
- Full access to admin panel
- Deleting any messages
- Editing information about any users

### For moderators:
- Creating and deleting invites
- Deleting messages from other users
- Access to invite management section in admin
- Editing user information

## Media Support

In recent updates, Chagourtee added support for sharing media files in chat. Users can share:

- Images (JPG, PNG, GIF, WebP, SVG, BMP, TIFF)
- Videos (MP4, WebM, OGG, MPEG, QuickTime)
- Audio files (MP3, WAV, AAC, OGG, MIDI, WebM, AIF, M4A, etc.)
- Documents (PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP, RAR, etc.)
- Any other file types (all file types are supported)

### Setup

To enable media file encryption, you need to generate and configure an encryption key:

1. Generate a new encryption key:
   ```bash
   cd server
   npm run generate-encryption-key
   ```

2. Copy the generated key to your `.env` file as `CHAGOURTEE_MEDIA_ENCRYPTION_KEY`

3. All uploaded media files are encrypted using AES-256-GCM encryption and stored in `server/data/media/`.

**Important**: The encryption key must be exactly 32 bytes (64 hexadecimal characters) for AES-256 encryption.

Additionally, you can configure the maximum file size allowed for upload by setting the `CHAGOURTEE_MAX_FILE_SIZE` environment variable in bytes (default is 50MB = 52428800 bytes).

## License

MIT