import os
import sys
from pathlib import Path

def main():
    print("DJMoody Simple Energy Detection Model Training Pipeline")
    print("=" * 60)
    
    # Check if we're in the right directory
    current_dir = Path(__file__).parent
    os.chdir(current_dir)
    
    print("Working directory:", current_dir)
    
    # Step 1: Collect data
    print("\nStep 1: Collecting and organizing music data...")
    try:
        from simple_data_collector import SimpleDataCollector
        collector = SimpleDataCollector()
        collector.generate_training_data(samples_per_genre=25)  # Generate 25 samples per genre
        file_paths, labels = collector.get_file_paths_and_labels()
        
        if len(file_paths) == 0:
            print("No audio files found. Please check the data collection process.")
            return
        
        print(f"Collected {len(file_paths)} audio files")
        print("Energy levels: Chill (0), Groove (1), Club (2)")
        
    except Exception as e:
        print(f"Error in data collection: {e}")
        return
    
    # Step 2: Train the model
    print("\nStep 2: Training the energy detection model...")
    try:
        from simple_trainer import main as train_main
        train_main()
        print("Model training completed successfully!")
        
    except Exception as e:
        print(f"Error in model training: {e}")
        return
    
    # Step 3: Test the model
    print("\nStep 3: Testing the trained model...")
    try:
        from simple_trainer import SimpleEnergyModel, extract_features_like_frontend
        import torch
        
        # Load the trained model
        model = SimpleEnergyModel(input_size=4, num_classes=3)
        model.load_state_dict(torch.load('best_energy_model.pth', map_location='cpu'))
        model.eval()
        
        print("Model loaded successfully!")
        print("Available energy levels:")
        energy_levels = ["Chill", "Groove", "Club"]
        for i, level in enumerate(energy_levels):
            print(f"  {i}: {level}")
        
        # Test with a few samples
        print("\nTesting model predictions...")
        test_files = file_paths[:3]  # Test first 3 files
        
        for i, file_path in enumerate(test_files):
            features = extract_features_like_frontend(file_path)
            with torch.no_grad():
                output = model(features.unsqueeze(0))
                probabilities = torch.softmax(output, dim=1)[0]
                predicted_class = torch.argmax(output, dim=1).item()
                confidence = torch.max(probabilities).item()
            
            filename = Path(file_path).name
            true_label = labels[i]
            print(f"File: {filename}")
            print(f"  True: {energy_levels[true_label]}")
            print(f"  Predicted: {energy_levels[predicted_class]} ({confidence:.2f})")
            print(f"  Probabilities: {[f'{p:.2f}' for p in probabilities]}")
            print()
            
    except Exception as e:
        print(f"Error in model testing: {e}")
        return
    
    print("\nTraining pipeline completed successfully!")
    print("\nNext steps:")
    print("1. The trained model is saved as 'best_energy_model.pth'")
    print("2. The model works with 3 energy levels: Chill, Groove, Club")
    print("3. Feature extraction matches the frontend implementation")
    print("4. You can now integrate this model with your frontend application")


if __name__ == "__main__":
    main() 