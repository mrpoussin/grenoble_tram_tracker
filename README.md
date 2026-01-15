# Grenoble Tram Tracker 🚊

A real-time tram tracking web application for Grenoble's transit system, built with Next.js.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   └── page.tsx      # Main page
│   ├── components/       # React components
│   ├── hooks/            # Custom hooks
│   └── lib/              # Utilities and types
├── public/               # Static assets
├── gtfs_data/            # GTFS transit data
└── package.json
```

## Deprecated Files

The following files/folders are deprecated from the original Express-based app:
- `server.deprecated.js` - Original Express server
- `public_deprecated/` - Original static frontend
- `next-app_deprecated/` - Original Next.js subfolder (now moved to root)

## License

MIT
