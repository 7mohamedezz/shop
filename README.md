# Plumbing Shop (Electron + MongoDB)

Desktop management system for a plumbing supplies store. Built with Electron, Node.js, and MongoDB/Mongoose. Supports offline-first local DB with optional Atlas sync, invoicing, printing, and product/customer/plumber management.

## Features
- Products: CRUD, live search, low-stock view, delete confirmation
- Customers & Plumbers: CRUD, quick filter to related invoices
- Invoices: create, edit items/notes, payments/returns, archive/unarchive
- Deleted invoices: view deleted only, restore, or hard-delete permanently
- Printing: rich HTML print preview for invoices
- Offline-first: local DB with in-memory fallback; optional Atlas connection
- Background sync queue (local ➜ Atlas) when configured

## Tech Stack
- Electron (Main/Renderer with preload bridge)
- Node.js + Mongoose
- MongoDB (local) and optional MongoDB Atlas

## Requirements
- Node.js 18+
- npm
- Local MongoDB instance (optional; app can fall back to an in-memory DB)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file at the project root (optional, but recommended):
   ```env
   # Local MongoDB; defaults to mongodb://127.0.0.1:27017/plumbing_shop if omitted
   MONGODB_URI=mongodb://127.0.0.1:27017/plumbing_shop

   # Optional: Atlas URI to enable background sync (leave empty to disable)
   # Example: mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/plumbing_shop
   MONGODB_ATLAS_URI=
   ```

## Run (development)
```bash
npm start
```
- Opens DevTools by default (see `main.js`).
- If local MongoDB is unreachable, the app transparently falls back to an in-memory database so you can still test UI flows.

## Build (distributables)
```bash
npm run build
```
- Uses `electron-builder` (see `package.json -> build`).

## Project Structure
```
.
├─ main.js                  # Electron main process (DB connections, IPC handlers)
├─ preload.js               # Secure IPC bridge exposed to renderer
├─ renderer/
│  ├─ index.html            # UI
│  ├─ renderer.js           # Frontend logic (tabs, lists, modals, printing)
│  └─ styles.css            # Styles
├─ services/                # Business logic + data access
│  ├─ db.js                 # Local/Atlas connections, in-memory fallback
│  ├─ productService.js     
│  ├─ customerService.js    
│  ├─ plumberService.js     
│  ├─ invoiceService.js     
│  └─ syncService.js        # Background sync queue (if Atlas configured)
├─ models/                  # Mongoose models (Product, Customer, Invoice, ...)
├─ scripts/                 # Seed/wipe helpers (optional)
├─ package.json
└─ README.md
```

## Key Workflows (Quick Guide)
- Products page:
  - Add/edit/delete products; deletion asks for confirmation.
  - Low-stock section auto-refreshes after updates.
- Invoices page:
  - Filter by status (active/archived) and show only deleted.
  - Deleted invoices are styled; you can Restore or Hard Delete.
  - Print opens a Chromium print preview (Save to PDF supported).

## Troubleshooting
- DevTools warnings like `Autofill.enable` are harmless in Electron and can be ignored during development.
- If you see GL/VSync warnings on Linux, they’re GPU/driver related and usually harmless.
- DB errors:
  - Ensure `MONGODB_URI` points to a running local MongoDB, or rely on the in-memory fallback.
  - For Atlas, verify `MONGODB_ATLAS_URI`, network/IP allowlist, and credentials.
- Invoice IDs: The app accepts numeric `invoiceNumber` or MongoDB ObjectId where applicable.

## Scripts (optional helpers)
If present, you can run seed/wipe utilities directly with Node:
```bash
node scripts/seed.js
node scripts/wipe.js --local --yes
node scripts/wipe.js --atlas --yes
node scripts/wipe.js --both --yes
```

## License
MIT
