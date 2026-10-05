// Live-camera QR scanner hook for the Verification page.
// Uses native BarcodeDetector on Android Chrome; elsewhere (iOS never ships one)
// a lazy ZXing-wasm ponyfill with the same interface. Camera is phone-only and
// always stopped on exit so the camera light never lingers.

import { useCallback, useEffect, useRef, useState } from 'react';
// Self-hosted WASM (no CDN); `?url` gives a fingerprinted URL without bundling the ~1MiB binary.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { parseShortCode, isInAppBrowser } from './qrScan.util.js';

const SCAN_INTERVAL_MS = 140; // ~7fps, snappy lock, battery-safe
const MAX_FRAME_WIDTH = 640; // downscale before detect() for WASM perf
const CONSENSUS = 2; // identical validated decodes required before accepting

// status: 'idle' | 'unsupported' | 'insecure' | 'inapp' | 'requesting'
//       | 'preparing' | 'scanning' | 'denied' | 'nocamera' | 'busy' | 'error'
// phase (while scanning): 'searching' | 'sighted' | 'locked'
export default function useQrScanner(onDetect) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const detectorRef = useRef(null);
  const canvasRef = useRef(null); // offscreen frame buffer
  const busyRef = useRef(false);
  const consensusRef = useRef({ last: null, count: 0 });
  const lastTsRef = useRef(0);
  const wasScanningRef = useRef(false);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const [status, setStatus] = useState('idle');
  const [phase, setPhase] = useState('searching');
  const [error, setError] = useState(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const getTrack = () => streamRef.current?.getVideoTracks?.()[0] || null;

  const stopLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const stop = useCallback(() => {
    wasScanningRef.current = false;
    stopLoop();
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop()); // turns the camera light OFF
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchSupported(false);
    setTorchOn(false);
    consensusRef.current = { last: null, count: 0 };
    // Reset only healthy sessions to 'idle'; keep failure states so the retry UI still shows why.
    setStatus((s2) => (s2 === 'scanning' || s2 === 'requesting' || s2 === 'preparing' ? 'idle' : s2));
  }, []);

  // Build a detector: native when it truly supports qr_code, else WASM ponyfill.
  const makeDetector = async () => {
    if ('BarcodeDetector' in window) {
      try {
        const fmts = await window.BarcodeDetector.getSupportedFormats();
        if (fmts.includes('qr_code')) {
          return new window.BarcodeDetector({ formats: ['qr_code'] });
        }
      } catch { /* fall through to WASM */ }
    }
    setStatus('preparing'); // first non-Android scan fetches the WASM binary
    const mod = await import('barcode-detector/ponyfill');
    mod.setZXingModuleOverrides({
      locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    });
    return new mod.BarcodeDetector({ formats: ['qr_code'] });
  };

  const handleResults = (results) => {
    const co = consensusRef.current;
    let code = null;
    if (results && results.length) {
      for (const r of results) {
        const c = parseShortCode(r.rawValue);
        if (c) { code = c; break; }
      }
    }

    if (!code) {
      // No valid DocLoq code this frame → reset consensus (strict, favors zero-FP).
      co.last = null;
      co.count = 0;
      setPhase('searching');
      return;
    }

    setPhase('sighted');
    if (code === co.last) co.count += 1;
    else { co.last = code; co.count = 1; }

    if (co.count >= CONSENSUS) {
      setPhase('locked');
      stop(); // lock + stop BEFORE verifying so no second detection can fire
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch { /* Android only */ } }
      onDetectRef.current?.(code);
    }
  };

  const tick = useCallback((ts) => {
    rafRef.current = requestAnimationFrame(tick);
    if (ts - lastTsRef.current < SCAN_INTERVAL_MS) return;
    lastTsRef.current = ts;

    const v = videoRef.current;
    const detector = detectorRef.current;
    if (!v || !detector || busyRef.current || v.readyState < 2) return;
    if (!v.videoWidth) return;

    const scale = Math.min(1, MAX_FRAME_WIDTH / v.videoWidth);
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    let canvas = canvasRef.current;
    if (!canvas) { canvas = document.createElement('canvas'); canvasRef.current = canvas; }
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, w, h);

    busyRef.current = true;
    detector
      .detect(canvas)
      .then(handleResults)
      .catch(() => { /* transient decode error, ignore, keep scanning */ })
      .finally(() => { busyRef.current = false; });
  // handleResults/stop are stable enough; deps kept minimal on purpose.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (streamRef.current) return; // already running

    if (typeof window === 'undefined' || !window.isSecureContext) {
      setStatus('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      // getUserMedia missing, most common inside blocking in-app webviews.
      setStatus(isInAppBrowser() ? 'inapp' : 'unsupported');
      return;
    }

    setStatus('requesting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus(isInAppBrowser() ? 'inapp' : 'denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        // Retry once without the rear-camera constraint.
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (err2) {
          setStatus(err2?.name === 'NotFoundError' ? 'nocamera' : 'error');
          setError(err2?.message || String(err2));
          return;
        }
      } else {
        setStatus('error');
        setError(err?.message || String(err));
        return;
      }
      if (!stream) return;
    }

    streamRef.current = stream;
    const v = videoRef.current;
    if (!v) { stop(); return; }
    v.srcObject = stream;
    v.setAttribute('playsinline', 'true');
    v.muted = true;
    try {
      await v.play();
    } catch { /* autoplay quirk, the loop tolerates a not-yet-playing video */ }

    // Torch capability, query AFTER play (getCapabilities can be empty if too early).
    try {
      const caps = getTrack()?.getCapabilities?.() || {};
      setTorchSupported(!!caps.torch);
    } catch { setTorchSupported(false); }

    try {
      if (!detectorRef.current) detectorRef.current = await makeDetector();
    } catch (err) {
      setStatus('error');
      setError('Scanner engine failed to load: ' + (err?.message || err));
      stop();
      return;
    }

    consensusRef.current = { last: null, count: 0 };
    setPhase('searching');
    setStatus('scanning');
    wasScanningRef.current = true;
    lastTsRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [stop, tick]);

  const toggleTorch = useCallback(async () => {
    const track = getTrack();
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch { /* torch not applicable */ }
  }, [torchOn]);

  // Release camera when backgrounded (iOS kills tracks); re-acquire only if we were scanning.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (streamRef.current) { wasScanningRef.current = true; stop(); }
      } else if (wasScanningRef.current && !streamRef.current) {
        start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [start, stop]);

  // Hard cleanup on unmount, never leak the camera.
  useEffect(() => () => stop(), [stop]);

  return { videoRef, status, phase, error, torchSupported, torchOn, toggleTorch, start, stop };
}
