'use client';

import { useState, useEffect } from 'react';
import { AudioProcessor } from './utils/audioProcessor';
import { EnergyDetector, EnergyAnalysis } from './utils/energyDetector';

type ProcessingStage = 
  | 'idle'
  | 'loading'
  | 'analyzing'
  | 'creating'
  | 'complete';

type BpmCompatibility = 'excellent' | 'mid' | 'poor';

export default function Home() {
  const [song1, setSong1] = useState<File | null>(null);
  const [song2, setSong2] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [transitionUrl, setTransitionUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [bpm1, setBpm1] = useState<number | null>(null);
  const [bpm2, setBpm2] = useState<number | null>(null);
  const [bpmCompatibility, setBpmCompatibility] = useState<BpmCompatibility | null>(null);
  const [energyAnalysis, setEnergyAnalysis] = useState<EnergyAnalysis | null>(null);
  const [isAnalyzingEnergy, setIsAnalyzingEnergy] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      setMousePosition({ x: clientX, y: clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    // EnergyDetector available globally for testing
    (window as unknown as { EnergyDetector: typeof EnergyDetector }).EnergyDetector = EnergyDetector;
    
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setSong: (file: File | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      // Clean up previous transition URL if it exists
      if (transitionUrl) {
        URL.revokeObjectURL(transitionUrl);
        setTransitionUrl(null);
      }
      setSong(file);
      setError(null);
      setProgress(0);
      setStage('idle');
      setBpm1(null);
      setBpm2(null);
      setBpmCompatibility(null);
      setEnergyAnalysis(null);
    }
  };

  const getStageMessage = (stage: ProcessingStage, progress: number) => {
    switch (stage) {
      case 'loading':
        return `Loading audio files... ${progress}%`;
      case 'analyzing':
        return `Analyzing beats and BPM... ${progress}%`;
      case 'creating':
        return `Creating transition... ${progress}%`;
      case 'complete':
        return 'Transition complete!';
      default:
        return 'Ready to create transition';
    }
  };

  const evaluateBpmCompatibility = (bpm1: number, bpm2: number): BpmCompatibility => {
    const difference = Math.abs(bpm1 - bpm2);
    const percentageDiff = (difference / Math.min(bpm1, bpm2)) * 100;
    
    if (percentageDiff <= 5) {
      return 'excellent';
    } else if (percentageDiff <= 10) {
      return 'mid';
    } else {
      return 'poor';
    }
  };

  const processTransition = async () => {
    if (!song1 || !song2) return;
    
    // Clean up previous transition URL if it exists
    if (transitionUrl) {
      URL.revokeObjectURL(transitionUrl);
      setTransitionUrl(null);
    }
    
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setStage('loading');
    setBpm1(null);
    setBpm2(null);
    setBpmCompatibility(null);
    setEnergyAnalysis(null);
    
    try {
      const processor = new AudioProcessor((progress) => {
        setProgress(Math.round(progress * 100));
        // Update stage based on progress
        if (progress <= 0.3) {
          setStage('loading');
        } else if (progress <= 0.7) {
          setStage('analyzing');
        } else if (progress < 1) {
          setStage('creating');
        } else {
          setStage('complete');
        }
      });
      const { blob, bpm1, bpm2 } = await processor.createTransition(song1, song2);
      const url = URL.createObjectURL(blob);
      setTransitionUrl(url);
      setBpm1(bpm1);
      setBpm2(bpm2);
      setBpmCompatibility(evaluateBpmCompatibility(bpm1, bpm2));
      
      // Analyze energy level of the transition
      setIsAnalyzingEnergy(true);
      try {
        const audioBuffer = await blobToAudioBuffer(blob);
        const energyResult = await EnergyDetector.analyzeEnergy(audioBuffer);
        setEnergyAnalysis(energyResult);
      } catch (energyError) {
        console.error('Energy analysis failed:', energyError);
        // Show a user-friendly message about energy analysis failure
        // but don't fail the entire transition process
        setError(`Transition created successfully! Energy analysis failed: ${energyError instanceof Error ? energyError.message : 'Unknown error'}`);
        // Clear the error after 5 seconds
        setTimeout(() => setError(null), 5000);
      } finally {
        setIsAnalyzingEnergy(false);
      }
    } catch (err) {
      setError('Error processing audio. Please try again with different files.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper function to convert blob to AudioBuffer
  const blobToAudioBuffer = async (blob: Blob): Promise<AudioBuffer> => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      
      // Create AudioContext with proper error handling
      let audioContext: AudioContext;
      try {
        audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        
        // Resume the context if it's suspended (required for some browsers)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
      } catch (contextError) {
        console.error('Error creating AudioContext:', contextError);
        throw new Error('Failed to create audio context. Please ensure you have audio permissions.');
      }
      
      // Decode the audio data
      try {
        return await audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeError) {
        console.error('Error decoding audio data:', decodeError);
        throw new Error('Failed to decode audio data. The file may be corrupted or in an unsupported format.');
      }
    } catch (error) {
      console.error('Error converting blob to AudioBuffer:', error);
      throw error; // Re-throw the specific error instead of creating a generic one
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-950 text-white p-8 flex flex-col relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-600/20 to-transparent animate-wave"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-purple-800/20 to-transparent animate-wave-reverse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl animate-pulse-slow"></div>
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-800/20 rounded-full blur-3xl animate-pulse-slow animation-delay-2000"></div>
          {/* Cursor-following element */}
          <div 
            className="absolute w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl transition-transform duration-200 ease-out"
            style={{
              transform: `translate(${mousePosition.x - 250}px, ${mousePosition.y - 250}px)`,
            }}
          />
        </div>
      </div>
      <div className="max-w-4xl mx-auto flex-grow relative z-10">
        <h1 className="text-6xl font-bold mb-24 text-center">
          <span className="glow-text-strong">DJ</span>
          <span className="glow-text-purple">Moody</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 glow-text">First Song</h2>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => handleFileUpload(e, setSong1)}
              className="w-full h-16 p-4 bg-gray-700 rounded text-lg cursor-pointer hover:bg-gray-600 transition-colors flex items-center"
            />
            {song1 && (
              <p className="mt-2 text-sm text-gray-400 glow-text">
                Selected: {song1.name}
              </p>
            )}
          </div>

          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 glow-text">Second Song</h2>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => handleFileUpload(e, setSong2)}
              className="w-full h-16 p-4 bg-gray-700 rounded text-lg cursor-pointer hover:bg-gray-600 transition-colors flex items-center"
            />
            {song2 && (
              <p className="mt-2 text-sm text-gray-400 glow-text">
                Selected: {song2.name}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200 glow-text">
            {error}
          </div>
        )}

        <div className="text-center">
          <button
            onClick={processTransition}
            disabled={!song1 || !song2 || isProcessing}
            className={`px-8 py-3 rounded-full text-lg font-semibold glow-button ${
              !song1 || !song2 || isProcessing
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 glow-text'
            }`}
          >
            {isProcessing ? getStageMessage(stage, progress) : 'Create Transition'}
          </button>
        </div>

        {isProcessing && (
          <div className="mt-4 space-y-2">
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-400 text-center glow-text">
              {getStageMessage(stage, progress)}
            </p>
          </div>
        )}

        {bpm1 && bpm2 && bpmCompatibility && (
          <div className="mt-8 bg-gray-900 p-6 rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-semibold glow-text">BPM Analysis</h2>
              <div className="relative group">
                <button className="w-6 h-6 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center text-sm font-bold transition-colors">
                  ?
                </button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-6 py-4 bg-gray-800 text-gray-200 text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-[400px]">
                  <div className="space-y-2">
                    <div><span className="text-green-400 font-semibold">Excellent:</span> Songs within 5% BPM difference</div>
                    <div><span className="text-yellow-400 font-semibold">Mid:</span> Songs within 10% BPM difference</div>
                    <div><span className="text-red-400 font-semibold">Poor:</span> Songs with more than 10% BPM difference</div>
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">First Song&apos;s Calculated BPM:</span>
                <span className="font-semibold">{bpm1}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Second Song&apos;s Calculated BPM:</span>
                <span className="font-semibold">{bpm2}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Compatibility:</span>
                <span className={`font-semibold ${
                  bpmCompatibility === 'excellent' ? 'text-green-400' :
                  bpmCompatibility === 'mid' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {bpmCompatibility.charAt(0).toUpperCase() + bpmCompatibility.slice(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {isAnalyzingEnergy && (
          <div className="mt-8 bg-gray-900 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 glow-text">Energy Detection</h2>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
              <p className="mt-2 text-gray-400 glow-text">Analyzing energy level...</p>
            </div>
          </div>
        )}

        {energyAnalysis && (
          <div className="mt-8 bg-gray-900 p-6 rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-semibold glow-text">Energy Detection</h2>
              <div className="relative group">
                <button className="w-6 h-6 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center text-sm font-bold transition-colors">
                  ?
                </button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-6 py-4 bg-gray-800 text-gray-200 text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-[500px]">
                  A Machine Learning model analyzes your music to determine energy levels based on trained data on your favorite songs!
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Energy Level:</span>
                <span className="font-semibold text-purple-400 glow-text">
                  {energyAnalysis.energy_level}
                </span>
              </div>
              <div className="mt-4">
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(energyAnalysis.probabilities).map(([level, probability]) => (
                    <div key={level} className="flex justify-between items-center">
                      <span className={`text-sm ${
                        level === energyAnalysis.energy_level ? 'text-purple-400 font-semibold' : 'text-gray-400'
                      }`}>
                        {level}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              level === energyAnalysis.energy_level ? 'bg-purple-400' : 'bg-gray-500'
                            }`}
                            style={{ width: `${(probability * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-400 w-8">
                          {(probability * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {transitionUrl && (
          <div className="mt-8 bg-gray-900 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 glow-text">Your Transition</h2>
            <audio controls className="w-full">
              <source src={transitionUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
            <div className="mt-4 flex justify-center">
              <a
                href={transitionUrl}
                download="transition.mp3"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg glow-text glow-button"
              >
                Download Transition
              </a>
            </div>
          </div>
        )}
      </div>
      <footer className="text-center mt-auto pt-8 text-sm text-gray-400 glow-text">
        Made with ❤️ by <a href="https://github.com/shreyas765" className="glow-text hover:text-purple-400 transition-colors">Shreyas Arisa</a>
      </footer>
    </main>
  );
} 