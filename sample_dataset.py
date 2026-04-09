#!/usr/bin/env python3
"""
Load Moodify Kaggle dataset and export a sampled subset as JSON.

Usage:
  python3 sample_dataset.py --input path/to/dataset.csv --output songs.json --limit 500

The input CSV should have columns: track_name, artist_name, emotion (or label)
The emotion labels should be: sad (0), happy (1), energetic (2), calm (3)
"""

import json
import argparse
import pandas as pd
from pathlib import Path

# Map emotion integers to labels
EMOTION_MAP = {
    0: 'sad',
    1: 'happy',
    2: 'energetic',
    3: 'calm'
}

def sample_dataset(input_file, output_file, limit=500, seed=42):
    """Load CSV, sample, and export as JSON."""
    print(f"Loading dataset from {input_file}...")
    
    # Try common column names
    df = pd.read_csv(input_file)
    print(f"Loaded {len(df)} rows")
    
    # Identify columns (adjust based on your dataset structure)
    title_col = next((c for c in df.columns if 'track' in c.lower() or 'name' in c.lower()), None)
    artist_col = next((c for c in df.columns if 'artist' in c.lower()), None)
    emotion_col = next((c for c in df.columns if 'emotion' in c.lower() or 'label' in c.lower()), None)
    
    if not all([title_col, artist_col, emotion_col]):
        print(f"Error: Could not identify columns.")
        print(f"Available columns: {df.columns.tolist()}")
        print(f"Found: title={title_col}, artist={artist_col}, emotion={emotion_col}")
        return False
    
    print(f"Using columns: {title_col}, {artist_col}, {emotion_col}")
    
    # Clean: drop nulls, drop duplicates by title
    df = df[[title_col, artist_col, emotion_col]].dropna()
    df = df.drop_duplicates(subset=[title_col])
    
    # Sample
    df = df.sample(n=min(limit, len(df)), random_state=seed)
    print(f"Sampled {len(df)} rows")
    
    # Convert to list of dicts
    songs = []
    for _, row in df.iterrows():
        emotion = row[emotion_col]
        # Convert int to label if needed
        if isinstance(emotion, (int, float)):
            emotion = EMOTION_MAP.get(int(emotion), 'calm')
        
        songs.append({
            'title': str(row[title_col]).strip(),
            'artist': str(row[artist_col]).strip(),
            'label': emotion.lower().strip()
        })
    
    # Write JSON
    with open(output_file, 'w') as f:
        json.dump(songs, f, indent=2)
    
    print(f"✅ Exported {len(songs)} songs to {output_file}")
    
    # Print sample
    print("\nSample songs:")
    for song in songs[:5]:
        print(f"  {song['title']} — {song['artist']} ({song['label']})")
    
    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Sample Moodify dataset.')
    parser.add_argument('--input', required=True, help='Path to input CSV file')
    parser.add_argument('--output', default='songs.json', help='Output JSON file')
    parser.add_argument('--limit', type=int, default=500, help='Number of songs to sample')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    
    args = parser.parse_args()
    
    success = sample_dataset(args.input, args.output, args.limit, args.seed)
    exit(0 if success else 1)
