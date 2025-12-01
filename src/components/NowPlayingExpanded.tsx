import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { extractColors } from '@/utils/colorExtractor';

interface ContextInfo {
  name: string;
  type: 'artist' | 'playlist';
}

interface NowPlayingExpandedProps {
  currentTrack: Spotify.Track;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffleEnabled: boolean;
  repeatMode: number;
  contextInfo: ContextInfo | null;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (position: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onCollapse: () => void;
}

export function NowPlayingExpanded({
  currentTrack,
  isPlaying,
  position,
  duration,
  volume,
  shuffleEnabled,
  repeatMode,
  contextInfo,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onToggleRepeat,
  onCollapse,
}: NowPlayingExpandedProps) {
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const volumePercent = volume * 100;
  const [slideIn, setSlideIn] = useState(false);
  const [coverFlip, setCoverFlip] = useState(false);
  const [prevTrackId, setPrevTrackId] = useState(currentTrack.id);
  const [bgGradient, setBgGradient] = useState('linear-gradient(135deg, rgba(25, 55, 42, 0.95) 0%, rgba(17, 38, 30, 1) 100%)');
  const [showControls, setShowControls] = useState(true);
  const [mouseTimeout, setMouseTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSlideIn(true);
    
    // Extract colors on mount for the current track
    const imageUrl = currentTrack.album.images[0]?.url;
    if (imageUrl) {
      extractColors(imageUrl).then(gradient => {
        setBgGradient(gradient);
      });
    }
  }, []);

  // Auto-hide controls when mouse is still
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (mouseTimeout) clearTimeout(mouseTimeout);
      const timeout = setTimeout(() => setShowControls(false), 3000);
      setMouseTimeout(timeout);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseTimeout) clearTimeout(mouseTimeout);
    };
  }, [mouseTimeout]);

  useEffect(() => {
    if (currentTrack.id !== prevTrackId) {
      setCoverFlip(true);
      setTimeout(() => setCoverFlip(false), 600);
      setPrevTrackId(currentTrack.id);

      // Extract colors from album art
      const imageUrl = currentTrack.album.images[0]?.url;
      if (imageUrl) {
        extractColors(imageUrl).then(gradient => {
          setBgGradient(gradient);
        });
      }
    }
  }, [currentTrack.id, prevTrackId]);

  function formatTime(ms: number) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const handleCollapse = () => {
    setSlideIn(false);
    setTimeout(onCollapse, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-transform duration-500 ease-out ${slideIn ? 'translate-y-0' : 'translate-y-full'}`}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
        background: bgGradient,
        backdropFilter: 'blur(40px)',
        transition: 'background 1.5s ease-in-out'
      }}
    >
      <div className="h-full flex flex-col max-w-6xl mx-auto px-8 py-6">
        {/* Header */}
        <div className={`flex flex-col items-center mb-4 flex-shrink-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={handleCollapse}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition mb-3"
          >
            <ChevronDown className="w-6 h-6 text-white" />
          </button>
          <span className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-1">Nu aan het spelen</span>
          {contextInfo && (
            <span className="text-sm text-white/60">
              {contextInfo.type === 'artist' ? 'Artiest' : 'Playlist'}: {contextInfo.name}
            </span>
          )}
        </div>

        {/* Main Content - Centered when controls hidden, left-aligned when visible */}
        <div className={`flex-1 flex items-center min-h-0 transition-all duration-700 ${showControls ? 'gap-16 justify-start' : 'justify-center'}`}>
          {/* Album Art - Centers when controls hide */}
          <div className={`flex-shrink-0 transition-all duration-700 ${showControls ? 'w-[420px]' : 'w-[500px]'}`}>
            <div
              className={`relative aspect-square rounded-[32px] overflow-hidden transition-all duration-600 ${coverFlip ? 'animate-flip' : ''}`}
              style={{
                transformStyle: 'preserve-3d',
                perspective: '1000px',
                boxShadow: '0 35px 90px rgba(0, 0, 0, 0.7), 0 20px 40px rgba(0, 0, 0, 0.6)'
              }}
            >
              <img
                src={currentTrack.album.images[0]?.url}
                alt={currentTrack.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Controls & Info - Right Side */}
          <div className={`flex-1 flex flex-col justify-center min-w-0 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Track Info */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2 truncate">{currentTrack.name}</h2>
              <p className="text-sm text-white/80 truncate">{currentTrack.artists.map(a => a.name).join(', ')}</p>
            </div>

            {/* Progress */}
            <div className="mb-8">
              <input
                type="range"
                min="0"
                max={duration}
                value={position}
                onChange={(e) => onSeek(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer mb-2"
                style={{
                  background: `linear-gradient(to right, #cfffb1 0%, #cfffb1 ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <div className="flex justify-between text-sm text-white/70">
                <span>{formatTime(position)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-8 max-w-xl">
              <button
                onClick={onToggleShuffle}
                className={`transition ${shuffleEnabled ? 'text-[#cfffb1]' : 'text-white/60 hover:text-white'}`}
              >
                <Shuffle className="w-6 h-6" />
              </button>
              <button
                onClick={onPrevious}
                className="text-white hover:text-[#cfffb1] transition"
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="currentColor">
                  <path d="M8 6h2v24H8V6zm4 12l14-9v18l-14-9z"/>
                </svg>
              </button>
              <button
                onClick={onTogglePlay}
                className="w-20 h-20 bg-white hover:scale-105 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 relative overflow-hidden"
              >
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="black">
                    <path d="M12 8h4v20h-4V8zm8 0h4v20h-4V8z"/>
                  </svg>
                </div>
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${!isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="black">
                    <path d="M12 8l18 10-18 10V8z"/>
                  </svg>
                </div>
              </button>
              <button
                onClick={onNext}
                className="text-white hover:text-[#cfffb1] transition"
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="currentColor">
                  <path d="M26 6h2v24h-2V6zM10 9l14 9-14 9V9z"/>
                </svg>
              </button>
              <button
                onClick={onToggleRepeat}
                className={`transition flex items-center ${repeatMode > 0 ? 'text-[#cfffb1]' : 'text-white/60 hover:text-white'}`}
              >
                <Repeat className="w-6 h-6" />
                {repeatMode === 2 && <span className="text-xs ml-1 font-bold">1</span>}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center space-x-4 max-w-md">
              <Volume2 className="w-5 h-5 text-white/70" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #cfffb1 0%, #cfffb1 ${volumePercent}%, rgba(255,255,255,0.2) ${volumePercent}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        @keyframes flip {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }
        .animate-flip {
          animation: flip 0.6s ease-in-out;
        }
      `}</style>
    </div>
  );
}
