const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const songResult = document.getElementById('songResult');
const message = document.getElementById('message');
const apiKeyInput = document.getElementById('apiKey');
const tempInput = document.getElementById('temp');
const colorPicker = document.getElementById('colorPicker');
const colorPreview = document.getElementById('colorPreview');
const debugSource = document.getElementById('debugSource');
const debugDump = document.getElementById('debugDump');
const retroCursor = document.getElementById('retroCursor');
const screen = document.querySelector('.screen');

let drawing = false;
let currentStroke = [];
let strokes = [];
let brushColor = colorPicker.value;

const featureFields = {
  strokeCount: document.getElementById('feature-strokeCount'),
  totalLen: document.getElementById('feature-totalLen'),
  avgLen: document.getElementById('feature-avgLen'),
  fillRatio: document.getElementById('feature-fillRatio'),
  bboxRatio: document.getElementById('feature-bboxRatio'),
  dominantColor: document.getElementById('feature-dominantColor')
};

const scoreFields = {
  sad: document.getElementById('score-sad'),
  happy: document.getElementById('score-happy'),
  energetic: document.getElementById('score-energetic'),
  calm: document.getElementById('score-calm')
};

// Load API key from .env.local if available
(async () => {
  const config = await window.loadConfig();
  if (config.ANTHROPIC_API_KEY) {
    apiKeyInput.value = config.ANTHROPIC_API_KEY;
    apiKeyInput.placeholder = 'loaded from .env.local';
  }
})();

ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.lineWidth = 6;
setBrushColor(brushColor);
colorPicker.addEventListener('input', (e) => setBrushColor(e.target.value));
colorPicker.addEventListener('change', (e) => setBrushColor(e.target.value));

document.addEventListener('pointermove', handleCursorMove);
document.addEventListener('pointerleave', hideCursor);
document.addEventListener('pointerdown', () => setCursorPressed(true));
document.addEventListener('pointerup', () => setCursorPressed(false));
screen.addEventListener('pointerenter', () => setCursorMode('brush'));
screen.addEventListener('pointerleave', () => setCursorMode('default'));

function resizeCanvas(){
  // fixed size for prototype
}

canvas.addEventListener('pointerdown', (e)=>{
  drawing = true;
  currentStroke = { color: brushColor, points: [] };
  setBrushColor(currentStroke.color);
  const p = getPos(e); currentStroke.points.push(p);
  ctx.beginPath(); ctx.moveTo(p.x,p.y);
});
canvas.addEventListener('pointermove', (e)=>{
  if(!drawing) return;
  setBrushColor(currentStroke.color);
  const p = getPos(e); currentStroke.points.push(p);
  ctx.lineTo(p.x,p.y); ctx.stroke();
});
canvas.addEventListener('pointerup', (e)=>{
  if(!drawing) return; drawing=false; strokes.push(currentStroke); ctx.closePath();
});
canvas.addEventListener('pointerleave', ()=>{ if(drawing){ drawing=false; strokes.push(currentStroke); ctx.closePath(); }});

function getPos(e){
  const rect = canvas.getBoundingClientRect();
  return {x: e.clientX - rect.left, y: e.clientY - rect.top};
}

clearBtn.addEventListener('click', ()=>{
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  strokes=[];
  songResult.textContent='—';
  songResult.style.color = '#222';
  message.textContent='Draw on the canvas, then press the wheel center to submit.';
  renderDebug(null);
});

submitBtn.addEventListener('click', async ()=>{
  message.textContent = 'Processing...';
  const features = extractFeatures();
  const heuristic = heuristicEmotion(features);
  const temp = parseFloat(tempInput.value);
  let emotion = null;
  let source = 'Local heuristic';
  const apiKey = apiKeyInput.value.trim();
  if(apiKey){
    try{
      emotion = await callAnthropic(apiKey, features, temp);
      source = 'Anthropic API';
    }catch(err){
      console.warn('Anthropic call failed, using local heuristic', err);
      emotion = heuristic;
      source = 'Local heuristic (Anthropic failed)';
    }
  }else{
    emotion = heuristic;
  }

  const songs = await fetch('songs.json').then(r=>r.json());
  const pick = pickSongFromSongs(songs, emotion.label, temp);
  songResult.innerHTML = pick ? `${pick.title} — ${pick.artist}` : 'No match found';
  songResult.style.color = features.dominantColor;
  message.textContent = `Detected: ${emotion.label} (${Math.round((emotion.score||0)*100)}%)`;
  renderDebug({
    source,
    finalEmotion: emotion,
    heuristic,
    features,
    strokeCapture: {
      strokeCount: strokes.length,
      pointCounts: strokes.map((stroke) => stroke.points.length)
    }
  });
});

function extractFeatures(){
  // compute simple descriptors from strokes and pixels
  const strokeCount = strokes.length;
  let totalLen = 0;
  strokes.forEach(s=>{ for(let i=1;i<s.points.length;i++){ const dx=s.points[i].x-s.points[i-1].x, dy=s.points[i].y-s.points[i-1].y; totalLen+=Math.hypot(dx,dy); }});
  const avgLen = strokeCount? totalLen/strokeCount:0;

  // filled ratio sampling
  const img = ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let ink=0, total=0;
  let colorSum = {r:0, g:0, b:0};
  for(let i=0;i<img.length;i+=4){
    total++;
    const r=img[i], g=img[i+1], b=img[i+2];
    const isInk = !(r>245 && g>245 && b>245);
    if(isInk){
      ink++;
      colorSum.r += r;
      colorSum.g += g;
      colorSum.b += b;
    }
  }
  const fillRatio = ink/total;
  const dominantColor = ink
    ? rgbToHex(
        Math.round(colorSum.r / ink),
        Math.round(colorSum.g / ink),
        Math.round(colorSum.b / ink)
      )
    : '#222222';

  // bounding box
  let minX=9999,minY=9999,maxX=0,maxY=0; if(strokeCount===0){ minX=0;minY=0;maxX=0;maxY=0; }
  strokes.forEach(s=>s.points.forEach(p=>{ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y;}));
  const bboxArea = (maxX-minX)*(maxY-minY);
  const canvasArea = canvas.width*canvas.height;
  const bboxRatio = canvasArea? Math.max(0,Math.min(1,bboxArea/canvasArea)) : 0;

  return {strokeCount, totalLen, avgLen, fillRatio, bboxRatio, dominantColor};
}

function heuristicEmotion(f){
  const intensity = clamp01((norm(f.strokeCount, 0, 18) * 0.3) + (norm(f.totalLen, 0, 3200) * 0.4) + (norm(f.fillRatio, 0, 0.18) * 0.3));
  const spread = clamp01((norm(f.bboxRatio, 0, 0.65) * 0.6) + (norm(f.avgLen, 0, 260) * 0.4));
  const color = analyzeColor(f.dominantColor);

  const scores = {
    energetic: (
      intensity * 0.45 +
      spread * 0.2 +
      color.warmth * 0.2 +
      color.brightness * 0.15
    ),
    calm: (
      (1 - intensity) * 0.35 +
      spread * 0.25 +
      color.coolness * 0.2 +
      color.softness * 0.2
    ),
    happy: (
      color.brightness * 0.35 +
      color.warmth * 0.25 +
      spread * 0.2 +
      (1 - color.mutedness) * 0.2
    ),
    sad: (
      (1 - color.brightness) * 0.3 +
      color.coolness * 0.2 +
      color.mutedness * 0.2 +
      (1 - spread) * 0.15 +
      (1 - intensity) * 0.15
    )
  };

  if(f.strokeCount === 0 || f.totalLen < 20){
    scores.calm += 0.2;
    scores.sad += 0.15;
    scores.energetic -= 0.2;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [label, bestScore] = ranked[0];
  const secondScore = ranked[1][1];
  const margin = Math.max(0, bestScore - secondScore);
  const score = clamp01(0.5 + margin * 0.9 + bestScore * 0.15);

  return {label, score, scores, components: {intensity, spread, color}};
}

async function callAnthropic(key, features, temp){
  // Compose prompt describing drawing features. Ask Anthropic to return JSON with label in {sad,happy,energetic,calm}
  const prompt = `You are given a short numeric description of a user's drawing: ${JSON.stringify(features)}. Based on shapes, density, and the dominant drawing color, choose one label from: sad, happy, energetic, calm. Return a single-line JSON object like {"label":"happy","score":0.78,"keywords":["..." ]}.`;

  const body = {model: 'claude-2', prompt: prompt, max_tokens: 60, temperature: temp};
  const res = await fetch('https://api.anthropic.com/v1/complete', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key},
    body: JSON.stringify(body)
  });
  if(!res.ok) throw new Error('Anthropic error '+res.status);
  const data = await res.json();
  // attempt to extract JSON from the returned text
  const text = (data.completion || data.output || data.text || '').trim();
  try{ const parsed = JSON.parse(text); return {label:parsed.label, score:parsed.score||0.8}; }catch(e){
    // best-effort: search for a label word
    const t = text.toLowerCase(); if(t.includes('energetic')) return {label:'energetic',score:0.8};
    if(t.includes('calm')) return {label:'calm',score:0.8};
    if(t.includes('sad')) return {label:'sad',score:0.8};
    if(t.includes('happy')) return {label:'happy',score:0.8};
    return heuristicEmotion(features);
  }
}

function pickSongFromSongs(songs, label, temp){
  // temp in [0,1], higher = more random
  const same = songs.filter(s=>s.label===label);
  if(same.length===0) return null;
  const sameBias = Math.max(0.45, 1 - temp * 0.55);
  if(Math.random() < sameBias){
    return same[Math.floor(Math.random()*same.length)];
  }

  // broader pool with a lighter preference for the detected mood
  const pool = [];
  songs.forEach(s=>{
    const copies = s.label===label ? 5 : 2;
    for(let i=0;i<copies;i++) pool.push(s);
  });
  return pool[Math.floor(Math.random()*pool.length)];
}

function rgbToHex(r, g, b){
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function analyzeColor(hex){
  const {r, g, b} = hexToRgb(hex);
  const brightness = ((0.299 * r) + (0.587 * g) + (0.114 * b)) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const warmth = clamp01(((r - b) + (0.35 * g)) / 255);
  const coolness = clamp01(((b - r) + (0.15 * g)) / 255);
  const mutedness = 1 - saturation;
  const softness = clamp01((mutedness * 0.55) + ((1 - saturation) * 0.2) + (brightness * 0.25));
  return {brightness, saturation, warmth, coolness, mutedness, softness};
}

function hexToRgb(hex){
  const clean = (hex || '').replace('#', '');
  if(clean.length !== 6) return {r: 34, g: 34, b: 34};
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function norm(value, min, max){
  if(max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

function clamp01(value){
  return Math.max(0, Math.min(1, value));
}

function renderDebug(data){
  if(!data){
    debugSource.textContent = 'Waiting for a submission';
    debugDump.textContent = 'Waiting for a submission';
    setFeatureValue('strokeCount', '—');
    setFeatureValue('totalLen', '—');
    setFeatureValue('avgLen', '—');
    setFeatureValue('fillRatio', '—');
    setFeatureValue('bboxRatio', '—');
    setFeatureValue('dominantColor', '—');
    setScoreValue('sad', '—');
    setScoreValue('happy', '—');
    setScoreValue('energetic', '—');
    setScoreValue('calm', '—');
    return;
  }

  const {features, heuristic, finalEmotion, source} = data;
  const sourceText = `${source} • final: ${finalEmotion.label} ${formatPercent(finalEmotion.score || 0)}`;
  debugSource.textContent = sourceText;
  debugDump.textContent = JSON.stringify(data, null, 2);

  setFeatureValue('strokeCount', String(features.strokeCount));
  setFeatureValue('totalLen', formatNumber(features.totalLen));
  setFeatureValue('avgLen', formatNumber(features.avgLen));
  setFeatureValue('fillRatio', formatPercent(features.fillRatio));
  setFeatureValue('bboxRatio', formatPercent(features.bboxRatio));
  setFeatureValue('dominantColor', features.dominantColor.toUpperCase());

  setScoreValue('sad', formatPercent(heuristic.scores.sad));
  setScoreValue('happy', formatPercent(heuristic.scores.happy));
  setScoreValue('energetic', formatPercent(heuristic.scores.energetic));
  setScoreValue('calm', formatPercent(heuristic.scores.calm));
}

function setFeatureValue(name, value){
  const field = featureFields[name];
  if(field){
    field.textContent = value;
  }
}

function setScoreValue(name, value){
  const field = scoreFields[name];
  if(field){
    field.textContent = value;
  }
}

function formatNumber(value){
  return Number.isFinite(value) ? value.toFixed(1) : '—';
}

function formatPercent(value){
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
}

function handleCursorMove(e){
  if(!retroCursor || e.pointerType === 'touch') return;
  retroCursor.classList.add('visible');
  retroCursor.style.left = `${e.clientX}px`;
  retroCursor.style.top = `${e.clientY}px`;
}

function hideCursor(){
  if(!retroCursor) return;
  retroCursor.classList.remove('visible');
  setCursorPressed(false);
}

function setCursorMode(mode){
  if(!retroCursor) return;
  retroCursor.classList.toggle('brush', mode === 'brush');
}

function setCursorPressed(pressed){
  if(!retroCursor) return;
  retroCursor.style.transform = pressed
    ? 'translate(-50%, -50%) scale(0.9)'
    : 'translate(-50%, -50%) scale(1)';
}

function setBrushColor(color){
  brushColor = color;
  ctx.strokeStyle = color;
  colorPicker.value = color;
  colorPreview.style.background = color;
}

// initial canvas background
ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
