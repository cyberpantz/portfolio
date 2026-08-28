import { useEffect, useState } from 'react';
import type React from 'react';
import type { WeatherData } from './conditions';
import { PALETTES, degreesToCompass } from './conditions';
import { Thermometer, Wind, ArrowUp, MapPin } from 'lucide-react';

interface HUDProps {
  weather: WeatherData;
  status: string;
  onOpenGlobe: () => void;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_GRADIENT: Record<Corner, React.CSSProperties> = {
  tl: { top: 0, left: 0,    background: 'radial-gradient(ellipse at top left,    rgba(0,0,0,0.45) 0%, transparent 65%)' },
  tr: { top: 0, right: 0,   background: 'radial-gradient(ellipse at top right,   rgba(0,0,0,0.45) 0%, transparent 65%)' },
  bl: { bottom: 0, left: 0, background: 'radial-gradient(ellipse at bottom left,  rgba(0,0,0,0.45) 0%, transparent 65%)' },
  br: { bottom: 0, right: 0,background: 'radial-gradient(ellipse at bottom right, rgba(0,0,0,0.45) 0%, transparent 65%)' },
};

export default function HUD({ weather, status, onOpenGlobe }: HUDProps) {
  const tz = weather.timezone;
  const fmt = (d: Date) => d.toLocaleTimeString('en-GB', tz ? { timeZone: tz } : undefined);
  const [time, setTime] = useState(() => fmt(new Date()));
  const [hoveredCorner, setHoveredCorner] = useState<Corner | null>(null);

  const palette = PALETTES[weather.state];
  const textColor = palette.textColor;
  const shadow = palette.isDark ? '0 1px 6px rgba(0,0,0,0.8)' : 'none';

  useEffect(() => {
    const id = setInterval(() => setTime(fmt(new Date())), 1000);
    return () => clearInterval(id);
  }, [tz]); // restart interval if timezone changes (city switch)

  const hudStyle = { color: textColor, fontFamily: 'monospace', opacity: 0.85, textShadow: shadow };
  const dimStyle = { ...hudStyle, opacity: 0.7, fontSize: 13, transition: 'opacity 0.4s ease, color 0.4s ease' };
  const activeStyle = (c: Corner) => ({
    ...dimStyle,
    opacity:  hoveredCorner === c ? 1 : 0.7,
    color:    hoveredCorner === c ? '#ffffff' : textColor,
  });

  const cityLabel = (() => {
    if (status === 'fetching') return 'LOCATING...';
    return (weather.city ?? 'UNKNOWN').toUpperCase();
  })();

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10 }}>
      <style>{`
        .hud-block { pointer-events: auto; }

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

      {/* Corner hover gradients */}
      {(['tl', 'tr', 'bl', 'br'] as Corner[]).map(c => (
        <div key={c} style={{
          position: 'absolute',
          width: 300, height: 220,
          ...CORNER_GRADIENT[c],
          opacity: hoveredCorner === c ? 1 : 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Top-left: city + coordinates */}
      <div className="hud-block absolute top-5 left-5" style={activeStyle('tl')}
        onMouseEnter={() => setHoveredCorner('tl')}
        onMouseLeave={() => setHoveredCorner(null)}
      >
        <div style={{ fontSize: 13, opacity: 1, marginBottom: 4 }}>
          <button
            className="city-trigger"
            style={{ color: textColor, fontSize: 13 }}
            onClick={onOpenGlobe}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenGlobe(); }}
            aria-label={`Current location: ${weather.city ?? 'unknown'}. Click to change.`}
            disabled={status === 'fetching'}
          >
            <MapPin size={12} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.7 }} />
            {cityLabel}
          </button>
        </div>
        <div aria-hidden="true">{weather.latitude.toFixed(4)}° N</div>
        <div aria-hidden="true">{weather.longitude.toFixed(4)}° E</div>
      </div>

      {/* Top-right: time + condition */}
      <div className="hud-block absolute top-5 right-5 text-right" style={activeStyle('tr')}
        onMouseEnter={() => setHoveredCorner('tr')}
        onMouseLeave={() => setHoveredCorner(null)}
      >
        <div style={{ fontSize: 13, opacity: 1 }} aria-live="polite" aria-label={`Current time: ${time}`}>{time}</div>
        <div style={{ marginTop: 2 }}>{weather.state.toUpperCase().replace('-', ' ')}</div>
      </div>

      {/* Bottom-left: temp + wind */}
      <div className="hud-block absolute bottom-5 left-5" style={activeStyle('bl')}
        onMouseEnter={() => setHoveredCorner('bl')}
        onMouseLeave={() => setHoveredCorner(null)}
      >
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
      <div className="hud-block absolute bottom-5 right-5 text-right"
        onMouseEnter={() => setHoveredCorner('br')}
        onMouseLeave={() => setHoveredCorner(null)}
        style={{
        ...hudStyle,
        fontSize: 14,
        letterSpacing: '0.2em',
        opacity:  hoveredCorner === 'br' ? 1 : 0.6,
        color:    hoveredCorner === 'br' ? '#ffffff' : textColor,
        transition: 'opacity 0.4s ease, color 0.4s ease',
      }}>
        {palette.vibe}
      </div>

      {/* The audio toggle used to float here, bottom-centre. It has moved to
          the top of the settings panel's AUDIO column, next to the volume
          sliders it belongs with — one place for sound rather than a lone
          icon hovering over the scene. */}

    </div>
  );
}
