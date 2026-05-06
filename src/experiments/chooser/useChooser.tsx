"use client";
import { useEffect, useRef, useCallback } from "react";

type Curve = "linear" | "ease" | "sharp";

export type UseChooserOpts = {
  /** URLs to your audio files */
  leftAudioUrl: string;
  rightAudioUrl: string;

  /** Optional container to listen for pointer moves; defaults to window */
  stageRef?: React.RefObject<HTMLElement>;

  /** Pixels of sensitivity around each element (default 260) */
  radius?: number;

  /** Scaling behavior (defaults: 1, 1.5, 3) */
  minScale?: number;
  midScale?: number;
  maxScale?: number;

  /** Audio curve shaping for proximity (default "ease") */
  curve?: Curve;

  /** Start audio automatically on first pointerdown inside stage (default false) */
  startOnFirstInteraction?: boolean;

  /** If your element already has transform, append scale instead of replacing (default "append") */
  transformMode?: "append" | "replace";
};

export function useChooser(
  leftElRef: React.RefObject<HTMLElement>,
  rightElRef: React.RefObject<HTMLElement>,
  opts: UseChooserOpts
) {
  const {
    leftAudioUrl,
    rightAudioUrl,
    stageRef,
    radius = 260,
    minScale = 1,
    midScale = 1.5,
    maxScale = 3,
    curve = "ease",
    startOnFirstInteraction = false,
    transformMode = "append",
  } = opts;

  // --- audio plumbing ---
  const ctxRef = useRef<AudioContext | null>(null);
  const leftGainRef = useRef<GainNode | null>(null);
  const rightGainRef = useRef<GainNode | null>(null);
  const leftAudioRef = useRef<HTMLAudioElement | null>(null);
  const rightAudioRef = useRef<HTMLAudioElement | null>(null);
  const leftSrcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rightSrcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const startedRef = useRef(false);

  // original transforms so we can append scale
  const leftBaseTransform = useRef<string>("");
  const rightBaseTransform = useRef<string>("");

  // requestAnimationFrame throttling
  const rafRef = useRef<number | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const shape = (t: number, mode: Curve) => {
    if (mode === "linear") return t;
    if (mode === "sharp") return Math.pow(t, 2.2);
    // ease: gentle S-curve
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const centerOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const applyScale = useCallback(
    (el: HTMLElement, base: string, s: number) => {
      if (transformMode === "replace") {
        el.style.transform = `scale(${s})`;
      } else {
        // append to existing transform
        el.style.transform = `${base} scale(${s})`;
      }
      el.style.transformOrigin = "center center";
      el.style.willChange = "transform";
      el.style.transition = el.style.transition || "transform .12s ease";
    },
    [transformMode]
  );

  const setZ = (el: HTMLElement, z: number) => {
    el.style.position = el.style.position || "relative";
    el.style.zIndex = String(z);
  };

  const startAudio = useCallback(async () => {
    if (startedRef.current) return;

    // Extend Window type to include AudioContext and webkitAudioContext
    interface WindowWithWebkitAudioContext extends Window {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    }
    const win = window as WindowWithWebkitAudioContext;
    const AudioContextClass = win.AudioContext || win.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio API is not supported in this browser.");
    }
    const ctx = new AudioContextClass();
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    leftGain.gain.value = 0;
    rightGain.gain.value = 0;
    leftGain.connect(ctx.destination);
    rightGain.connect(ctx.destination);

    const leftEl = new Audio(leftAudioUrl);
    const rightEl = new Audio(rightAudioUrl);
    leftEl.loop = true; rightEl.loop = true;
    leftEl.crossOrigin = "anonymous"; rightEl.crossOrigin = "anonymous";

    const leftSrc = ctx.createMediaElementSource(leftEl);
    const rightSrc = ctx.createMediaElementSource(rightEl);
    leftSrc.connect(leftGain);
    rightSrc.connect(rightGain);

    // Some browsers need resume() inside a gesture; caller controls when this runs
    try { await ctx.resume(); } catch {}

    // Start playback (will start muted, we control gain)
    // If this throws, user likely hasn't interacted yet.
    try { await leftEl.play(); } catch {}
    try { await rightEl.play(); } catch {}

    ctxRef.current = ctx;
    leftGainRef.current = leftGain;
    rightGainRef.current = rightGain;
    leftAudioRef.current = leftEl;
    rightAudioRef.current = rightEl;
    leftSrcRef.current = leftSrc;
    rightSrcRef.current = rightSrc;
    startedRef.current = true;
  }, [leftAudioUrl, rightAudioUrl]);

  // optional auto-start on first interaction
  useEffect(() => {
    if (!startOnFirstInteraction) return;
    const stage = stageRef?.current ?? document.body;
    const handler = async () => {
      if (!startedRef.current) {
        try { await startAudio(); } catch {}
      }
    };
    stage.addEventListener("pointerdown", handler, { once: true, passive: true });
    return () => stage.removeEventListener("pointerdown", handler);
  }, [startOnFirstInteraction, stageRef, startAudio]);

  // cleanup audio on unmount
  useEffect(() => {
    return () => {
      try { leftAudioRef.current?.pause(); } catch {}
      try { rightAudioRef.current?.pause(); } catch {}
      try { ctxRef.current?.close(); } catch {}
    };
  }, []);

  // main pointer logic
  useEffect(() => {
    const leftEl = leftElRef.current;
    const rightEl = rightElRef.current;
    if (!leftEl || !rightEl) return;

    // remember base transforms to append scale nicely
    leftBaseTransform.current = getComputedStyle(leftEl).transform === "none" ? "" : getComputedStyle(leftEl).transform;
    rightBaseTransform.current = getComputedStyle(rightEl).transform === "none" ? "" : getComputedStyle(rightEl).transform;

    // ensure they start at minScale
    applyScale(leftEl, leftBaseTransform.current, minScale);
    applyScale(rightEl, rightBaseTransform.current, minScale);
    setZ(leftEl, 1);
    setZ(rightEl, 1);

    const stage = stageRef?.current;

    const onMove = (e: PointerEvent | MouseEvent | TouchEvent) => {
      // throttle to rAF
      const assignPoint = (clientX: number, clientY: number) => {
        lastPoint.current = { x: clientX, y: clientY };
        if (rafRef.current == null) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      if ("touches" in e && e.touches[0]) {
        assignPoint(e.touches[0].clientX, e.touches[0].clientY);
      } else if ("clientX" in e) {
        assignPoint((e as PointerEvent).clientX, (e as PointerEvent).clientY);
      }
    };

    const onLeave = () => {
      // fade scales back to min when cursor leaves stage
      applyScale(leftEl, leftBaseTransform.current, minScale);
      applyScale(rightEl, rightBaseTransform.current, minScale);
      setZ(leftEl, 1); setZ(rightEl, 1);

      // also mute audio smoothly
      const ctx = ctxRef.current;
      const lg = leftGainRef.current, rg = rightGainRef.current;
      if (ctx && lg && rg) {
        lg.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        rg.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
    };

    const tick = () => {
      rafRef.current = null;
      if (!lastPoint.current) return;

      const { x, y } = lastPoint.current;

      const L = centerOf(leftEl);
      const R = centerOf(rightEl);
      const dL = Math.hypot(x - L.x, y - L.y);
      const dR = Math.hypot(x - R.x, y - R.y);

      const pL = dL <= radius ? 1 - dL / radius : 0;
      const pR = dR <= radius ? 1 - dR / radius : 0;
      const sum = pL + pR;

      // --- scaling (visual) ---
      if (sum > 0) {
        const wL = pL / sum; // dominance weights
        const wR = pR / sum;

        const sL = lerp(midScale, maxScale, wL) + lerp(midScale, minScale, wR) - midScale;
        const sR = lerp(midScale, maxScale, wR) + lerp(midScale, minScale, wL) - midScale;

        applyScale(leftEl, leftBaseTransform.current, sL);
        applyScale(rightEl, rightBaseTransform.current, sR);
        setZ(leftEl, sL > sR ? 2 : 1);
        setZ(rightEl, sR > sL ? 2 : 1);
      } else {
        applyScale(leftEl, leftBaseTransform.current, minScale);
        applyScale(rightEl, rightBaseTransform.current, minScale);
        setZ(leftEl, 1); setZ(rightEl, 1);
      }

      // --- audio ---
      const ctx = ctxRef.current;
      const lg = leftGainRef.current, rg = rightGainRef.current;
      if (ctx && lg && rg) {
        let gL = 0, gR = 0;
        if (sum > 0) {
          const relL = pL / sum;
          const relR = pR / sum;
          const overall = Math.max(pL, pR);
          const shaped = shape(overall, curve);
          gL = relL * shaped;
          gR = relR * shaped;
        }
        lg.gain.setTargetAtTime(gL, ctx.currentTime, 0.02);
        rg.gain.setTargetAtTime(gR, ctx.currentTime, 0.02);
      }
    };

    // attach listeners
    if (stage) {
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("touchmove", onMove, { passive: true });
      stage.addEventListener("pointerleave", onLeave);
    } else {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("touchmove", onMove, { passive: true });
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastPoint.current = null;

      if (stage) {
        stage.removeEventListener("pointermove", onMove as EventListener);
        stage.removeEventListener("touchmove", onMove as EventListener);
        stage.removeEventListener("pointerleave", onLeave as EventListener);
      } else {
        window.removeEventListener("pointermove", onMove as EventListener);
        window.removeEventListener("touchmove", onMove as EventListener);
      }

      // restore transforms
      if (leftEl) {
        leftEl.style.transform = leftBaseTransform.current || "";
        setZ(leftEl, 1);
      }
      if (rightEl) {
        rightEl.style.transform = rightBaseTransform.current || "";
        setZ(rightEl, 1);
      }
    };
  }, [
    leftElRef,
    rightElRef,
    stageRef,
    radius,
    minScale,
    midScale,
    maxScale,
    curve,
    transformMode,
    applyScale,
  ]);

  return { startAudio };
}
