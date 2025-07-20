import os
import numpy as np
from pathlib import Path
import soundfile as sf
import random

class EnhancedMusicDataCollector:
    def __init__(self, data_dir="music_data"):
        self.data_dir = Path(data_dir)
        self.genres = {
            "chill": 0,      # Chill vibe - low energy, slow tempo
            "groove": 1,     # Medium energy - balanced
            "club": 2        # Club rager - high energy, fast tempo
        }
        self.setup_directories()
    
    def setup_directories(self):
        """Create directory structure for different energy levels"""
        for genre in self.genres.keys():
            genre_dir = self.data_dir / genre
            genre_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_training_data(self, samples_per_genre=50):
        """Generate synthetic audio samples for each energy level with enhanced diversity"""
        print("Generating enhanced synthetic audio data for training...")
        
        for genre, label in self.genres.items():
            genre_dir = self.data_dir / genre
            print(f"Generating {samples_per_genre} samples for {genre}...")
            
            for i in range(samples_per_genre):
                # Create varied samples within each genre with more realistic characteristics
                self.create_enhanced_sample_audio(genre_dir / f"{genre}_sample_{i+1}.wav", genre, i)
        
        print("Enhanced audio data generation completed!")
    
    def create_enhanced_sample_audio(self, filepath, genre, sample_index):
        """Create enhanced sample audio files with realistic characteristics for each genre"""
        sample_rate = 22050
        duration = 30  # 30 seconds
        
        # Enhanced base characteristics for each genre with more variation
        if genre == "chill":
            # Chill: Low tempo (60-90 BPM), soft sounds, ambient, minimal percussion
            base_freq = 200 + sample_index * 8  # Lower frequencies
            tempo_factor = 0.4 + (sample_index % 5) * 0.1  # 60-90 BPM variation
            amplitude = 0.15 + (sample_index % 3) * 0.05  # Soft amplitude
            complexity = 1 + (sample_index % 2)  # Simple to moderate complexity
            has_percussion = False  # No percussion for chill
            reverb_level = 0.3 + (sample_index % 4) * 0.1  # Ambient reverb
            
        elif genre == "groove":
            # Groove: Medium tempo (100-130 BPM), rhythmic, balanced energy
            base_freq = 350 + sample_index * 12  # Medium frequencies
            tempo_factor = 0.8 + (sample_index % 6) * 0.08  # 100-130 BPM variation
            amplitude = 0.25 + (sample_index % 4) * 0.05  # Medium amplitude
            complexity = 2 + (sample_index % 3)  # Moderate complexity
            has_percussion = True  # Rhythmic percussion
            reverb_level = 0.1 + (sample_index % 3) * 0.05  # Light reverb
            
        else:  # club
            # Club: High tempo (130-160 BPM), intense, heavy percussion
            base_freq = 500 + sample_index * 15  # Higher frequencies
            tempo_factor = 1.1 + (sample_index % 7) * 0.07  # 130-160 BPM variation
            amplitude = 0.35 + (sample_index % 5) * 0.05  # High amplitude
            complexity = 3 + (sample_index % 3)  # High complexity
            has_percussion = True  # Heavy percussion
            reverb_level = 0.05 + (sample_index % 2) * 0.02  # Minimal reverb
        
        # Generate time array
        t = np.linspace(0, duration, int(sample_rate * duration))
        
        # Create base waveform with more realistic synthesis
        waveform = np.zeros_like(t)
        
        # Add multiple oscillators for richer sound
        for osc in range(1, complexity + 1):
            freq = base_freq * osc
            amp = amplitude / osc
            waveform += np.sin(2 * np.pi * freq * tempo_factor * t) * amp
            
            # Add slight detuning for realism
            if osc > 1:
                detune = 1.0 + (sample_index % 10) * 0.001
                waveform += np.sin(2 * np.pi * freq * detune * tempo_factor * t) * amp * 0.5
        
        # Add harmonics based on genre
        if genre == "chill":
            # Add soft pad-like harmonics
            for harmonic in range(2, 4):
                harmonic_freq = base_freq * harmonic
                harmonic_amp = amplitude / (harmonic * 2)
                waveform += np.sin(2 * np.pi * harmonic_freq * tempo_factor * t) * harmonic_amp
                
        elif genre == "groove":
            # Add funky harmonics
            for harmonic in range(2, 5):
                harmonic_freq = base_freq * harmonic
                harmonic_amp = amplitude / (harmonic * 1.5)
                waveform += np.sin(2 * np.pi * harmonic_freq * tempo_factor * t) * harmonic_amp
                
        else:  # club
            # Add aggressive harmonics
            for harmonic in range(2, 6):
                harmonic_freq = base_freq * harmonic
                harmonic_amp = amplitude / harmonic
                waveform += np.sin(2 * np.pi * harmonic_freq * tempo_factor * t) * harmonic_amp
        
        # Add percussion based on genre
        if has_percussion:
            if genre == "groove":
                # Funky drum pattern
                kick_freq = 60
                snare_freq = 200
                hihat_freq = 800
                
                for beat in range(0, int(duration * 2), 2):  # Every 0.5 seconds
                    # Kick on 1 and 3
                    if beat % 4 == 0:
                        beat_start = int(beat * sample_rate / 2)
                        beat_end = min(beat_start + int(0.1 * sample_rate), len(waveform))
                        if beat_end > beat_start:
                            kick = np.sin(2 * np.pi * kick_freq * np.linspace(0, 0.1, beat_end - beat_start)) * 0.15
                            waveform[beat_start:beat_end] += kick
                    
                    # Snare on 2 and 4
                    if beat % 4 == 2:
                        beat_start = int(beat * sample_rate / 2)
                        beat_end = min(beat_start + int(0.05 * sample_rate), len(waveform))
                        if beat_end > beat_start:
                            snare = np.sin(2 * np.pi * snare_freq * np.linspace(0, 0.05, beat_end - beat_start)) * 0.1
                            waveform[beat_start:beat_end] += snare
                    
                    # Hi-hat on every beat
                    beat_start = int(beat * sample_rate / 2)
                    beat_end = min(beat_start + int(0.02 * sample_rate), len(waveform))
                    if beat_end > beat_start:
                        hihat = np.sin(2 * np.pi * hihat_freq * np.linspace(0, 0.02, beat_end - beat_start)) * 0.05
                        waveform[beat_start:beat_end] += hihat
                        
            elif genre == "club":
                # Heavy club beat
                kick_freq = 50
                snare_freq = 150
                hihat_freq = 1000
                
                for beat in range(0, int(duration * 4), 1):  # Every 0.25 seconds
                    # Kick on every beat
                    beat_start = int(beat * sample_rate / 4)
                    beat_end = min(beat_start + int(0.15 * sample_rate), len(waveform))
                    if beat_end > beat_start:
                        kick = np.sin(2 * np.pi * kick_freq * np.linspace(0, 0.15, beat_end - beat_start)) * 0.2
                        waveform[beat_start:beat_end] += kick
                    
                    # Snare on 2 and 4
                    if beat % 4 == 2:
                        beat_start = int(beat * sample_rate / 4)
                        beat_end = min(beat_start + int(0.08 * sample_rate), len(waveform))
                        if beat_end > beat_start:
                            snare = np.sin(2 * np.pi * snare_freq * np.linspace(0, 0.08, beat_end - beat_start)) * 0.15
                            waveform[beat_start:beat_end] += snare
                    
                    # Hi-hat on every beat
                    beat_start = int(beat * sample_rate / 4)
                    beat_end = min(beat_start + int(0.01 * sample_rate), len(waveform))
                    if beat_end > beat_start:
                        hihat = np.sin(2 * np.pi * hihat_freq * np.linspace(0, 0.01, beat_end - beat_start)) * 0.08
                        waveform[beat_start:beat_end] += hihat
        
        # Add reverb effect
        if reverb_level > 0:
            reverb_delay = int(0.1 * sample_rate)  # 100ms delay
            reverb_samples = int(0.3 * sample_rate)  # 300ms decay
            reverb = np.zeros_like(waveform)
            
            for i in range(reverb_samples):
                if i + reverb_delay < len(waveform):
                    reverb[i + reverb_delay] = waveform[i] * reverb_level * np.exp(-i / reverb_samples)
            
            waveform += reverb
        
        # Add some noise for realism
        noise_level = 0.005 + (sample_index % 5) * 0.002
        waveform += np.random.normal(0, noise_level, len(waveform))
        
        # Add subtle frequency modulation for more realism
        fm_depth = 0.01 + (sample_index % 3) * 0.005
        fm_freq = 0.5 + (sample_index % 2) * 0.3
        fm_mod = np.sin(2 * np.pi * fm_freq * t) * fm_depth
        waveform *= (1 + fm_mod)
        
        # Normalize and apply genre-specific compression
        waveform = waveform / np.max(np.abs(waveform)) * 0.8
        
        # Apply genre-specific effects
        if genre == "chill":
            # Soft compression for chill
            waveform = np.tanh(waveform * 0.8)
        elif genre == "groove":
            # Moderate compression for groove
            waveform = np.tanh(waveform * 1.2)
        else:  # club
            # Hard compression for club
            waveform = np.tanh(waveform * 1.5)
        
        # Save as WAV file
        sf.write(str(filepath), waveform, sample_rate)
        print(f"Created enhanced {genre} sample: {filepath}")
    
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
    collector = EnhancedMusicDataCollector()
    collector.generate_training_data(samples_per_genre=50)  # Generate 50 samples per genre
    
    file_paths, labels = collector.get_file_paths_and_labels()
    print(f"\nCollected {len(file_paths)} enhanced audio files")
    print("File paths and labels:")
    for path, label in zip(file_paths, labels):
        print(f"{path}: {label}") 