'use client';

import { useState } from 'react';
import { AudioProcessor } from './utils/audioProcessor';

type ProcessingStage = 
  | 'idle'
  | 'loading'
  | 'analyzing'
  | 'creating'
  | 'complete';

export default function Home() {
  const [song1, setSong1] = useState<File | null>(null);
  const [song2, setSong2] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [transitionUrl, setTransitionUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const transitionBlob = await processor.createTransition(song1, song2);
      const url = URL.createObjectURL(transitionBlob);
      setTransitionUrl(url);
    } catch (err) {
      setError('Error processing audio. Please try again with different files.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 to-black text-white p-8 flex flex-col">
      <div className="max-w-4xl mx-auto flex-grow">
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
            className={`px-8 py-3 rounded-full text-lg font-semibold ${
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

        {transitionUrl && (
          <div className="mt-8 bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 glow-text">Your Transition</h2>
            <audio controls className="w-full">
              <source src={transitionUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
            <div className="mt-4 flex justify-center">
              <a
                href={transitionUrl}
                download="transition.mp3"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg glow-text"
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