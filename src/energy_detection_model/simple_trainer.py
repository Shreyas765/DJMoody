import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import librosa
from torch.utils.data import DataLoader, Dataset, random_split
import matplotlib.pyplot as plt
from simple_data_collector import SimpleDataCollector

class SimpleEnergyModel(nn.Module):
    def __init__(self, input_size=4, num_classes=3):
        super(SimpleEnergyModel, self).__init__()
        self.fc1 = nn.Linear(input_size, 16)
        self.fc2 = nn.Linear(16, 8)
        self.fc3 = nn.Linear(8, num_classes)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.relu(self.fc2(x))
        x = self.fc3(x)
        return x

class AudioDataset(Dataset):
    def __init__(self, file_paths, labels):
        self.file_paths = file_paths
        self.labels = labels

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        audio_path = self.file_paths[idx]
        features = extract_features_like_frontend(audio_path)
        label = torch.tensor(self.labels[idx], dtype=torch.long)
        return features, label

def extract_features_like_frontend(audio_path):
    """Extract features exactly like the frontend detector"""
    try:
        y, sr = librosa.load(audio_path, sr=22050)
        
        # 1. RMS Energy (like frontend)
        rms = np.sqrt(np.mean(y**2))
        
        # 2. Tempo estimation (like frontend)
        window_size = int(sr * 0.05)
        energies = []
        for i in range(0, len(y) - window_size, window_size):
            window_energy = np.sqrt(np.mean(y[i:i+window_size]**2))
            energies.append(window_energy)
        
        # Find peaks like frontend
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
            tempo = (60 * sr) / (avg_interval * window_size)
            tempo = max(60, min(180, tempo))
        
        # 3. Peak amplitude
        peak_amp = np.max(np.abs(y))
        
        # 4. Brightness (like frontend)
        window_size = min(1024, len(y))
        window = y[:window_size]
        
        energy = 0
        weighted_sum = 0
        for i in range(len(window)):
            freq = (i * sr) / len(window)
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
        print(f"Error extracting features from {audio_path}: {e}")
        return torch.zeros(4, dtype=torch.float32)

class SimpleEnergyTrainer:
    def __init__(self, model, train_loader, val_loader, device):
        self.model = model
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.device = device
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = optim.Adam(model.parameters(), lr=0.001)
        self.train_losses = []
        self.val_accuracies = []

    def train_epoch(self):
        self.model.train()
        total_loss = 0
        correct = 0
        total = 0
        
        for data, target in self.train_loader:
            data, target = data.to(self.device), target.to(self.device)
            
            self.optimizer.zero_grad()
            output = self.model(data)
            loss = self.criterion(output, target)
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
            pred = output.argmax(dim=1)
            correct += pred.eq(target).sum().item()
            total += target.size(0)
        
        return total_loss / len(self.train_loader), 100. * correct / total

    def validate(self):
        self.model.eval()
        correct = 0
        total = 0
        
        with torch.no_grad():
            for data, target in self.val_loader:
                data, target = data.to(self.device), target.to(self.device)
                output = self.model(data)
                pred = output.argmax(dim=1)
                correct += pred.eq(target).sum().item()
                total += target.size(0)
        
        return 100. * correct / total

    def train(self, epochs=50):
        best_acc = 0
        
        for epoch in range(epochs):
            train_loss, train_acc = self.train_epoch()
            val_acc = self.validate()
            
            self.train_losses.append(train_loss)
            self.val_accuracies.append(val_acc)
            
            print(f'Epoch [{epoch+1}/{epochs}]')
            print(f'Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.1f}%')
            print(f'Val Loss: {val_acc:.4f}, Val Acc: {val_acc:.1f}%')
            print('-' * 50)
            
            if val_acc > best_acc:
                best_acc = val_acc
                torch.save(self.model.state_dict(), 'best_energy_model.pth')
                print(f'New best model saved with validation accuracy: {val_acc:.1f}%')
        
        # Plot training history
        self.plot_training_history()

    def plot_training_history(self):
        plt.figure(figsize=(12, 4))
        
        plt.subplot(1, 2, 1)
        plt.plot(self.train_losses)
        plt.title('Training Loss')
        plt.xlabel('Epoch')
        plt.ylabel('Loss')
        
        plt.subplot(1, 2, 2)
        plt.plot(self.val_accuracies)
        plt.title('Validation Accuracy')
        plt.xlabel('Epoch')
        plt.ylabel('Accuracy (%)')
        
        plt.tight_layout()
        plt.savefig('training_history.png', dpi=300, bbox_inches='tight')
        plt.close()

def main():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Generate training data
    collector = SimpleDataCollector()
    collector.generate_training_data(samples_per_genre=25)
    file_paths, labels = collector.get_file_paths_and_labels()
    
    if len(file_paths) == 0:
        print("No audio files found!")
        return
    
    print(f"Collected {len(file_paths)} audio files")
    print(f"Label distribution: {np.bincount(labels)}")
    
    # Create dataset and split
    dataset = AudioDataset(file_paths, labels)
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=8, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=8, shuffle=False)
    
    # Create and train model
    model = SimpleEnergyModel(input_size=4, num_classes=3).to(device)
    trainer = SimpleEnergyTrainer(model, train_loader, val_loader, device)
    trainer.train(epochs=50)
    
    print("Training completed!")

if __name__ == "__main__":
    main() 