import torch
import torch.nn as nn
import torch.optim as optim
import torchaudio
import numpy as np
import librosa
from torch.utils.data import DataLoader, Dataset, random_split
from sklearn.metrics import accuracy_score, classification_report
import matplotlib.pyplot as plt
from data_collector import MusicDataCollector

class EnhancedEnergyDetectionModel(nn.Module):
    def __init__(self, input_size, num_classes):
        super(EnhancedEnergyDetectionModel, self).__init__()
        self.fc1 = nn.Linear(input_size, 256)
        self.dropout1 = nn.Dropout(0.3)
        self.fc2 = nn.Linear(256, 128)
        self.dropout2 = nn.Dropout(0.3)
        self.fc3 = nn.Linear(128, 64)
        self.fc4 = nn.Linear(64, num_classes)
        self.relu = nn.ReLU()
        self.batch_norm1 = nn.BatchNorm1d(256)
        self.batch_norm2 = nn.BatchNorm1d(128)
        self.batch_norm3 = nn.BatchNorm1d(64)

    def forward(self, x):
        x = self.fc1(x)
        x = self.batch_norm1(x)
        x = self.relu(x)
        x = self.dropout1(x)
        
        x = self.fc2(x)
        x = self.batch_norm2(x)
        x = self.relu(x)
        x = self.dropout2(x)
        
        x = self.fc3(x)
        x = self.batch_norm3(x)
        x = self.relu(x)
        
        x = self.fc4(x)
        return x

class AudioDataset(Dataset):
    def __init__(self, file_paths, labels):
        self.file_paths = file_paths
        self.labels = labels

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        audio_path = self.file_paths[idx]
        features = extract_audio_features(audio_path)
        label = torch.tensor(self.labels[idx], dtype=torch.long)
        return features, label

def extract_audio_features(audio_path):
    """Extract comprehensive audio features for energy detection"""
    try:
        # Load audio file
        y, sr = librosa.load(audio_path, sr=22050)
        
        # Extract various features
        features = []
        
        # 1. MFCCs (Mel-frequency cepstral coefficients) - 13 features
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        features.extend(np.mean(mfccs, axis=1))
        
        # 2. Spectral features - 2 features
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        features.append(np.mean(spectral_centroids))
        features.append(np.std(spectral_centroids))
        
        # 3. Spectral rolloff - 2 features
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        features.append(np.mean(spectral_rolloff))
        features.append(np.std(spectral_rolloff))
        
        # 4. Zero crossing rate - 2 features
        zero_crossing_rate = librosa.feature.zero_crossing_rate(y)[0]
        features.append(np.mean(zero_crossing_rate))
        features.append(np.std(zero_crossing_rate))
        
        # 5. Tempo - 1 feature
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        features.append(tempo)
        
        # 6. RMS energy - 2 features
        rms = librosa.feature.rms(y=y)[0]
        features.append(np.mean(rms))
        features.append(np.std(rms))
        
        # 7. Spectral bandwidth - 2 features
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        features.append(np.mean(spectral_bandwidth))
        features.append(np.std(spectral_bandwidth))
        
        # 8. Spectral contrast - 1 feature
        spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
        features.append(np.mean(spectral_contrast))
        
        # Ensure we have exactly 25 features
        features = features[:25]  # Truncate if too many
        while len(features) < 25:  # Pad if too few
            features.append(0.0)
        
        # Convert to tensor
        features = torch.tensor(features, dtype=torch.float32)
        
        # Handle NaN values
        features = torch.nan_to_num(features, nan=0.0)
        
        return features
        
    except Exception as e:
        print(f"Error extracting features from {audio_path}: {e}")
        # Return zero features if extraction fails
        return torch.zeros(25, dtype=torch.float32)

class EnergyTrainer:
    def __init__(self, model, train_loader, val_loader, criterion, optimizer, device):
        self.model = model
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.criterion = criterion
        self.optimizer = optimizer
        self.device = device
        self.train_losses = []
        self.val_losses = []
        self.train_accuracies = []
        self.val_accuracies = []

    def train_epoch(self):
        self.model.train()
        total_loss = 0
        correct = 0
        total = 0
        
        for batch_idx, (data, target) in enumerate(self.train_loader):
            data, target = data.to(self.device), target.to(self.device)
            
            self.optimizer.zero_grad()
            output = self.model(data)
            loss = self.criterion(output, target)
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
            pred = output.argmax(dim=1, keepdim=True)
            correct += pred.eq(target.view_as(pred)).sum().item()
            total += target.size(0)
        
        accuracy = 100. * correct / total
        avg_loss = total_loss / len(self.train_loader)
        
        return avg_loss, accuracy

    def validate(self):
        self.model.eval()
        total_loss = 0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for data, target in self.val_loader:
                data, target = data.to(self.device), target.to(self.device)
                output = self.model(data)
                loss = self.criterion(output, target)
                
                total_loss += loss.item()
                pred = output.argmax(dim=1, keepdim=True)
                correct += pred.eq(target.view_as(pred)).sum().item()
                total += target.size(0)
        
        accuracy = 100. * correct / total
        avg_loss = total_loss / len(self.val_loader)
        
        return avg_loss, accuracy

    def train(self, num_epochs=50):
        best_val_accuracy = 0
        
        for epoch in range(num_epochs):
            train_loss, train_acc = self.train_epoch()
            val_loss, val_acc = self.validate()
            
            self.train_losses.append(train_loss)
            self.val_losses.append(val_loss)
            self.train_accuracies.append(train_acc)
            self.val_accuracies.append(val_acc)
            
            print(f'Epoch [{epoch+1}/{num_epochs}]')
            print(f'Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}%')
            print(f'Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%')
            print('-' * 50)
            
            # Save best model
            if val_acc > best_val_accuracy:
                best_val_accuracy = val_acc
                torch.save(self.model.state_dict(), 'best_energy_model.pth')
                print(f'New best model saved with validation accuracy: {val_acc:.2f}%')

    def plot_training_history(self):
        plt.figure(figsize=(12, 4))
        
        plt.subplot(1, 2, 1)
        plt.plot(self.train_losses, label='Train Loss')
        plt.plot(self.val_losses, label='Validation Loss')
        plt.title('Training and Validation Loss')
        plt.xlabel('Epoch')
        plt.ylabel('Loss')
        plt.legend()
        
        plt.subplot(1, 2, 2)
        plt.plot(self.train_accuracies, label='Train Accuracy')
        plt.plot(self.val_accuracies, label='Validation Accuracy')
        plt.title('Training and Validation Accuracy')
        plt.xlabel('Epoch')
        plt.ylabel('Accuracy (%)')
        plt.legend()
        
        plt.tight_layout()
        plt.savefig('training_history.png')
        plt.show()

def main():
    # Set device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Collect data
    collector = MusicDataCollector()
    collector.generate_training_data(samples_per_genre=25)  # Generate 25 samples per genre
    file_paths, labels = collector.get_file_paths_and_labels()
    
    if len(file_paths) == 0:
        print("No audio files found. Please ensure data collection is working properly.")
        return
    
    print(f"Collected {len(file_paths)} audio files")
    
    # Create dataset
    dataset = AudioDataset(file_paths, labels)
    
    # Split dataset
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)
    
    # Initialize model
    input_size = 25  # Number of features extracted
    num_classes = 5  # Number of energy levels
    model = EnhancedEnergyDetectionModel(input_size, num_classes).to(device)
    
    # Loss and optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)
    
    # Create trainer
    trainer = EnergyTrainer(model, train_loader, val_loader, criterion, optimizer, device)
    
    # Train model
    trainer.train(num_epochs=50)
    
    # Plot training history
    trainer.plot_training_history()
    
    print("Training completed!")

if __name__ == "__main__":
    main() 