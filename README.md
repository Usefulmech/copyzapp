# CopyZapp - Phone-to-PC Clipboard Bridge

CopyZapp is a local-first, premium, and PWA-responsive clipboard bridge designed to instantly stream text, links, and images from your mobile device directly to your PC. 

Built with React, Express, Vite, and TailwindCSS, it functions as a lightweight ephemeral holding tank. All shared content automatically expires and vanishes after 24 hours (unless manually pinned).

---

## Features

- **Multi-Network Auto-Pairing**:
  - **Same Wi-Fi**: Instantly pair when both devices share a local router.
  - **Windows Mobile Hotspot**: Connect your phone directly to your PC's hotspot for low-latency transfers on the go.
  - **Localhost**: Seamless testing via emulators or on a single device.
  - **Cloud Mode**: Global availability via public deployments.
- **PWA & Android Share Target**: Install CopyZapp as an app. It integrates directly into the Android system share sheet, allowing you to share from Chrome, X, YouTube, or your photo gallery instantly.
- **Capability-Token Security**: Unique randomly-generated API tokens prevent unauthorized pushes to your stream.
- **Hybrid Storage System**: Automatic local file storage in development (data/ folder) and cloud storage via Vercel KV (Redis) and Vercel Blob in production.
- **Sleek Dark Mode Aesthetics**: Glassmorphic UI with micro-animations, interactive FAB speed dials, and responsive mobile bottom sheets.
- **Gemini AI Integration**: Contextual chat assistant powered by Google Gemini 2.5 Flash to summarize links, explain images, and query your clipboard streams.

---

## Running Locally

### Prerequisites
- Node.js (v20+)
- Both devices (phone and PC) must be on the same Wi-Fi network OR your phone must be connected to your PC's Mobile Hotspot.

### Setup & Launch
1. **Clone & Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup Local Environment Variables**:
   Create a .env.local file in the root directory:
   ```env
   PORT=3000
   ```
3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   At startup, the server automatically scans your network adapters and displays all available URLs:
   ```
   CopyZapp running on http://0.0.0.0:3000
      Local:   http://localhost:3000
      Wi-Fi:   http://192.168.1.15:3000
      Hotspot: http://192.168.137.1:3000
   ```
4. **Pair Your Phone**:
   - Open CopyZapp in your PC browser.
   - Click **Pair Phone QR** in the top header.
   - Choose your connection mode (Wi-Fi or Hotspot).
   - Scan the generated QR code with your phone.

---

## Production Deployment (Vercel)

CopyZapp is configured to deploy directly to https://copyzapp.vercel.app with Zero-Configuration.

### 1. Link Free Storage Integrations (Vercel KV & Vercel Blob)
Since serverless functions are stateless, CopyZapp uses Vercel's free storage offerings:
* **Vercel KV (Redis)** (Free 256MB / 3k daily ops): Stores tokens & snippets.
* **Vercel Blob** (Free 250MB / 2k monthly ops): Stores shared images.

#### How to create and link them:
1. Open your project page in the Vercel Dashboard.
2. Click the Storage tab at the top.
3. **Link KV**: Click Connect Database → Select KV (Redis) → Click Create.
4. **Link Blob**: Click Connect Database again → Select Blob → Click Create.

*Vercel will automatically inject all required KV & Blob environment variables into your project settings.*

### 2. Required Environment Variables
In your Vercel Project settings, configure:
- `APP_URL`: The production URL of your deployment (set to `https://copyzapp.vercel.app`). *Required to build accurate QR codes and target endpoints.*
- `GEMINI_API_KEY`: Your Google Gemini API Key.
- `KV_REST_API_URL` & `KV_REST_API_TOKEN`: Automatically populated when you connect Vercel KV.
- `BLOB_READ_WRITE_TOKEN`: Automatically populated when you connect Vercel Blob.

### 3. Vercel CLI Quick Deployment
```bash
# Log in to Vercel
vercel login

# Link and deploy
vercel

# Add KV and Blob storage integrations in the Vercel Dashboard
# Set APP_URL environment variable to your deployment domain
# Pull production variables down for testing:
vercel env pull .env.local
```

---

## Installing as a PWA (Share Sheet Target)

To send text or files directly from your phone's native Share menu:

### Android (Google Chrome)
1. Scan the Pairing QR code on your PC.
2. Tap the browser options menu (three dots icon) in Chrome.
3. Select **Add to Home screen** or **Install app**.
4. Once installed, select any text, link, or image in another app (e.g. YouTube, Twitter) and tap **Share**.
5. Select **CopyZapp** from the share sheet to instantly stream it to your PC dashboard!

### iOS (Safari)
1. Scan the Pairing QR code on Safari.
2. Tap the **Share** button in Safari.
3. Select **Add to Home Screen**.
4. *(Note: iOS does not currently support Web Share Target, but you can copy/paste directly within the PWA interface).*

---

## Project Structure

```
├── api/                  # Vercel Serverless Functions
│   └── [...path].ts      # Catch-all Express router for production
├── lib/
│   ├── app.ts            # Core Express app logic & API endpoints
│   └── storage.ts        # Storage abstraction (Local JSON vs Vercel KV + Blob)
├── src/
│   ├── components/       # React components (Header, PairingModal, MemoryCard, etc.)
│   ├── utils/
│   │   └── clipboard.ts  # HTTP-safe copy-to-clipboard fallback
│   ├── App.tsx           # Dashboard controller & state management
│   ├── index.css         # Main styles (animations, bottom navigation, sheets)
│   └── main.tsx          # React render entry
├── public/
│   ├── sw.js             # Service Worker (offline-first caching)
│   └── icon-*.png        # App icons for PWA manifest
├── vercel.json           # Vercel config (routing rewrites & limits)
└── server.ts             # Local development server entry
```
