import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ChevronDown } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
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
  const [currentGradient, setCurrentGradient] = useState('linear-gradient(135deg, rgba(62, 139, 104, 0.4) 0%, rgba(42, 95, 74, 0.6) 100%)');
  const [targetGradient, setTargetGradient] = useState('linear-gradient(135deg, rgba(62, 139, 104, 0.4) 0%, rgba(42, 95, 74, 0.6) 100%)');
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Parse gradient colors from gradient string
  const parseGradientColors = (gradient: string) => {
    const rgbaMatches = gradient.match(/rgba?\([\d\s,\.]+\)/g) || [];
    return rgbaMatches.map(rgba => {
      const values = rgba.match(/[\d\.]+/g) || [];
      return {
        r: parseFloat(values[0]) || 0,
        g: parseFloat(values[1]) || 0,
        b: parseFloat(values[2]) || 0,
        a: parseFloat(values[3]) || 1
      };
    });
  };

  // Interpolate between two colors
  const lerpColor = (c1: {r:number,g:number,b:number,a:number}, c2: {r:number,g:number,b:number,a:number}, t: number) => {
    return {
      r: c1.r + (c2.r - c1.r) * t,
      g: c1.g + (c2.g - c1.g) * t,
      b: c1.b + (c2.b - c1.b) * t,
      a: c1.a + (c2.a - c1.a) * t
    };
  };

  // Build gradient string from colors
  const buildGradient = (colors: {r:number,g:number,b:number,a:number}[]) => {
    if (colors.length < 2) return currentGradient;
    return `linear-gradient(135deg, rgba(${Math.round(colors[0].r)}, ${Math.round(colors[0].g)}, ${Math.round(colors[0].b)}, ${colors[0].a.toFixed(2)}) 0%, rgba(${Math.round(colors[1].r)}, ${Math.round(colors[1].g)}, ${Math.round(colors[1].b)}, ${colors[1].a.toFixed(2)}) 100%)`;
  };

  // Animate gradient transition
  const animateGradient = (fromGradient: string, toGradient: string) => {
    const fromColors = parseGradientColors(fromGradient);
    const toColors = parseGradientColors(toGradient);
    
    if (fromColors.length < 2 || toColors.length < 2) {
      setCurrentGradient(toGradient);
      return;
    }

    const duration = 2000; // 2 seconds
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return;
      
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-in-out function for super smooth transition
      const eased = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const interpolatedColors = [
        lerpColor(fromColors[0], toColors[0], eased),
        lerpColor(fromColors[1], toColors[1], eased)
      ];

      setCurrentGradient(buildGradient(interpolatedColors));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentGradient(toGradient);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    setSlideIn(true);
    
    // Extract colors on mount for the current track
    const imageUrl = currentTrack.album.images[0]?.url;
    if (imageUrl) {
      extractColors(imageUrl).then(gradient => {
        setCurrentGradient(gradient);
        setTargetGradient(gradient);
      });
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentTrack.id !== prevTrackId) {
      setCoverFlip(true);
      setTimeout(() => setCoverFlip(false), 600);
      setPrevTrackId(currentTrack.id);

      // Extract colors from album art with smooth animated transition
      const imageUrl = currentTrack.album.images[0]?.url;
      if (imageUrl) {
        extractColors(imageUrl).then(gradient => {
          const prevGradient = currentGradient;
          setTargetGradient(gradient);
          animateGradient(prevGradient, gradient);
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
        background: currentGradient,
      }}
    >
      <div className="absolute inset-0" style={{ backdropFilter: 'blur(40px)' }} />
      <div className="relative h-full flex flex-col max-w-6xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-4 flex-shrink-0">
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

        {/* Main Content - Horizontal Layout */}
        <div className="flex-1 flex items-center gap-16 min-h-0">
          {/* Album Art - Left Side */}
          <div className="flex-shrink-0 w-[420px]">
            <div
              className={`relative aspect-square rounded-[32px] overflow-hidden shadow-2xl transition-transform duration-600 ${coverFlip ? 'animate-flip' : ''}`}
              style={{
                transformStyle: 'preserve-3d',
                perspective: '1000px'
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
          <div className="flex-1 flex flex-col justify-center min-w-0">
            {/* Track Info - Reduced by 40% */}
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
                <SkipBack className="w-9 h-9" fill="currentColor" />
              </button>
              <button
                onClick={onTogglePlay}
                className="w-20 h-20 bg-white hover:scale-105 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 relative overflow-hidden"
              >
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                  <Pause className="w-9 h-9 text-black" fill="black" />
                </div>
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${!isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                  <Play className="w-9 h-9 text-black ml-1" fill="black" />
                </div>
              </button>
              <button
                onClick={onNext}
                className="text-white hover:text-[#cfffb1] transition"
              >
                <SkipForward className="w-9 h-9" fill="currentColor" />
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