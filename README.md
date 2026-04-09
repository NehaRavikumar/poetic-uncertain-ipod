# poetic-uncertain-ipod

Moodify prototype — draw on an iPod-like canvas and get a song suggestion.

Files added:
- `index.html` — single-page app UI (canvas + iPod wheel)
- `style.css` — styles for the iPod look
- `app.js` — drawing logic, feature extraction, Anthropic call fallback, song picker
- `config.js` — loads `.env.local` at runtime
- `.env.example` — template for environment variables
- `songs.json` — small sample of songs with labels (sad/happy/energetic/calm)

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

## Notes
- This is a prototype that uses simple shape descriptors of the drawing (stroke count, average length, fill ratio, bounding box ratio) and either calls Anthropic (if key is provided) or uses a local heuristic.
- The sample `songs.json` is small; you can replace it with samples from the Moodify dataset and load only subsets to keep the client lightweight.
- The Anthropic request in `app.js` calls `https://api.anthropic.com/v1/complete` with `x-api-key` header. Ensure your key and model are compatible.
- `.env.local` is in `.gitignore` so your key won't be committed.

## Next steps you might want:
- Replace the simple sampling with a vector-based similarity search on a subset of the Moodify dataset.
- Add artist images or Spotify links (requires Spotify API keys).
- Improve the vision pipeline (send downsampled raster summary to a vision model or use a server-side vision model).

# poetic-uncertain-ipod
Song generation based on interpretative drawings
