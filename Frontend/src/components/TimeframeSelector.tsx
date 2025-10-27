import { Timeframe } from '../types/series';

interface TimeframeSelectorProps {
  selectedTimeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  disabled?: boolean;
}

const TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'Daily', 'Weekly', 'Monthly'];

const TimeframeSelector = ({ selectedTimeframe, onTimeframeChange, disabled }: TimeframeSelectorProps) => {
  return (
    <div className="timeframe-selector">
      <label htmlFor="timeframe-select" className="timeframe-label">
        Timeframe:
      </label>
      <select
        id="timeframe-select"
        className="timeframe-select"
        value={selectedTimeframe}
        onChange={(e) => onTimeframeChange(e.target.value as Timeframe)}
        disabled={disabled}
      >
        {TIMEFRAMES.map((tf) => (
          <option key={tf} value={tf}>
            {tf}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimeframeSelector;
