// Energy detection utility for frontend
export interface EnergyAnalysis {
  energy_level: string;
  confidence: number;
  class_id: number;
  probabilities: Record<string, number>;
}

export class EnergyDetector {
  private static energyLevels = ["Chill", "Groove", "Club Rager"];

  static async analyzeEnergy(audioBuffer: AudioBuffer): Promise<EnergyAnalysis> {
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Extract key features
    const rms = Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
    const tempo = this.estimateTempo(data, sampleRate);
    const peakAmp = Math.max(...Array.from(data).map(Math.abs));
    const brightness = this.calcBrightness(data, sampleRate);

    return this.classify(rms, tempo, peakAmp, brightness);
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

  private static classify(rms: number, tempo: number, peakAmp: number, brightness: number): EnergyAnalysis {
    // Normalize features to 0-1 with better scaling
    const normRms = Math.min(1, rms * 3); // Less aggressive RMS scaling
    const normTempo = Math.max(0, Math.min(1, (tempo - 60) / 120));
    const normPeak = Math.min(1, peakAmp * 1.5); // Scale peak amplitude
    const normBright = Math.max(0, Math.min(1, (brightness - 1000) / 6000)); // Adjusted brightness range

    // Score each class with balanced weights
    const scores = [
      // Chill: low energy, low tempo, low brightness
      (1 - normRms) * 0.5 + (1 - normTempo) * 0.3 + (1 - normBright) * 0.2,
      
      // Groove: medium energy, medium tempo, medium brightness
      (1 - Math.abs(normRms - 0.4)) * 0.4 + (1 - Math.abs(normTempo - 0.5)) * 0.4 + (1 - Math.abs(normBright - 0.5)) * 0.2,
      
      // Club Rager: high energy, high tempo, high brightness
      normRms * 0.4 + normTempo * 0.3 + normBright * 0.3
    ];

    // Apply penalties for each class based on mismatches
    // Chill penalties
    if (tempo > 120) scores[0] *= 0.4;
    if (rms > 0.4) scores[0] *= 0.3;
    if (brightness > 3500) scores[0] *= 0.5;
    
    // Groove penalties
    if (tempo < 80 || tempo > 160) scores[1] *= 0.6;
    if (rms < 0.1 || rms > 0.6) scores[1] *= 0.5;
    
    // Club Rager penalties
    if (tempo < 100) scores[2] *= 0.4;
    if (rms < 0.25) scores[2] *= 0.3;
    if (brightness < 2000) scores[2] *= 0.4;

    // Find best class
    const bestIdx = scores.indexOf(Math.max(...scores));
    
    // Convert to probabilities using softmax with lower temperature
    const expScores = scores.map(s => Math.exp(s * 3)); // Reduced from 5 to 3 for less extreme probabilities
    const expSum = expScores.reduce((a, b) => a + b, 0);
    const probabilities: Record<string, number> = {};
    
    this.energyLevels.forEach((level, i) => {
      probabilities[level] = expScores[i] / expSum;
    });

    // Calculate confidence
    const sortedScores = [...scores].sort((a, b) => b - a);
    const confidence = Math.min(0.95, Math.max(0.4, 0.5 + (sortedScores[0] - sortedScores[1]) * 0.5));

    return {
      energy_level: this.energyLevels[bestIdx],
      confidence,
      class_id: bestIdx,
      probabilities
    };
  }

  static getEnergyLevels(): Record<number, string> {
    return Object.fromEntries(this.energyLevels.map((level, i) => [i, level]));
  }

  static async testEnergyDetection(): Promise<EnergyAnalysis[]> {
    const testCases = [
      { name: 'Chill', rms: 0.12, tempo: 75, peak: 0.15, brightness: 1500 },
      { name: 'Groove', rms: 0.28, tempo: 115, peak: 0.35, brightness: 2500 },
      { name: 'Club Rager', rms: 0.45, tempo: 140, peak: 0.65, brightness: 3800 }
    ];

    return testCases.map(test => {
      console.log(`Testing ${test.name}:`);
      const result = this.classify(test.rms, test.tempo, test.peak, test.brightness);
      console.log(`Result: ${result.energy_level} (${(result.confidence * 100).toFixed(1)}%)`);
      console.log(`Probabilities:`, result.probabilities);
      return result;
    });
  }
}