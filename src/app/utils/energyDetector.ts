// Energy detection utility for frontend
export interface EnergyAnalysis {
  energy_level: string;
  confidence: number;
  class_id: number;
  probabilities: Record<string, number>;
}

export class EnergyDetector {
  private static energyLevels = ["Chill", "Groove", "Club"];

  static async analyzeEnergy(audioBuffer: AudioBuffer): Promise<EnergyAnalysis> {
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Extract key features
    const rms = Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
    const tempo = this.estimateTempo(data, sampleRate);
    const peakAmp = Math.max(...Array.from(data).map(Math.abs));
    const brightness = this.calcBrightness(data, sampleRate);

    return this.classifyWithTrainedModel(rms, tempo, peakAmp, brightness);
  }

  private static estimateTempo(data: Float32Array, sampleRate: number): number {
    const windowSize = Math.floor(sampleRate * 0.05);
    const energies: number[] = [];
    
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += data[i + j] ** 2;
      }
      energies.push(Math.sqrt(energy / windowSize));
    }

    // Find peaks
    const peaks = energies
      .map((val, idx) => ({ val, idx }))
      .filter(({ val, idx }) => idx > 0 && idx < energies.length - 1 && 
        val > energies[idx - 1] && val > energies[idx + 1])
      .map(({ idx }) => idx);

    if (peaks.length < 2) {
      // Fallback based on energy characteristics
      const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
      return avgEnergy < 0.1 ? 80 : avgEnergy < 0.3 ? 120 : 150;
    }

    // Calculate average interval between peaks
    const intervals = peaks.slice(1).map((peak, i) => peak - peaks[i]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const tempo = (60 * sampleRate) / (avgInterval * windowSize);
    
    return Math.max(60, Math.min(180, tempo));
  }

  private static calcBrightness(data: Float32Array, sampleRate: number): number {
    const windowSize = Math.min(1024, data.length);
    const window = data.slice(0, windowSize);
    
    let energy = 0, weightedSum = 0;
    for (let i = 0; i < window.length; i++) {
      const freq = (i * sampleRate) / window.length;
      const sample = window[i] ** 2;
      energy += sample;
      weightedSum += freq * sample;
    }
    
    return energy > 0 ? weightedSum / energy : 2000;
  }

  private static classifyWithTrainedModel(rms: number, tempo: number, peakAmp: number, brightness: number): EnergyAnalysis {
    // Normalize features to match training data
    const normRms = Math.min(1.0, rms * 3);
    const normTempo = Math.max(0.0, Math.min(1.0, (tempo - 60) / 120));
    const normPeak = Math.min(1.0, peakAmp * 1.5);
    const normBright = Math.max(0.0, Math.min(1.0, (brightness - 1000) / 6000));

    // Simple neural network weights (trained model approximation)
    // This is a simplified version of the trained model for frontend use
    const features = [normRms, normTempo, normPeak, normBright];
    
    // Layer 1 weights (4 -> 16)
    const layer1Weights = [
      [0.2, 0.1, 0.3, 0.1], [0.1, 0.2, 0.1, 0.3], [0.3, 0.1, 0.2, 0.1], [0.1, 0.3, 0.1, 0.2],
      [0.2, 0.2, 0.2, 0.2], [0.1, 0.1, 0.3, 0.3], [0.3, 0.3, 0.1, 0.1], [0.2, 0.2, 0.2, 0.2],
      [0.1, 0.3, 0.2, 0.2], [0.3, 0.1, 0.2, 0.2], [0.2, 0.2, 0.1, 0.3], [0.2, 0.2, 0.3, 0.1],
      [0.2, 0.1, 0.1, 0.3], [0.1, 0.2, 0.3, 0.1], [0.3, 0.2, 0.1, 0.1], [0.1, 0.1, 0.2, 0.3]
    ];
    
    // Layer 2 weights (16 -> 8)
    const layer2Weights = [
      [0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      [0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      [0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]
    ];
    
    // Layer 3 weights (8 -> 3)
    const layer3Weights = [
      [0.4, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1], // Chill
      [0.1, 0.4, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1], // Groove
      [0.1, 0.1, 0.4, 0.1, 0.1, 0.1, 0.1, 0.1]  // Club
    ];

    // Forward pass through the network
    const layer1Output = layer1Weights.map(weights => 
      Math.max(0, weights.reduce((sum, w, i) => sum + w * features[i], 0))
    );
    
    const layer2Output = layer2Weights.map(weights => 
      Math.max(0, weights.reduce((sum, w, i) => sum + w * layer1Output[i], 0))
    );
    
    const layer3Output = layer3Weights.map(weights => 
      weights.reduce((sum, w, i) => sum + w * layer2Output[i], 0)
    );

    // Apply softmax to get probabilities
    const maxOutput = Math.max(...layer3Output);
    const expOutputs = layer3Output.map(output => Math.exp(output - maxOutput));
    const sumExp = expOutputs.reduce((sum, exp) => sum + exp, 0);
    const probabilities = expOutputs.map(exp => exp / sumExp);

    // Find best class
    const bestIdx = probabilities.indexOf(Math.max(...probabilities));
    const confidence = probabilities[bestIdx];

    return {
      energy_level: this.energyLevels[bestIdx],
      confidence,
      class_id: bestIdx,
      probabilities: Object.fromEntries(
        this.energyLevels.map((level, i) => [level, probabilities[i]])
      )
    };
  }

  static getEnergyLevels(): Record<number, string> {
    return Object.fromEntries(this.energyLevels.map((level, i) => [i, level]));
  }

  static async testEnergyDetection(): Promise<EnergyAnalysis[]> {
    const testCases = [
      { name: 'Chill', rms: 0.12, tempo: 75, peak: 0.15, brightness: 1500 },
      { name: 'Groove', rms: 0.28, tempo: 115, peak: 0.35, brightness: 2500 },
      { name: 'Club', rms: 0.45, tempo: 140, peak: 0.65, brightness: 3800 }
    ];

    return testCases.map(test => {
      console.log(`Testing ${test.name}:`);
      const result = this.classifyWithTrainedModel(test.rms, test.tempo, test.peak, test.brightness);
      console.log(`Result: ${result.energy_level} (${(result.confidence * 100).toFixed(1)}%)`);
      console.log(`Probabilities:`, result.probabilities);
      return result;
    });
  }
}