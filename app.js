const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const songResult = document.getElementById('songResult');
const message = document.getElementById('message');
const apiKeyInput = document.getElementById('apiKey');
const tempInput = document.getElementById('temp');

let drawing = false;
let currentStroke = [];
let strokes = [];

ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.lineWidth = 6;
ctx.strokeStyle = '#000';

function resizeCanvas(){
  // fixed size for prototype
}

canvas.addEventListener('pointerdown', (e)=>{
  drawing = true; currentStroke = [];
  const p = getPos(e); currentStroke.push(p);
  ctx.beginPath(); ctx.moveTo(p.x,p.y);
});
canvas.addEventListener('pointermove', (e)=>{
  if(!drawing) return; const p = getPos(e); currentStroke.push(p);
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

clearBtn.addEventListener('click', ()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); strokes=[]; songResult.textContent='—'; message.textContent='Draw on the canvas, then press the wheel center to submit.'});

submitBtn.addEventListener('click', async ()=>{
  message.textContent = 'Processing...';
  const features = extractFeatures();
  const temp = parseFloat(tempInput.value);
  let emotion = null;
  const apiKey = apiKeyInput.value.trim();
  if(apiKey){
    try{
      emotion = await callAnthropic(apiKey, features, temp);
    }catch(err){
      console.warn('Anthropic call failed, using local heuristic', err);
      emotion = heuristicEmotion(features);
    }
  }else{
    emotion = heuristicEmotion(features);
  }

  const songs = await fetch('songs.json').then(r=>r.json());
  const pick = pickSongFromSongs(songs, emotion.label, temp);
  songResult.innerHTML = pick ? `${pick.title} — ${pick.artist}` : 'No match found';
  message.textContent = `Detected: ${emotion.label} (${Math.round((emotion.score||0)*100)}%)`;
});

function extractFeatures(){
  // compute simple descriptors from strokes and pixels
  const strokeCount = strokes.length;
  let totalLen = 0;
  strokes.forEach(s=>{ for(let i=1;i<s.length;i++){ const dx=s[i].x-s[i-1].x, dy=s[i].y-s[i-1].y; totalLen+=Math.hypot(dx,dy); }});
  const avgLen = strokeCount? totalLen/strokeCount:0;

  // filled ratio sampling
  const img = ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let black=0, total=0;
  for(let i=0;i<img.length;i+=4){ total++; const r=img[i], g=img[i+1], b=img[i+2]; if(r<50 && g<50 && b<50) black++; }
  const fillRatio = black/total;

  // bounding box
  let minX=9999,minY=9999,maxX=0,maxY=0; if(strokeCount===0){ minX=0;minY=0;maxX=0;maxY=0; }
  strokes.forEach(s=>s.forEach(p=>{ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y;}));
  const bboxArea = (maxX-minX)*(maxY-minY);
  const canvasArea = canvas.width*canvas.height;
  const bboxRatio = canvasArea? Math.max(0,Math.min(1,bboxArea/canvasArea)) : 0;

  return {strokeCount, totalLen, avgLen, fillRatio, bboxRatio};
}

function heuristicEmotion(f){
  // simple rule-based fallback mapping
  const {strokeCount, avgLen, fillRatio, bboxRatio} = f;
  // energetic: many strokes or long strokes and high fill
  if(strokeCount>10 || avgLen>140 || fillRatio>0.06) return {label:'energetic',score:0.7};
  // calm: few strokes, small bbox
  if(strokeCount<=3 && bboxRatio<0.08) return {label:'calm',score:0.7};
  // sad: low fill, medium strokes
  if(fillRatio<0.01) return {label:'sad',score:0.6};
  return {label:'happy',score:0.6};
}

async function callAnthropic(key, features, temp){
  // Compose prompt describing drawing features. Ask Anthropic to return JSON with label in {sad,happy,energetic,calm}
  const prompt = `You are given a short numeric description of a user's black-on-white drawing: ${JSON.stringify(features)}. Based only on shapes and overall mood (do not consider colors or text), choose one label from: sad, happy, energetic, calm. Return a single-line JSON object like {"label":"happy","score":0.78,"keywords":["..." ]}.`;

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
  if(Math.random() < Math.max(0.2, 1-temp)){
    // biased pick: same-label
    return same[Math.floor(Math.random()*same.length)];
  }
  // more random: pick from full set but favor same-label
  const pool = [];
  songs.forEach(s=>{
    const weight = s.label===label? 0.7 : 0.3; // small bias
    const copies = Math.max(1, Math.round(weight*10));
    for(let i=0;i<copies;i++) pool.push(s);
  });
  return pool[Math.floor(Math.random()*pool.length)];
}

// initial canvas background
ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
