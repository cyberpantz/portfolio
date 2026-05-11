// src/experiments/weather-vibe/SettingsPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Palette } from './conditions';
import {
  getSettings, setAudio, setVisuals, resetSettings, useSettings,
  type AudioMultipliers, type VisualMultipliers,
} from './settings';
import { weatherAudio } from './audio';

interface SliderProps {
  label:    string;
  value:    number;        // 0–1
  onChange: (v: number) => void;
  accent?:  string;        // filled track + thumb color (MASTER only)
  textColor: string;
}

function Slider({ label, value, onChange, accent, textColor }: SliderProps) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          color: textColor, fontFamily: 'monospace', fontSize: 9,
          letterSpacing: '0.1em', opacity: accent ? 1 : 0.65,
        }}>
          {label}
        </span>
        <span style={{ color: accent ?? textColor, fontFamily: 'monospace', fontSize: 9, opacity: 0.75 }}>
          {pct}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={e => onChange(Number(e.target.value) / 100)}
        className="sv-slider"
        style={{ color: accent ?? `rgba(176,192,208,0.7)` }}
      />
    </div>
  );
}

export interface SettingsPanelProps {
  palette:           Palette;
  activeLayerLabels: string;
}

export default function SettingsPanel({ palette, activeLayerLabels }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef        = useRef<HTMLDivElement>(null);
  const settings        = useSettings();
  const { textColor, accent } = palette;

  // Close when clicking outside the panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleAudio(key: keyof AudioMultipliers, v: number) {
    setAudio({ [key]: v } as Partial<AudioMultipliers>);
    weatherAudio.setAudioMultipliers(getSettings().audio);
  }

  function handleVisuals(key: keyof VisualMultipliers, v: number) {
    setVisuals({ [key]: v } as Partial<VisualMultipliers>);
  }

  function handleReset() {
    resetSettings();
    weatherAudio.setAudioMultipliers(getSettings().audio);
  }

  const dimBorder = `rgba(176,192,208,0.08)`;

  return (
    <>
      {/* Range input styles — cannot be set inline */}
      <style>{`
        .sv-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 2px;
          background: rgba(176,192,208,0.12);
          border-radius: 1px;
          outline: none;
          cursor: pointer;
        }
        .sv-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: currentColor;
          margin-top: -4px;
          cursor: pointer;
        }
        .sv-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: currentColor;
          border: none;
          cursor: pointer;
        }
      `}</style>

      {/* Trigger pill — bottom-center, below the mute button */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: 10, pointerEvents: 'auto', zIndex: 20 }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close settings' : 'Open settings'}
          style={{
            background: open ? 'rgba(4,6,14,0.65)' : 'rgba(176,192,208,0.07)',
            border: `1px solid rgba(176,192,208,${open ? 0.25 : 0.14})`,
            borderRadius: 12,
            padding: '3px 14px',
            color: textColor,
            fontFamily: 'monospace',
            fontSize: 9,
            letterSpacing: '0.15em',
            opacity: open ? 0.9 : 0.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'opacity 0.2s, background 0.2s',
          }}
        >
          ⚙ SETTINGS
        </button>
      </div>

      {/* Scene dim overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ background: 'rgba(0,0,0,0.35)', pointerEvents: 'none', zIndex: 19 }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className="absolute bottom-0 left-0 right-0"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            style={{
              background: 'rgba(4,6,14,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderTop: `1px solid rgba(176,192,208,0.12)`,
              zIndex: 25,
              pointerEvents: 'auto',
            }}
          >
            {/* Drag-handle bar */}
            <div style={{
              width: 32, height: 3,
              background: 'rgba(176,192,208,0.22)',
              borderRadius: 2,
              margin: '12px auto 14px',
            }} />

            <div style={{ padding: '0 20px 18px' }}>
              {/* Two-column layout */}
              <div style={{ display: 'flex', gap: 20 }}>

                {/* ── Audio ── */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: textColor, fontFamily: 'monospace', fontSize: 8,
                    letterSpacing: '0.2em', opacity: 0.45,
                    marginBottom: 12, paddingBottom: 6,
                    borderBottom: `1px solid ${dimBorder}`,
                  }}>AUDIO</div>

                  <Slider label="MASTER"   value={settings.audio.master}  accent={accent} textColor={textColor} onChange={v => handleAudio('master',  v)} />
                  <Slider label="AMBIENT"  value={settings.audio.ambient}  textColor={textColor} onChange={v => handleAudio('ambient',  v)} />
                  <Slider label="EFFECTS"  value={settings.audio.effects}  textColor={textColor} onChange={v => handleAudio('effects',  v)} />
                  <Slider label="CITY HUM" value={settings.audio.cityHum}  textColor={textColor} onChange={v => handleAudio('cityHum',  v)} />
                </div>

                {/* Divider */}
                <div style={{ width: 1, background: dimBorder }} />

                {/* ── Visuals ── */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: textColor, fontFamily: 'monospace', fontSize: 8,
                    letterSpacing: '0.2em', opacity: 0.45,
                    marginBottom: 12, paddingBottom: 6,
                    borderBottom: `1px solid ${dimBorder}`,
                  }}>VISUALS</div>

                  <Slider label="BLOOM"       value={settings.visuals.bloom}    textColor={textColor} onChange={v => handleVisuals('bloom',    v)} />
                  <Slider label="VIGNETTE"    value={settings.visuals.vignette}  textColor={textColor} onChange={v => handleVisuals('vignette',  v)} />
                  <Slider label="GRAIN"       value={settings.visuals.grain}     textColor={textColor} onChange={v => handleVisuals('grain',     v)} />
                  <Slider label="ABERRATION"  value={settings.visuals.ca}        textColor={textColor} onChange={v => handleVisuals('ca',        v)} />
                </div>
              </div>

              {/* Footer: active layers + reset */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 14, paddingTop: 10,
                borderTop: `1px solid rgba(176,192,208,0.06)`,
              }}>
                <span style={{
                  color: textColor, fontFamily: 'monospace',
                  fontSize: 8, letterSpacing: '0.1em', opacity: 0.3,
                }}>
                  {activeLayerLabels}
                </span>
                <button
                  onClick={handleReset}
                  style={{
                    background: 'none',
                    border: `1px solid rgba(176,192,208,0.15)`,
                    color: textColor,
                    fontFamily: 'monospace',
                    fontSize: 8,
                    letterSpacing: '0.12em',
                    padding: '4px 10px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    opacity: 0.55,
                  }}
                >
                  RESET
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
