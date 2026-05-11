import { useEffect, useState, useRef } from 'react';
import type { WeatherData } from './conditions';
import { PALETTES, degreesToCompass } from './conditions';
import { weatherAudio } from './audio';
import { Volume2, VolumeX, Thermometer, Wind, ArrowUp, MapPin } from 'lucide-react';

interface HUDProps {
  weather: WeatherData;
  status: string;
  onSetCity: (city: string) => Promise<void>;
}

type EditState = 'idle' | 'editing' | 'loading' | 'not-found';

export default function HUD({ weather, status, onSetCity }: HUDProps) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-GB'));
  const [muted, setMuted] = useState(false);
  const [editState, setEditState] = useState<EditState>('idle');
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleMute = () => { weatherAudio.toggle(); setMuted(m => !m); };
  const palette = PALETTES[weather.state];
  const accent = palette.accent;
  const textColor = palette.textColor;
  const shadow = palette.isDark ? '0 1px 6px rgba(0,0,0,0.8)' : 'none';

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB')), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (editState === 'editing') inputRef.current?.select();
  }, [editState]);

  // Sync loading state from parent status
  useEffect(() => {
    if (status === 'fetching' && editState === 'loading') {
      // wait for parent to resolve — handled below
    }
    if (status === 'ready' && editState === 'loading') {
      setEditState('idle');
    }
  }, [status, editState]);

  const startEdit = () => {
    setInput(weather.city ?? '');
    setEditState('editing');
  };

  const cancel = () => {
    setEditState('idle');
    setInput('');
  };

  const commit = async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === (weather.city ?? '').toLowerCase()) {
      cancel();
      return;
    }
    setEditState('loading');
    try {
      await onSetCity(trimmed);
      // editState → 'idle' handled by status effect above
    } catch {
      setEditState('not-found');
      setTimeout(() => setEditState('idle'), 2000);
    }
  };

  const hudStyle = { color: textColor, fontFamily: 'monospace', opacity: 0.85, textShadow: shadow };
  const dimStyle = { ...hudStyle, opacity: 0.7, fontSize: 13 };

  const cityLabel = (() => {
    if (editState === 'loading' || status === 'fetching') return 'LOCATING...';
    if (editState === 'not-found') return 'NOT FOUND';
    return (weather.city ?? 'UNKNOWN').toUpperCase();
  })();

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10 }}>
      <style>{`
        .hud-block { transition: opacity 0.3s ease; pointer-events: auto; }
        .hud-block:hover { opacity: 1 !important; }

        .city-trigger {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          color: inherit;
          letter-spacing: 0.08em;
          text-shadow: inherit;
          border-bottom: 1px solid transparent;
          transition: border-color 0.25s, opacity 0.25s;
        }
        .city-trigger:hover { border-bottom-color: currentColor; }
        .city-trigger:focus-visible {
          outline: 1px solid currentColor;
          outline-offset: 3px;
          border-radius: 1px;
        }

        .city-input {
          background: transparent;
          border: none;
          border-bottom: 1px solid currentColor;
          outline: none;
          font: inherit;
          color: inherit;
          letter-spacing: 0.08em;
          text-shadow: inherit;
          padding: 0;
          width: 180px;
          caret-color: currentColor;
        }
        .city-input::placeholder {
          opacity: 0.35;
          font-style: italic;
        }
        .city-hint {
          font-size: 10px;
          opacity: 0.4;
          letter-spacing: 0.12em;
          margin-top: 3px;
        }
      `}</style>

      {/* Scan lines */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)',
        pointerEvents: 'none',
      }} />

      {/* Corner brackets */}
      {[
        'top-0 left-0 border-t border-l',
        'top-0 right-0 border-t border-r',
        'bottom-0 left-0 border-b border-l',
        'bottom-0 right-0 border-b border-r',
      ].map((cls) => (
        <div key={cls} className={`absolute w-6 h-6 m-3 ${cls}`}
          style={{ borderColor: textColor, opacity: 0.4 }} />
      ))}

      {/* Top-left: city + coordinates */}
      <div className="hud-block absolute top-5 left-5" style={dimStyle}>
        <div style={{ fontSize: 13, opacity: editState === 'not-found' ? 0.7 : 1, marginBottom: 4 }}>
          {editState === 'editing' ? (
            <div>
              <input
                ref={inputRef}
                className="city-input"
                style={{ color: textColor, fontSize: 13 }}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commit(); }
                  if (e.key === 'Escape') cancel();
                }}
                onBlur={cancel}
                placeholder="city, state or country..."
                aria-label="Enter a city, state, or country"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="city-hint" style={{ color: textColor }}>↵ CONFIRM · ESC CANCEL</div>
            </div>
          ) : (
            <button
              className="city-trigger"
              style={{ color: textColor, fontSize: 13 }}
              onClick={startEdit}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') startEdit(); }}
              aria-label={`Current location: ${weather.city ?? 'unknown'}. Click to change.`}
              disabled={editState === 'loading'}
            >
              <MapPin size={12} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.7 }} />
              {cityLabel}
            </button>
          )}
        </div>
        <div aria-hidden="true">{weather.latitude.toFixed(4)}° N</div>
        <div aria-hidden="true">{weather.longitude.toFixed(4)}° E</div>
      </div>

      {/* Top-right: time + condition */}
      <div className="hud-block absolute top-5 right-5 text-right" style={dimStyle}>
        <div style={{ fontSize: 13, opacity: 1 }} aria-live="polite" aria-label={`Current time: ${time}`}>{time}</div>
        <div style={{ marginTop: 2 }}>{weather.state.toUpperCase().replace('-', ' ')}</div>
      </div>

      {/* Bottom-left: temp + wind */}
      <div className="hud-block absolute bottom-5 left-5" style={dimStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Thermometer size={16} strokeWidth={1.5} aria-hidden="true" />
          <span aria-label={`Temperature: ${weather.temperature.toFixed(1)} degrees Celsius`}>
            {weather.temperature.toFixed(1)}°C / {(weather.temperature * 9/5 + 32).toFixed(1)}°F
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
          <Wind size={16} strokeWidth={1.5} aria-hidden="true" />
          <span aria-label={`Wind: ${weather.windspeed} kilometres per hour, ${degreesToCompass(weather.winddirection)}`}>
            {weather.windspeed} km/h
            <ArrowUp
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              style={{ transform: `rotate(${weather.winddirection}deg)`, flexShrink: 0, display: 'inline-block', marginLeft: 5, verticalAlign: 'middle' }}
            />
            {' '}{degreesToCompass(weather.winddirection)}
          </span>
        </div>
      </div>

      {/* Bottom-right: vibe word */}
      <div className="hud-block absolute bottom-5 right-5 text-right" style={{
        ...hudStyle,
        fontSize: 14,
        letterSpacing: '0.2em',
        opacity: 0.6,
      }}>
        {palette.vibe}
      </div>

      {/* Audio toggle */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          style={{ color: textColor, opacity: 0.65, background: 'none', border: 'none', cursor: 'pointer', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

    </div>
  );
}
