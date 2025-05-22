import * as Tone from 'tone';

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

  async loadAudio(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private findBeats(channelData: Float32Array, sampleRate: number): BeatInfo {
    const windowSize = Math.floor(sampleRate * 0.04); // 40ms windows
    const hopSize = Math.floor(windowSize / 4);
    const minBeatInterval = Math.floor(sampleRate * 0.35);
    
    const energies: number[] = [];
    const beats: number[] = [];
    
    // Basic energy calculation
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += channelData[i + j] * channelData[i + j];
      }
      energies.push(Math.sqrt(energy / windowSize));
    }

    // Simple peak detection
    const threshold = this.calculateThreshold(energies);
    let lastBeat = -minBeatInterval;
    
    for (let i = 2; i < energies.length - 2; i++) {
      const currentSample = i * hopSize;
      const energy = energies[i];
      
      if (energy > threshold && 
          energy > energies[i-1] && energy > energies[i-2] &&
          energy > energies[i+1] && energy > energies[i+2] &&
          currentSample - lastBeat > minBeatInterval) {
        beats.push(currentSample);
        lastBeat = currentSample;
      }
    }

    // Calculate BPM
    const bpm = this.calculateBPM(beats, sampleRate);
    const confidence = this.calculateConfidence(beats);

    return {
      bpm: Math.max(85, Math.min(175, Math.round(bpm))),
      beats,
      confidence
    };
  }

  private calculateThreshold(energies: number[]): number {
    const sorted = [...energies].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return median * 1.5;
  }

  private calculateBPM(beats: number[], sampleRate: number): number {
    if (beats.length < 2) return 120;

    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    return (60 * sampleRate) / avgInterval;
  }

  private calculateConfidence(beats: number[]): number {
    if (beats.length < 4) return 0.3;
    
    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0.3, Math.min(1, 1 - cv));
  }

  private findMixPoints(
    beatInfo1: BeatInfo, 
    beatInfo2: BeatInfo, 
    buffer1: AudioBuffer,
    buffer2: AudioBuffer
  ): { point1: MixPoint; point2: MixPoint } {
    
    const candidates1 = this.findCandidates(beatInfo1, buffer1, 0.6, 0.85);
    const candidates2 = this.findCandidates(beatInfo2, buffer2, 0.15, 0.5);
    
    let bestMatch = {
      point1: candidates1[0] || { time: buffer1.duration * 0.7, energy: 0.5, score: 0.5 },
      point2: candidates2[0] || { time: buffer2.duration * 0.3, energy: 0.5, score: 0.5 }
    };
    
    let bestScore = 0;
    
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
    
    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
  }

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

  private getPositionScore(time: number, duration: number, startPct: number, endPct: number): number {
    const normalizedTime = (time / duration - startPct) / (endPct - startPct);
    return 1 - Math.abs(normalizedTime - 0.5);
  }

  private async createMix(
    buffer1: AudioBuffer, 
    buffer2: AudioBuffer, 
    mixPoint1: MixPoint, 
    mixPoint2: MixPoint,
    beatInfo1: BeatInfo,
    beatInfo2: BeatInfo
  ): Promise<AudioBuffer> {
    
    const sampleRate = buffer1.sampleRate;
    const mixDuration = 20; // 20 seconds mix
    const mixSamples = Math.floor(mixDuration * sampleRate);
    const channels = Math.max(buffer1.numberOfChannels, buffer2.numberOfChannels);
    
    const mixedBuffer = new AudioBuffer({
      numberOfChannels: channels,
      length: mixSamples,
      sampleRate: sampleRate
    });

    const startSample1 = Math.floor(mixPoint1.time * sampleRate);
    const startSample2 = Math.floor(mixPoint2.time * sampleRate);

    for (let channel = 0; channel < channels; channel++) {
      const mixedData = mixedBuffer.getChannelData(channel);
      const data1 = buffer1.getChannelData(Math.min(channel, buffer1.numberOfChannels - 1));
      const data2 = buffer2.getChannelData(Math.min(channel, buffer2.numberOfChannels - 1));

      for (let i = 0; i < mixSamples; i++) {
        const progress = i / mixSamples;
        
        let sample1 = 0;
        let sample2 = 0;
        
        const index1 = startSample1 + i;
        if (index1 < data1.length) {
          sample1 = data1[index1];
        }
        
        const index2 = startSample2 + i;
        if (index2 < data2.length) {
          sample2 = data2[index2];
        }
        
        // Simple linear crossfade
        const fadeOut = 1 - progress;
        const fadeIn = progress;
        
        mixedData[i] = (sample1 * fadeOut + sample2 * fadeIn) * 0.8;
      }
    }

    return mixedBuffer;
  }

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

  async createTransition(song1: File, song2: File): Promise<Blob> {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      
      this.onProgress?.(0.1);
      
      const [buffer1, buffer2] = await Promise.all([
        this.loadAudio(song1),
        this.loadAudio(song2)
      ]);
      this.onProgress?.(0.3);

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const [audioBuffer1, audioBuffer2] = await Promise.all([
        audioContext.decodeAudioData(buffer1.slice(0)),
        audioContext.decodeAudioData(buffer2.slice(0))
      ]);
      this.onProgress?.(0.5);

      const beatInfo1 = this.findBeats(audioBuffer1.getChannelData(0), audioBuffer1.sampleRate);
      const beatInfo2 = this.findBeats(audioBuffer2.getChannelData(0), audioBuffer2.sampleRate);
      
      console.log('Analysis results:', {
        song1: { bpm: beatInfo1.bpm, confidence: (beatInfo1.confidence * 100).toFixed(1) + '%' },
        song2: { bpm: beatInfo2.bpm, confidence: (beatInfo2.confidence * 100).toFixed(1) + '%' }
      });
      
      this.onProgress?.(0.7);

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