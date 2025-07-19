import os
import numpy as np
from pathlib import Path
import soundfile as sf

class MusicDataCollector:
    def __init__(self, data_dir="music_data"):
        self.data_dir = Path(data_dir)
        self.genres = {
            "chill": 0,      # Chill vibe
            "lounge": 1,     # Relaxed atmosphere
            "groove": 2,     # Medium energy
            "party": 3,      # High energy
            "club": 4        # Club rager
        }
        self.setup_directories()
    
    def setup_directories(self):
        """Create directory structure for different energy levels"""
        for genre in self.genres.keys():
            genre_dir = self.data_dir / genre
            genre_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_training_data(self, samples_per_genre=20):
        """Generate synthetic audio samples for each energy level"""
        print("Generating synthetic audio data for training...")
        
        for genre, label in self.genres.items():
            genre_dir = self.data_dir / genre
            print(f"Generating {samples_per_genre} samples for {genre}...")
            
            for i in range(samples_per_genre):
                # Create varied samples within each genre
                self.create_sample_audio(genre_dir / f"{genre}_sample_{i+1}.wav", genre, i)
        
        print("Audio data generation completed!")
    
    def create_sample_audio(self, filepath, genre, sample_index):
        """Create sample audio files with realistic characteristics for each genre"""
        sample_rate = 22050
        duration = 30  # 30 seconds
        
        # Base characteristics for each genre
        if genre == "chill":
            # Low tempo, soft sounds, ambient
            base_freq = 220 + sample_index * 10  # A3 + variation
            tempo_factor = 0.5
            amplitude = 0.2
            complexity = 1
        elif genre == "lounge":
            # Medium-low tempo, smooth
            base_freq = 330 + sample_index * 15
            tempo_factor = 0.7
            amplitude = 0.25
            complexity = 2
        elif genre == "groove":
            # Medium tempo, rhythmic
            base_freq = 440 + sample_index * 20
            tempo_factor = 1.0
            amplitude = 0.3
            complexity = 3
        elif genre == "party":
            # High tempo, energetic
            base_freq = 550 + sample_index * 25
            tempo_factor = 1.3
            amplitude = 0.35
            complexity = 4
        else:  # club
            # Very high tempo, intense
            base_freq = 660 + sample_index * 30
            tempo_factor = 1.6
            amplitude = 0.4
            complexity = 5
        
        # Generate time array
        t = np.linspace(0, duration, int(sample_rate * duration))
        
        # Create base waveform
        waveform = np.sin(2 * np.pi * base_freq * tempo_factor * t) * amplitude
        
        # Add harmonics based on complexity
        for harmonic in range(2, complexity + 2):
            harmonic_freq = base_freq * harmonic
            harmonic_amp = amplitude / harmonic
            waveform += np.sin(2 * np.pi * harmonic_freq * tempo_factor * t) * harmonic_amp
        
        # Add some rhythmic variation
        if genre in ["groove", "party", "club"]:
            # Add kick drum effect
            kick_freq = 60
            kick_pattern = np.zeros_like(t)
            for beat in range(0, int(duration * 2), 2):  # Every 0.5 seconds
                beat_start = int(beat * sample_rate / 2)
                beat_end = min(beat_start + int(0.1 * sample_rate), len(kick_pattern))
                if beat_end > beat_start:
                    kick_pattern[beat_start:beat_end] = np.sin(2 * np.pi * kick_freq * np.linspace(0, 0.1, beat_end - beat_start)) * 0.1
            waveform += kick_pattern
        
        # Add some noise for realism
        noise_level = 0.01
        waveform += np.random.normal(0, noise_level, len(waveform))
        
        # Normalize
        waveform = waveform / np.max(np.abs(waveform)) * 0.8
        
        # Save as WAV file
        sf.write(str(filepath), waveform, sample_rate)
        print(f"Created: {filepath}")
    
    def get_file_paths_and_labels(self):
        """Get all audio file paths and their corresponding labels"""
        file_paths = []
        labels = []
        
        for genre, label in self.genres.items():
            genre_dir = self.data_dir / genre
            if genre_dir.exists():
                for file_path in genre_dir.glob("*.wav"):
                    file_paths.append(str(file_path))
                    labels.append(label)
        
        return file_paths, labels

if __name__ == "__main__":
    collector = MusicDataCollector()
    collector.generate_training_data(samples_per_genre=25)  # Generate 25 samples per genre
    
    file_paths, labels = collector.get_file_paths_and_labels()
    print(f"\nCollected {len(file_paths)} audio files")
    print("File paths and labels:")
    for path, label in zip(file_paths, labels):
        print(f"{path}: {label}") 