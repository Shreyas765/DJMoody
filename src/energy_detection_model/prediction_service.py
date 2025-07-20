import torch
import numpy as np
import librosa
from simple_trainer import SimpleEnergyModel, extract_features_like_frontend

class EnergyPredictionService:
    def __init__(self, model_path='best_energy_model.pth'):
        self.model = None
        self.energy_levels = {0: "Chill", 1: "Groove", 2: "Club"}
        self.load_model(model_path)
    
    def load_model(self, model_path):
        """Load the trained model"""
        try:
            self.model = SimpleEnergyModel(input_size=4, num_classes=3)
            self.model.load_state_dict(torch.load(model_path, map_location='cpu'))
            self.model.eval()
            print(f"Model loaded successfully from {model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None
    
    def predict_from_audio_file(self, audio_path):
        """Predict energy level from an audio file"""
        if self.model is None:
            return None
        
        try:
            features = extract_features_like_frontend(audio_path)
            return self.predict_from_features(features)
        except Exception as e:
            print(f"Error predicting from audio file: {e}")
            return None
    
    def predict_from_features(self, features):
        """Predict energy level from extracted features"""
        if self.model is None:
            return None
        
        try:
            with torch.no_grad():
                output = self.model(features.unsqueeze(0))
                probabilities = torch.softmax(output, dim=1)[0]
                predicted_class = torch.argmax(output, dim=1).item()
                confidence = torch.max(probabilities).item()
            
            return {
                'energy_level': self.energy_levels[predicted_class],
                'confidence': confidence,
                'class_id': predicted_class,
                'probabilities': {
                    self.energy_levels[i]: prob.item() 
                    for i, prob in enumerate(probabilities)
                }
            }
        except Exception as e:
            print(f"Error predicting from features: {e}")
            return None
    
    def predict_from_audio_data(self, audio_data, sample_rate=22050):
        """Predict energy level from raw audio data (like frontend)"""
        if self.model is None:
            return None
        
        try:
            # Extract features like the frontend does
            features = self.extract_features_from_data(audio_data, sample_rate)
            return self.predict_from_features(features)
        except Exception as e:
            print(f"Error predicting from audio data: {e}")
            return None
    
    def extract_features_from_data(self, audio_data, sample_rate):
        """Extract features from raw audio data (matching frontend)"""
        try:
            # Convert to numpy if needed
            if hasattr(audio_data, 'numpy'):
                data = audio_data.numpy()
            else:
                data = np.array(audio_data)
            
            # 1. RMS Energy
            rms = np.sqrt(np.mean(data**2))
            
            # 2. Tempo estimation (like frontend)
            window_size = int(sample_rate * 0.05)
            energies = []
            
            for i in range(0, len(data) - window_size, window_size):
                window_energy = np.sqrt(np.mean(data[i:i+window_size]**2))
                energies.append(window_energy)
            
            # Find peaks
            peaks = []
            for i in range(1, len(energies) - 1):
                if energies[i] > energies[i-1] and energies[i] > energies[i+1]:
                    peaks.append(i)
            
            if len(peaks) < 2:
                # Fallback based on energy characteristics
                avg_energy = np.mean(energies)
                tempo = 80 if avg_energy < 0.1 else (120 if avg_energy < 0.3 else 150)
            else:
                # Calculate average interval between peaks
                intervals = [peaks[i+1] - peaks[i] for i in range(len(peaks)-1)]
                avg_interval = np.mean(intervals)
                tempo = (60 * sample_rate) / (avg_interval * window_size)
                tempo = max(60, min(180, tempo))
            
            # 3. Peak amplitude
            peak_amp = np.max(np.abs(data))
            
            # 4. Brightness (like frontend)
            window_size = min(1024, len(data))
            window = data[:window_size]
            
            energy = 0
            weighted_sum = 0
            for i in range(len(window)):
                freq = (i * sample_rate) / len(window)
                sample = window[i] ** 2
                energy += sample
                weighted_sum += freq * sample
            
            brightness = weighted_sum / energy if energy > 0 else 2000
            
            # Normalize features to match frontend scaling
            norm_rms = min(1.0, rms * 3)
            norm_tempo = max(0.0, min(1.0, (tempo - 60) / 120))
            norm_peak = min(1.0, peak_amp * 1.5)
            norm_brightness = max(0.0, min(1.0, (brightness - 1000) / 6000))
            
            features = [norm_rms, norm_tempo, norm_peak, norm_brightness]
            return torch.tensor(features, dtype=torch.float32)
            
        except Exception as e:
            print(f"Error extracting features from data: {e}")
            return torch.zeros(4, dtype=torch.float32)
    
    def test_predictions(self):
        """Test the model with sample predictions"""
        if self.model is None:
            print("No model loaded")
            return
        
        print("Testing model predictions...")
        
        # Test with synthetic features
        test_cases = [
            {"name": "Chill", "features": [0.1, 0.2, 0.15, 0.3]},
            {"name": "Groove", "features": [0.4, 0.5, 0.4, 0.5]},
            {"name": "Club", "features": [0.7, 0.8, 0.8, 0.7]}
        ]
        
        for test_case in test_cases:
            features = torch.tensor(test_case["features"], dtype=torch.float32)
            result = self.predict_from_features(features)
            if result:
                print(f"{test_case['name']}: {result['energy_level']} ({result['confidence']:.2f})")
                print(f"  Probabilities: {result['probabilities']}")

def main():
    """Test the prediction service"""
    service = EnergyPredictionService()
    service.test_predictions()

if __name__ == "__main__":
    main() 