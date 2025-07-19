import os
import sys
from pathlib import Path

def main():
    print("DJMoody Energy Detection Model Training Pipeline")
    print("=" * 50)
    
    # Check if we're in the right directory
    current_dir = Path(__file__).parent
    os.chdir(current_dir)
    
    print("Working directory:", current_dir)
    
    # Step 1: Collect data
    print("\nStep 1: Collecting and organizing music data...")
    try:
        from data_collector import MusicDataCollector
        collector = MusicDataCollector()
        collector.generate_training_data(samples_per_genre=25)  # Generate 25 samples per genre
        file_paths, labels = collector.get_file_paths_and_labels()
        
        if len(file_paths) == 0:
            print("No audio files found. Please check the data collection process.")
            return
        
        print(f"Collected {len(file_paths)} audio files")
        
    except Exception as e:
        print(f"Error in data collection: {e}")
        return
    
    # Step 2: Train the model
    print("\nStep 2: Training the energy detection model...")
    try:
        from enhanced_trainer import main as train_main
        train_main()
        print("Model training completed successfully!")
        
    except Exception as e:
        print(f"Error in model training: {e}")
        return
    
    # Step 3: Test the prediction service
    print("\nStep 3: Testing the prediction service...")
    try:
        from prediction_service import EnergyPredictionService
        
        service = EnergyPredictionService()
        if service.model is not None:
            print("Prediction service initialized successfully!")
            print("Available energy levels:")
            for level_id, level_name in service.energy_levels.items():
                print(f"  {level_id}: {level_name}")
        else:
            print("Failed to load the trained model")
            
    except Exception as e:
        print(f"Error in prediction service: {e}")
        return
    
    print("\nTraining pipeline completed successfully!")
    print("\nNext steps:")
    print("1. The trained model is saved as 'best_energy_model.pth'")
    print("2. Use the EnergyPredictionService to make predictions on new audio")
    print("3. Integrate the prediction service with your frontend application")


if __name__ == "__main__":
    main() 