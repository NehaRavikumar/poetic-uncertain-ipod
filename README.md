# poetic-uncertain-ipod

## Setup

1. **Create `.env.local`**: Copy `.env.example` to `.env.local` and paste your Anthropic API key:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your key
   ```
   
2. **Serve locally**: Open `index.html` in a browser or use a simple server:
   ```bash
   # Using Python
   python3 -m http.server 8000
   
   # Or with Node.js (npx)
   npx http-server -p 8000
   
   # Then open: http://localhost:8000
   ```

## Quick start

1. Open `index.html` in a desktop browser (or served locally).
2. The app will auto-load your Anthropic API key from `.env.local` if present.
3. Draw on the canvas (black strokes only). Press the center of the click wheel (Select) to submit.
4. The app will display a matched song (title — artist).
