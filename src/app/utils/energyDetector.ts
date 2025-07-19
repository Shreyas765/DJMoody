// Energy detection utility for frontend
export interface EnergyAnalysis {
  energy_level: string;
  confidence: number;
  class_id: number;
  probabilities: Record<string, number>;
}

export class EnergyDetector {
  private static energyLevels = {
    0: "Chill Vibe",
    1: "Lounge", 
    2: "Groove",
    3: "Party",
    4: "Club Rager"
  };

  /**
   * Analyze audio energy level from an audio buffer
   */
  static async analyzeEnergy(audioBuffer: AudioBuffer): Promise<EnergyAnalysis> {
    const features = this.extractFeatures(audioBuffer);
    const prediction = this.predictEnergyLevel(features);
    
    return prediction;
  }

  /**
   * Extract audio features from AudioBuffer
   */
  private static extractFeatures(audioBuffer: AudioBuffer): number[] {
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    
    const features: number[] = [];
    
    // 1. RMS Energy (Root Mean Square)
    const rms = this.calculateRMS(channelData);
    features.push(rms);
    
    // 2. Spectral Centroid (brightness)
    const spectralCentroid = this.calculateSpectralCentroid(channelData, sampleRate);
    features.push(spectralCentroid);
    
    // 3. Zero Crossing Rate (noisiness)
    const zcr = this.calculateZeroCrossingRate(channelData);
    features.push(zcr);
    
    // 4. Spectral Rolloff (frequency distribution)
    const spectralRolloff = this.calculateSpectralRolloff(channelData, sampleRate);
    features.push(spectralRolloff);
    
    // 5. Spectral Bandwidth
    const spectralBandwidth = this.calculateSpectralBandwidth(channelData, sampleRate);
    features.push(spectralBandwidth);
    
    // 6. Tempo estimation (simplified)
    const tempo = this.estimateTempo(channelData, sampleRate);
    features.push(tempo);
    
    // 7. Peak amplitude
    const peakAmplitude = this.calculatePeakAmplitude(channelData);
    features.push(peakAmplitude);
    
    // 8. Dynamic range
    const dynamicRange = this.calculateDynamicRange(channelData);
    features.push(dynamicRange);
    
    // 9. Spectral contrast
    const spectralContrast = this.calculateSpectralContrast(channelData, sampleRate);
    features.push(spectralContrast);
    
    // 10. Beat strength
    const beatStrength = this.calculateBeatStrength(channelData, sampleRate);
    features.push(beatStrength);
    
    // Pad to 25 features to match the model
    while (features.length < 25) {
      features.push(0);
    }
    
    return features.slice(0, 25);
  }

  /**
   * Calculate RMS energy
   */
  private static calculateRMS(channelData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    return Math.sqrt(sum / channelData.length);
  }

  /**
   * Calculate spectral centroid (brightness)
   */
  private static calculateSpectralCentroid(channelData: Float32Array, sampleRate: number): number {
    const fftSize = 2048;
    const hopSize = fftSize / 4;
    let totalCentroid = 0;
    let count = 0;
    
    for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
      const fft = this.computeFFT(channelData.slice(i, i + fftSize));
      let centroid = 0;
      let magnitudeSum = 0;
      
      for (let j = 0; j < fft.length / 2; j++) {
        const frequency = (j * sampleRate) / fft.length;
        const magnitude = Math.abs(fft[j]);
        centroid += frequency * magnitude;
        magnitudeSum += magnitude;
      }
      
      if (magnitudeSum > 0) {
        totalCentroid += centroid / magnitudeSum;
        count++;
      }
    }
    
    return count > 0 ? totalCentroid / count : 0;
  }

  /**
   * Calculate zero crossing rate
   */
  private static calculateZeroCrossingRate(channelData: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < channelData.length; i++) {
      if ((channelData[i] >= 0 && channelData[i - 1] < 0) || 
          (channelData[i] < 0 && channelData[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / channelData.length;
  }

  /**
   * Calculate spectral rolloff
   */
  private static calculateSpectralRolloff(channelData: Float32Array, sampleRate: number): number {
    const fftSize = 2048;
    const fft = this.computeFFT(channelData.slice(0, Math.min(fftSize, channelData.length)));
    const threshold = 0.85; // 85th percentile
    
    let totalMagnitude = 0;
    for (let i = 0; i < fft.length / 2; i++) {
      totalMagnitude += Math.abs(fft[i]);
    }
    
    const targetMagnitude = totalMagnitude * threshold;
    let cumulativeMagnitude = 0;
    
    for (let i = 0; i < fft.length / 2; i++) {
      cumulativeMagnitude += Math.abs(fft[i]);
      if (cumulativeMagnitude >= targetMagnitude) {
        return (i * sampleRate) / fft.length;
      }
    }
    
    return sampleRate / 2;
  }

  /**
   * Calculate spectral bandwidth
   */
  private static calculateSpectralBandwidth(channelData: Float32Array, sampleRate: number): number {
    const fftSize = 2048;
    const fft = this.computeFFT(channelData.slice(0, Math.min(fftSize, channelData.length)));
    const centroid = this.calculateSpectralCentroid(channelData, sampleRate);
    
    let bandwidth = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < fft.length / 2; i++) {
      const frequency = (i * sampleRate) / fft.length;
      const magnitude = Math.abs(fft[i]);
      bandwidth += Math.pow(frequency - centroid, 2) * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? Math.sqrt(bandwidth / magnitudeSum) : 0;
  }

  /**
   * Estimate tempo (simplified)
   */
  private static estimateTempo(channelData: Float32Array, sampleRate: number): number {
    // Simple tempo estimation based on energy peaks
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
    const hopSize = Math.floor(windowSize / 4);
    const energies: number[] = [];
    
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += channelData[i + j] * channelData[i + j];
      }
      energies.push(Math.sqrt(energy / windowSize));
    }
    
    // Find peaks and estimate tempo
    const peaks = this.findPeaks(energies);
    if (peaks.length < 2) return 120; // Default tempo
    
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const tempo = (60 * sampleRate) / (avgInterval * hopSize);
    
    return Math.max(60, Math.min(180, tempo));
  }

  /**
   * Calculate peak amplitude
   */
  private static calculatePeakAmplitude(channelData: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      peak = Math.max(peak, Math.abs(channelData[i]));
    }
    return peak;
  }

  /**
   * Calculate dynamic range
   */
  private static calculateDynamicRange(channelData: Float32Array): number {
    let min = 0, max = 0;
    for (let i = 0; i < channelData.length; i++) {
      min = Math.min(min, channelData[i]);
      max = Math.max(max, channelData[i]);
    }
    return max - min;
  }

  /**
   * Calculate spectral contrast
   */
  private static calculateSpectralContrast(channelData: Float32Array, sampleRate: number): number {
    const fftSize = 2048;
    const fft = this.computeFFT(channelData.slice(0, Math.min(fftSize, channelData.length)));
    
    const magnitudes = [];
    for (let i = 0; i < fft.length / 2; i++) {
      magnitudes.push(Math.abs(fft[i]));
    }
    
    magnitudes.sort((a, b) => a - b);
    const median = magnitudes[Math.floor(magnitudes.length / 2)];
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    
    return mean - median;
  }

  /**
   * Calculate beat strength
   */
  private static calculateBeatStrength(channelData: Float32Array, sampleRate: number): number {
    const windowSize = Math.floor(sampleRate * 0.1);
    const hopSize = Math.floor(windowSize / 4);
    let totalStrength = 0;
    let count = 0;
    
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += channelData[i + j] * channelData[i + j];
      }
      totalStrength += Math.sqrt(energy / windowSize);
      count++;
    }
    
    return count > 0 ? totalStrength / count : 0;
  }

  /**
   * Find peaks in an array
   */
  private static findPeaks(array: number[]): number[] {
    const peaks: number[] = [];
    for (let i = 1; i < array.length - 1; i++) {
      if (array[i] > array[i - 1] && array[i] > array[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  /**
   * Simple FFT implementation using Web Audio API
   */
  private static computeFFT(channelData: Float32Array): Float32Array {
    // Use Web Audio API's AnalyserNode for FFT
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, channelData.length, audioContext.sampleRate);
    buffer.copyToChannel(channelData, 0);
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    
    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(frequencyData);
    
    // Convert from dB to linear scale
    const linearData = new Float32Array(frequencyData.length);
    for (let i = 0; i < frequencyData.length; i++) {
      linearData[i] = Math.pow(10, frequencyData[i] / 20);
    }
    
    return linearData;
  }

  /**
   * Predict energy level based on extracted features
   */
  private static predictEnergyLevel(features: number[]): EnergyAnalysis {
    // Simple rule-based classification based on audio characteristics
    const [rms, spectralCentroid, zcr, spectralRolloff, spectralBandwidth, 
           tempo, peakAmplitude, dynamicRange, spectralContrast, beatStrength] = features;
    
    // Calculate scores for each energy level
    const scores: Record<number, number> = {
      0: 0, // Chill Vibe
      1: 0, // Lounge
      2: 0, // Groove
      3: 0, // Party
      4: 0  // Club Rager
    };
    
    // Chill Vibe: low tempo, low energy, low spectral centroid
    scores[0] += (1 - Math.min(tempo / 180, 1)) * 0.3;
    scores[0] += (1 - Math.min(rms / 0.5, 1)) * 0.3;
    scores[0] += (1 - Math.min(spectralCentroid / 4000, 1)) * 0.4;
    
    // Lounge: medium-low tempo, medium energy
    scores[1] += (1 - Math.abs(tempo - 90) / 90) * 0.4;
    scores[1] += (1 - Math.abs(rms - 0.3) / 0.3) * 0.3;
    scores[1] += (1 - Math.min(zcr / 0.1, 1)) * 0.3;
    
    // Groove: medium tempo, medium-high energy
    scores[2] += (1 - Math.abs(tempo - 120) / 120) * 0.4;
    scores[2] += (1 - Math.abs(rms - 0.4) / 0.4) * 0.3;
    scores[2] += Math.min(beatStrength / 0.5, 1) * 0.3;
    
    // Party: high tempo, high energy
    scores[3] += Math.min(tempo / 180, 1) * 0.4;
    scores[3] += Math.min(rms / 0.6, 1) * 0.3;
    scores[3] += Math.min(spectralCentroid / 4000, 1) * 0.3;
    
    // Club Rager: very high tempo, very high energy
    scores[4] += Math.min(tempo / 180, 1) * 0.5;
    scores[4] += Math.min(rms / 0.7, 1) * 0.3;
    scores[4] += Math.min(peakAmplitude / 0.8, 1) * 0.2;
    
    // Find the best match
    let bestClass = 0;
    let bestScore = scores[0];
    
    for (let i = 1; i < 5; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestClass = i;
      }
    }
    
    // Normalize scores to probabilities
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const probabilities: Record<string, number> = {};
    
    Object.entries(scores).forEach(([classId, score]) => {
      const levelName = this.energyLevels[parseInt(classId) as keyof typeof this.energyLevels];
      probabilities[levelName] = score / totalScore;
    });
    
    return {
      energy_level: this.energyLevels[bestClass as keyof typeof this.energyLevels],
      confidence: bestScore,
      class_id: bestClass,
      probabilities
    };
  }

  /**
   * Get available energy levels
   */
  static getEnergyLevels(): Record<number, string> {
    return { ...this.energyLevels };
  }
} 