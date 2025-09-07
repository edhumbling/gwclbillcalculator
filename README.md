# GWCL Current Bill Calculator

A lightweight web app to estimate current water bill charges for Ghana Water Company Limited (GWCL), Domestic Category 611. It uses the configured tariffs and adds statutory levies and the service charge.

## Features
- Mobile-first, responsive UI
- Instant calculation with clear breakdown
- Dynamic year in header and footer
- Disclaimer and tariff info section

## Tech Stack
- Static frontend: HTML, CSS, JavaScript (`public/`)
- Local server (optional): Node.js + Express (`server.js`)
- Optional deployment: Netlify (`netlify.toml`)

## Getting Started

### Prerequisites
- Node.js 18+ recommended

### Install
```bash
npm install
```

### Run Locally
- Using Node server (includes security headers, compression and logging):
```bash
npm run dev
# App will start at http://localhost:3000
```
- Or open `public/index.html` directly in a browser (no server needed).

## Usage
1. Enter previous and current meter readings in m³.
2. Click Calculate to view consumption and charge breakdown.
3. Use Reset to restore defaults.

> Note: Only current charges are computed. Any past balances/payments are not included.

## Updating Tariffs
Tariff logic and copy live in these files:
- Rates and math: `public/app.js` (constants at the top in `TARIFFS`)
- Tariff text shown to users: `public/index.html` under “Tariff details”

Steps:
1. Edit `public/app.js` and update values in `TARIFFS`:
   - `firstBlockLimitM3`
   - `firstBlockRate`
   - `excessRate`
   - `serviceCharge`
   - `fireLevyRate`
   - `ruralLevyRate`
2. Update the human-readable tariff notes in `public/index.html` (the Info section).
3. Save and refresh your browser.

## Deployment
### Netlify (static hosting)
This project includes a minimal `netlify.toml` that serves the `public/` folder.
- Drag-and-drop the `public/` folder into Netlify, or connect the repo and set:
  - Publish directory: `public`

### Any Node host (optional)
If you prefer running the Express server (adds headers/compression):
- Deploy the repo to your Node host
- Start with:
```bash
npm run start
```
- On Windows PowerShell if needed:
```powershell
$env:NODE_ENV = 'production'; node server.js
```
- The server serves files from `public/`

## Security
- `helmet` adds sensible headers (CSP allows inline script/style to support the current app)
- `compression` and `morgan` are enabled on the Node server for performance & logs

## Disclaimer
Tariffs and charges may change. Always verify with GWCL’s current published tariffs before relying on results.

## License
MIT
