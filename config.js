// Load config from .env.local or window globals
// In a real app, a backend would load this securely
async function loadConfig() {
  try {
    const res = await fetch('.env.local');
    if (res.ok) {
      const text = await res.text();
      const config = {};
      text.split('\n').forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
          const [k, v] = line.split('=');
          config[k.trim()] = v.trim();
        }
      });
      return config;
    }
  } catch (e) {
    // .env.local not found or can't be read
  }
  return {};
}

// Export for use in app.js
window.loadConfig = loadConfig;
