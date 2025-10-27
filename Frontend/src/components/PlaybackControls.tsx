import { Timeframe } from '../types/series';

export type TickRate = 1 | 2 | 5 | 10 | 20 | 50 | 100;

interface PlaybackControlsProps {
  playbackIndex: number;
  maxIndex: number;
  isPlaying: boolean;
  tickRate: TickRate;
  tickSource: Timeframe;
  availableTickSources: Timeframe[];
  onTogglePlay: () => void;
  onSeek: (index: number) => void;
  onStep: (direction: -1 | 1) => void;
  onTickRateChange: (rate: TickRate) => void;
  onTickSourceChange: (source: Timeframe) => void;
  onJumpToCurrent: () => void;
}

const tickRateOptions: TickRate[] = [1, 2, 5, 10, 20, 50, 100];

const getTickRateLabel = (rate: TickRate): string => {
  return `${rate} tick${rate > 1 ? 's' : ''}/sec`;
};

const getTimeframeLabel = (timeframe: Timeframe): string => {
  switch (timeframe) {
    case 'M1': return 'M1';
    case 'M5': return 'M5';
    case 'M15': return 'M15';
    case 'M30': return 'M30';
    case 'H1': return 'H1';
    case 'H4': return 'H4';
    case 'Daily': return 'Daily';
    case 'Weekly': return 'Weekly';
    case 'Monthly': return 'Monthly';
    default: return timeframe;
  }
};

const PlaybackControls = ({
  playbackIndex,
  maxIndex,
  isPlaying,
  tickRate,
  tickSource,
  availableTickSources,
  onTogglePlay,
  onSeek,
  onStep,
  onTickRateChange,
  onTickSourceChange,
  onJumpToCurrent,
}: PlaybackControlsProps) => {
  return (
    <div className="playback-controls">
      <div className="playback-buttons">
        <button type="button" onClick={() => onStep(-1)} disabled={playbackIndex <= 0}>
          ◀ Prev
        </button>
        <button type="button" onClick={onTogglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => onStep(1)} disabled={playbackIndex >= maxIndex}>
          Next ▶
        </button>
        <button type="button" onClick={onJumpToCurrent} className="jump-to-current">
          Recenter
        </button>
      </div>

      <div className="playback-slider">
        <input
          type="range"
          min={0}
          max={Math.max(maxIndex, 0)}
          value={playbackIndex}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>
          {playbackIndex + 1} / {maxIndex + 1}
        </span>
      </div>

      <div className="playback-speed">
        <label htmlFor="tick-rate-select">Tick Rate</label>
        <select
          id="tick-rate-select"
          value={tickRate}
          onChange={(event) => onTickRateChange(Number(event.target.value) as TickRate)}
        >
          {tickRateOptions.map((rate) => (
            <option key={rate} value={rate}>
              {getTickRateLabel(rate)}
            </option>
          ))}
        </select>
      </div>

      <div className="playback-speed">
        <label htmlFor="tick-source-select">Tick Source</label>
        <select
          id="tick-source-select"
          value={tickSource}
          onChange={(event) => onTickSourceChange(event.target.value as Timeframe)}
          disabled={availableTickSources.length <= 1}
        >
          {availableTickSources.map((tf) => (
            <option key={tf} value={tf}>
              {getTimeframeLabel(tf)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default PlaybackControls;