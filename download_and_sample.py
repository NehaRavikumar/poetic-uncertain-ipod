#!/usr/bin/env python3
"""
Download Moodify dataset from Kaggle Hub and export a sampled subset as JSON.

First, install dependencies:
  pip install kagglehub pandas

Then run:
  python3 download_and_sample.py --limit 1000

This will:
1. Download the Moodify dataset from Kaggle
2. Find the CSV file in the downloaded directory
3. Sample N songs (default 1000)
4. Export as songs.json
"""

import json
import argparse
import pandas as pd
from pathlib import Path

def find_csv(directory):
    """Find the first CSV file in the directory."""
    for f in Path(directory).glob('**/*.csv'):
        return str(f)
    raise FileNotFoundError("No CSV file found in dataset directory")

def download_and_sample(limit=1000, seed=42):
    """Download dataset and sample it."""
    try:
        import kagglehub
    except ImportError:
        print("❌ kagglehub not installed. Install with:")
        print("  pip install kagglehub")
        return False
    
    # Emotion map
    EMOTION_MAP = {
        0: 'sad',
        1: 'happy',
        2: 'energetic',
        3: 'calm'
    }
    
    print("📥 Downloading Moodify dataset from Kaggle...")
    try:
        path = kagglehub.dataset_download("abdullahorzan/moodify-dataset")
        print(f"✅ Downloaded to: {path}")
    except Exception as e:
        print(f"❌ Download failed: {e}")
        print("   Make sure you have Kaggle API credentials set up.")
        print("   See: https://www.kaggle.com/settings/account")
        return False
    
    # Find CSV
    try:
        csv_file = find_csv(path)
        print(f"📄 Found CSV: {csv_file}")
    except FileNotFoundError as e:
        print(f"❌ {e}")
        return False
    
    print(f"Loading dataset...")
    df = pd.read_csv(csv_file)
    print(f"Loaded {len(df)} rows")
    
    # Identify columns
    title_col = next((c for c in df.columns if 'track' in c.lower() or 'name' in c.lower()), None)
    artist_col = next((c for c in df.columns if 'artist' in c.lower()), None)
    emotion_col = next((c for c in df.columns if 'emotion' in c.lower() or 'label' in c.lower()), None)
    
    if not all([title_col, artist_col, emotion_col]):
        print(f"⚠️  Could not identify all columns automatically.")
        print(f"Available columns: {df.columns.tolist()}")
        print(f"Found: title={title_col}, artist={artist_col}, emotion={emotion_col}")
        return False
    
    print(f"Using columns: {title_col}, {artist_col}, {emotion_col}")
    
    # Clean
    df = df[[title_col, artist_col, emotion_col]].dropna()
    df = df.drop_duplicates(subset=[title_col])
    print(f"After deduplication: {len(df)} rows")
    
    # Sample
    df = df.sample(n=min(limit, len(df)), random_state=seed)
    print(f"Sampled {len(df)} rows")
    
    # Convert
    songs = []
    for _, row in df.iterrows():
        emotion = row[emotion_col]
        # Convert int to label
        if isinstance(emotion, (int, float)):
            emotion = EMOTION_MAP.get(int(emotion), 'calm')
        
        songs.append({
            'title': str(row[title_col]).strip(),
            'artist': str(row[artist_col]).strip(),
            'label': emotion.lower().strip()
        })
    
    # Write
    output_file = 'songs.json'
    with open(output_file, 'w') as f:
        json.dump(songs, f, indent=2)
    
    print(f"✅ Exported {len(songs)} songs to {output_file}")
    
    # Stats
    from collections import Counter
    label_counts = Counter(s['label'] for s in songs)
    print(f"\nEmotions distribution:")
    for label, count in sorted(label_counts.items()):
        print(f"  {label}: {count}")
    
    print(f"\nSample songs:")
    for song in songs[:5]:
        print(f"  {song['title']} — {song['artist']} ({song['label']})")
    
    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download and sample Moodify dataset.')
    parser.add_argument('--limit', type=int, default=1000, help='Number of songs to sample')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    
    args = parser.parse_args()
    
    success = download_and_sample(args.limit, args.seed)
    exit(0 if success else 1)
