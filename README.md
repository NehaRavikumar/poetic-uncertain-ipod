# poetic-uncertain-ipod

Moodify prototype — draw on an iPod-like canvas and get a song suggestion.

Files added:
- `index.html` — single-page app UI (canvas + iPod wheel)
- `style.css` — styles for the iPod look
- `app.js` — drawing logic, feature extraction, Anthropic call fallback, song picker
- `songs.json` — small sample of songs with labels (sad/happy/energetic/calm)

Quick start

1. Open `index.html` in a desktop browser (double-click or serve via a simple static server).
2. (Optional) Paste your Anthropic API key into the field to let the app call the Anthropic complete endpoint. If omitted, a local heuristic maps drawing to an emotion.
3. Draw on the canvas (black only). Press the center of the click wheel (Select) to submit. The app will display a matched song (title — artist).

Notes
- This is a prototype that uses simple shape descriptors of the drawing (stroke count, average length, fill ratio, bounding box ratio) and either calls Anthropic (if key is provided) or uses a local heuristic.
- The sample `songs.json` is small; you can replace it with samples from the Moodify dataset and load only subsets to keep the client lightweight.
- The Anthropic request in `app.js` calls `https://api.anthropic.com/v1/complete` with `x-api-key` header. Ensure your key and model are compatible.

Next steps you might want:
- Replace the simple sampling with a vector-based similarity search on a subset of the Moodify dataset.
- Add artist images or Spotify links (requires Spotify API keys).
- Improve the vision pipeline (send downsampled raster summary to a vision model or use a server-side vision model).
# poetic-uncertain-ipod
Song generation based on interpretative drawings
