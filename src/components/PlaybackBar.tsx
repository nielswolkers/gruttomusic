import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface PlaybackBarProps {
  currentTrack: Spotify.Track;
  isPlaying: boolean;
  position: number;
  duration: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (position: number) => void;
  onExpand: () => void;
}

export function PlaybackBar({
  currentTrack,
  isPlaying,
  position,
  duration,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onExpand,
}: PlaybackBarProps) {
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  function formatTime(ms: number) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-[#f5f5f7] text-[#1d1d1f] shadow-2xl z-40 border-t border-[#e5e5e7]"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' }}
    >
      <div className="px-4 py-2">
        <div className="flex items-center gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
            <img
              src={currentTrack.album.images[0]?.url}
              alt={currentTrack.name}
              className="w-14 h-14 rounded-lg shadow-md"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-[#1d1d1f] truncate text-sm">{currentTrack.name}</h4>
              <p className="text-xs text-[#6e6e73] truncate">{currentTrack.artists[0].name}</p>
            </div>
          </div>

          {/* Center controls */}
          <div className="flex flex-col items-center flex-1 max-w-2xl">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={(e) => { e.stopPropagation(); onPrevious(); }}
                className="text-[#6e6e73] hover:text-[#1d1d1f] transition"
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                className="w-10 h-10 bg-[#1d1d1f] hover:scale-105 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 relative overflow-hidden"
              >
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                  <Pause className="w-5 h-5 text-white" fill="white" />
                </div>
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${!isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                  <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                className="text-[#6e6e73] hover:text-[#1d1d1f] transition"
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-[#6e6e73] min-w-[40px] text-right">{formatTime(position)}</span>
              <input
                type="range"
                min="0"
                max={duration}
                value={position}
                onChange={(e) => onSeek(parseInt(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 h-1 bg-[#d1d1d6] rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all"
                style={{
                  background: `linear-gradient(to right, #1d1d1f 0%, #1d1d1f ${progressPercent}%, #d1d1d6 ${progressPercent}%, #d1d1d6 100%)`
                }}
              />
              <span className="text-xs text-[#6e6e73] min-w-[40px]">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right side spacer for balance */}
          <div className="flex-1"></div>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #1d1d1f;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
        }
        input[type="range"]:hover::-webkit-slider-thumb {
          opacity: 1;
        }
        input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #1d1d1f;
          cursor: pointer;
          border: none;
          opacity: 0;
          transition: opacity 0.2s;
        }
        input[type="range"]:hover::-moz-range-thumb {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
