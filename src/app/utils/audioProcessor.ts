import * as Tone from 'tone';

// Basic types for our audio processing
interface BeatInfo {
  bpm: number;
  beats: number[];
  confidence: number;
}

interface MixPoint {
  time: number;
  energy: number;
  score: number;
}

export class AudioProcessor {
  private onProgress?: (progress: number) => void;

  constructor(onProgress?: (progress: number) => void) {
    this.onProgress = onProgress;
  }

  // Load audio file into memory
  async loadAudio(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Find beats in the audio using a simple energy-based approach
  private findBeats(channelData: Float32Array, sampleRate: number): BeatInfo {
    // Use 100ms windows for analysis
    const windowSize = Math.floor(sampleRate * 0.1);
    const hopSize = Math.floor(windowSize / 4);
    const minBeatInterval = Math.floor(sampleRate * 0.35);
    
    const energies: number[] = [];
    const beats: number[] = [];
    
    // Calculate energy for each window
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += channelData[i + j] * channelData[i + j];
      }
      energies.push(Math.sqrt(energy / windowSize));
    }

    // Find peaks in the energy signal
    const threshold = this.calculateThreshold(energies);
    let lastBeat = -minBeatInterval;
    
    for (let i = 2; i < energies.length - 2; i++) {
      const currentSample = i * hopSize;
      const energy = energies[i];
      
      // Check if this is a peak and far enough from last beat
      if (energy > threshold && 
          energy > energies[i-1] && energy > energies[i-2] &&
          energy > energies[i+1] && energy > energies[i+2] &&
          currentSample - lastBeat > minBeatInterval) {
        beats.push(currentSample);
        lastBeat = currentSample;
      }
    }

    // Calculate final BPM and confidence
    const bpm = this.calculateBPM(beats, sampleRate);
    const confidence = this.calculateConfidence(beats);

    // Keep BPM in a reasonable range
    return {
      bpm: Math.max(85, Math.min(175, Math.round(bpm))),
      beats,
      confidence
    };
  }

  // Calculate threshold for beat detection
  private calculateThreshold(energies: number[]): number {
    const sorted = [...energies].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return median * 1.5; // This multiplier seems to work well
  }

  // Calculate BPM from beat intervals
  private calculateBPM(beats: number[], sampleRate: number): number {
    if (beats.length < 2) return 120; // Default BPM if not enough beats

    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    return (60 * sampleRate) / avgInterval;
  }

  // Calculate how confident we are in our beat detection
  private calculateConfidence(beats: number[]): number {
    if (beats.length < 4) return 0.3; // Low confidence if not enough beats
    
    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0.3, Math.min(1, 1 - cv));
  }

  // Find good points to mix the two songs
  private findMixPoints(
    beatInfo1: BeatInfo, 
    beatInfo2: BeatInfo, 
    buffer1: AudioBuffer,
    buffer2: AudioBuffer
  ): { point1: MixPoint; point2: MixPoint } {
    
    // Look for mix points in different parts of the songs
    const candidates1 = this.findCandidates(beatInfo1, buffer1, 0.6, 0.85);
    const candidates2 = this.findCandidates(beatInfo2, buffer2, 0.15, 0.5);
    
    // Default points if we can't find good ones
    let bestMatch = {
      point1: candidates1[0] || { time: buffer1.duration * 0.7, energy: 0.5, score: 0.5 },
      point2: candidates2[0] || { time: buffer2.duration * 0.3, energy: 0.5, score: 0.5 }
    };
    
    let bestScore = 0;
    
    // Try to find the best matching points
    for (const p1 of candidates1) {
      for (const p2 of candidates2) {
        const energyMatch = 1 - Math.abs(p1.energy - p2.energy);
        const score = energyMatch * p1.score * p2.score;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { point1: p1, point2: p2 };
        }
      }
    }
    
    return bestMatch;
  }

  // Find potential mix points in a song
  private findCandidates(beatInfo: BeatInfo, buffer: AudioBuffer, startPct: number, endPct: number): MixPoint[] {
    const sampleRate = buffer.sampleRate;
    const duration = buffer.duration;
    const candidates: MixPoint[] = [];
    
    for (const beat of beatInfo.beats) {
      const time = beat / sampleRate;
      if (time >= duration * startPct && time <= duration * endPct) {
        const energy = this.calculateEnergy(buffer, time);
        const positionScore = this.getPositionScore(time, duration, startPct, endPct);
        
        candidates.push({
          time,
          energy,
          score: energy * positionScore
        });
      }
    }
    
    // Return top 5 candidates
    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  // Calculate energy at a specific point in the song
  private calculateEnergy(buffer: AudioBuffer, time: number): number {
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(time * sampleRate);
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms window
    const channelData = buffer.getChannelData(0);
    
    if (startSample + windowSize >= channelData.length) return 0.5;
    
    let energy = 0;
    for (let i = startSample; i < startSample + windowSize; i++) {
      energy += channelData[i] * channelData[i];
    }
    
    return Math.sqrt(energy / windowSize);
  }

  // Score how good a position is for mixing
  private getPositionScore(time: number, duration: number, startPct: number, endPct: number): number {
    const normalizedTime = (time / duration - startPct) / (endPct - startPct);
    return 1 - Math.abs(normalizedTime - 0.5);
  }

  // Create the actual mix between two songs
  private async createMix(
    buffer1: AudioBuffer, 
    buffer2: AudioBuffer, 
    mixPoint1: MixPoint, 
    mixPoint2: MixPoint,
    beatInfo1: BeatInfo,
    beatInfo2: BeatInfo
  ): Promise<AudioBuffer> {
    
    const sampleRate = buffer1.sampleRate;
    const mixDuration = 20; // 20 second mix
    const mixSamples = Math.floor(mixDuration * sampleRate);
    const channels = Math.max(buffer1.numberOfChannels, buffer2.numberOfChannels);
    
    const mixedBuffer = new AudioBuffer({
      numberOfChannels: channels,
      length: mixSamples,
      sampleRate: sampleRate
    });

    const startSample1 = Math.floor(mixPoint1.time * sampleRate);
    const startSample2 = Math.floor(mixPoint2.time * sampleRate);

    // Split vocals and beats
    const vocals1 = this.extractVocals(buffer1);
    const vocals2 = this.extractVocals(buffer2);
    const beats1 = this.extractBeats(buffer1);
    const beats2 = this.extractBeats(buffer2);

    for (let channel = 0; channel < channels; channel++) {
      const mixedData = mixedBuffer.getChannelData(channel);
      const v1Data = vocals1.getChannelData(Math.min(channel, vocals1.numberOfChannels - 1));
      const v2Data = vocals2.getChannelData(Math.min(channel, vocals2.numberOfChannels - 1));
      const b1Data = beats1.getChannelData(Math.min(channel, beats1.numberOfChannels - 1));
      const b2Data = beats2.getChannelData(Math.min(channel, beats2.numberOfChannels - 1));

      for (let i = 0; i < mixSamples; i++) {
        const progress = i / mixSamples;
        
        // Get current samples
        const index1 = startSample1 + i;
        const index2 = startSample2 + i;
        
        let v1Sample = 0, v2Sample = 0, b1Sample = 0, b2Sample = 0;
        
        if (index1 < v1Data.length) v1Sample = v1Data[index1];
        if (index2 < v2Data.length) v2Sample = v2Data[index2];
        if (index1 < b1Data.length) b1Sample = b1Data[index1];
        if (index2 < b2Data.length) b2Sample = b2Data[index2];
        
        // Handle vocal transitions
        const vocalFadeOut = Math.max(0, 1 - progress * 2);
        const vocalFadeIn = Math.max(0, (progress - 0.5) * 2);
        
        // Handle beat transitions with overlap
        let beatFadeOut, beatFadeIn;
        
        if (progress < 0.4) {
          // First song still going strong
          beatFadeOut = 1;
          beatFadeIn = 0;
        } else if (progress < 0.6) {
          // Sweet spot where beats overlap
          const overlapProgress = (progress - 0.4) / 0.2;
          beatFadeOut = 1 - overlapProgress * 0.3;
          beatFadeIn = overlapProgress * 0.7;
        } else {
          // Wrapping up the transition
          const finalProgress = (progress - 0.6) / 0.4;
          beatFadeOut = 0.7 - finalProgress * 0.7;
          beatFadeIn = 0.7 + finalProgress * 0.3;
        }
        
        // Mix everything together
        const vocals = (v1Sample * vocalFadeOut + v2Sample * vocalFadeIn);
        const beats = (b1Sample * beatFadeOut + b2Sample * beatFadeIn);
        
        // Keep volume in check
        mixedData[i] = (vocals + beats) * 0.8;
      }
    }

    return mixedBuffer;
  }

  // Pull out the vocal track
  private extractVocals(buffer: AudioBuffer): AudioBuffer {
    const channels = buffer.numberOfChannels;
    const newBuffer = new AudioBuffer({
      numberOfChannels: channels,
      length: buffer.length,
      sampleRate: buffer.sampleRate
    });

    if (channels < 2) return buffer;

    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    
    for (let channel = 0; channel < channels; channel++) {
      const newData = newBuffer.getChannelData(channel);
      const originalData = buffer.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        const center = (leftChannel[i] + rightChannel[i]) / 2;
        newData[i] = center * 0.8; // Slightly reduce vocals
      }
    }

    return newBuffer;
  }

  // Get the instrumental track
  private extractBeats(buffer: AudioBuffer): AudioBuffer {
    const channels = buffer.numberOfChannels;
    const newBuffer = new AudioBuffer({
      numberOfChannels: channels,
      length: buffer.length,
      sampleRate: buffer.sampleRate
    });

    if (channels < 2) return buffer;

    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    
    for (let channel = 0; channel < channels; channel++) {
      const newData = newBuffer.getChannelData(channel);
      const originalData = buffer.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        const center = (leftChannel[i] + rightChannel[i]) / 2;
        newData[i] = originalData[i] - center * 0.8;
      }
    }

    return newBuffer;
  }

  // Convert our processed audio to WAV format
  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * channels * 2);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // Write WAV header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * channels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * channels * 2, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  }

  // Remove vocals from a track
  private removeVocals(buffer: AudioBuffer): AudioBuffer {
    const channels = buffer.numberOfChannels;
    if (channels < 2) return buffer;

    const newBuffer = new AudioBuffer({
      numberOfChannels: channels,
      length: buffer.length,
      sampleRate: buffer.sampleRate
    });

    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    
    for (let channel = 0; channel < channels; channel++) {
      const newData = newBuffer.getChannelData(channel);
      const originalData = buffer.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        const center = (leftChannel[i] + rightChannel[i]) / 2;
        const vocalRemoved = originalData[i] - center * 0.8;
        
        // Add a bit of stereo enhancement
        const stereoEnhance = channel === 0 ? 0.1 : -0.1;
        newData[i] = vocalRemoved * (1 + stereoEnhance);
        
        // Keep volume in check
        newData[i] = Math.max(-1, Math.min(1, newData[i]));
      }
    }

    return newBuffer;
  }

  // Main function to create a transition between two songs
  async createTransition(song1: File, song2: File, removeVocals: boolean = false): Promise<Blob> {
    try {
      // Make sure Tone.js is running
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
      }
      
      this.onProgress?.(0.1);
      
      // Load both songs
      const [buffer1, buffer2] = await Promise.all([
        this.loadAudio(song1),
        this.loadAudio(song2)
      ]);
      this.onProgress?.(0.3);

      // Decode the audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      let [audioBuffer1, audioBuffer2] = await Promise.all([
        audioContext.decodeAudioData(buffer1.slice(0)),
        audioContext.decodeAudioData(buffer2.slice(0))
      ]);
      this.onProgress?.(0.5);

      // Remove vocals if requested
      if (removeVocals) {
        audioBuffer1 = this.removeVocals(audioBuffer1);
        audioBuffer2 = this.removeVocals(audioBuffer2);
      }

      // Find beats in both songs
      const beatInfo1 = this.findBeats(audioBuffer1.getChannelData(0), audioBuffer1.sampleRate);
      const beatInfo2 = this.findBeats(audioBuffer2.getChannelData(0), audioBuffer2.sampleRate);
      
      console.log('Analysis results:', {
        song1: { bpm: beatInfo1.bpm, confidence: (beatInfo1.confidence * 100).toFixed(1) + '%' },
        song2: { bpm: beatInfo2.bpm, confidence: (beatInfo2.confidence * 100).toFixed(1) + '%' }
      });
      
      this.onProgress?.(0.7);

      // Find good points to mix the songs
      const mixPoints = this.findMixPoints(beatInfo1, beatInfo2, audioBuffer1, audioBuffer2);
      const mixedBuffer = await this.createMix(
        audioBuffer1, 
        audioBuffer2, 
        mixPoints.point1, 
        mixPoints.point2,
        beatInfo1,
        beatInfo2
      );
      
      this.onProgress?.(0.9);

      // Convert to WAV and create blob
      const wavArrayBuffer = this.audioBufferToWav(mixedBuffer);
      const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
      
      this.onProgress?.(1);
      audioContext.close();
      
      return blob;
      
    } catch (error) {
      console.error('Error creating mix:', error);
      throw new Error(`Failed to create mix: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}