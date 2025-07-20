import os
import numpy as np
from pathlib import Path
import soundfile as sf

class SimpleDataCollector:
    def __init__(self, data_dir="music_data"):
        self.data_dir = Path(data_dir)
        # Only 3 energy levels to match frontend
        self.genres = {"chill": 0, "groove": 1, "club": 2}
        self.setup_directories()
    
    def setup_directories(self):
        for genre in self.genres.keys():
            (self.data_dir / genre).mkdir(parents=True, exist_ok=True)
    
    def generate_training_data(self, samples_per_genre=30):
        print("Generating synthetic audio data for training...")
        
        for genre, label in self.genres.items():
            print(f"Generating {samples_per_genre} samples for {genre}...")
            for i in range(samples_per_genre):
                filepath = self.data_dir / genre / f"{genre}_sample_{i+1}.wav"
                self.create_sample(filepath, genre, i)
                print(f"Created: {filepath}")
        
        print("Audio data generation completed!")
    
    def create_sample(self, filepath, genre, index):
        sr = 22050
        duration = 10  # 10 second samples
        t = np.linspace(0, duration, int(sr * duration))
        
        # Genre-specific parameters
        if genre == "chill":
            base_freq = 150 + index * 5
            tempo_hz = 1.2 + (index % 3) * 0.2  # 72-108 BPM
            amplitude = 0.08 + (index % 4) * 0.02
            # Chill: low energy, slow tempo, soft sounds
            signal = amplitude * np.sin(2 * np.pi * base_freq * t) * np.exp(-0.1 * t)
            signal += 0.3 * amplitude * np.sin(2 * np.pi * (base_freq * 1.5) * t) * np.exp(-0.15 * t)
            
        elif genre == "groove":
            base_freq = 200 + index * 8
            tempo_hz = 2.0 + (index % 4) * 0.3  # 120-180 BPM
            amplitude = 0.15 + (index % 5) * 0.03
            # Groove: medium energy, medium tempo, rhythmic
            signal = amplitude * np.sin(2 * np.pi * base_freq * t)
            signal += 0.4 * amplitude * np.sin(2 * np.pi * (base_freq * 0.75) * t)
            signal += 0.2 * amplitude * np.sin(2 * np.pi * (base_freq * 1.25) * t)
            
        else:  # club
            base_freq = 250 + index * 10
            tempo_hz = 2.5 + (index % 5) * 0.4  # 150-220 BPM
            amplitude = 0.25 + (index % 6) * 0.04
            # Club: high energy, fast tempo, intense
            signal = amplitude * np.sin(2 * np.pi * base_freq * t)
            signal += 0.5 * amplitude * np.sin(2 * np.pi * (base_freq * 0.5) * t)
            signal += 0.3 * amplitude * np.sin(2 * np.pi * (base_freq * 2) * t)
            signal += 0.1 * amplitude * np.sin(2 * np.pi * (base_freq * 3) * t)
        
        # Add some variation and noise
        noise = np.random.normal(0, 0.01, len(signal))
        signal += noise
        
        # Normalize
        signal = signal / np.max(np.abs(signal)) * 0.8
        
        # Save the audio file
        sf.write(filepath, signal, sr)
    
    def get_file_paths_and_labels(self):
        file_paths = []
        labels = []
        
        for genre, label in self.genres.items():
            genre_dir = self.data_dir / genre
            if genre_dir.exists():
                for file_path in genre_dir.glob("*.wav"):
                    file_paths.append(str(file_path))
                    labels.append(label)
        
        return file_paths, labels 