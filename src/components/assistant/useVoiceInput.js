import { useCallback, useEffect, useRef, useState } from 'react';
import { aiService } from '@/api/services/ai';

// Voice input: MediaRecorder → POST /ai/transcribe (Whisper proxy) → text.
// ONE implementation for every shell (the old page and widget each had a
// copy-pasted version of this; audit "voice implemented twice").
export function useVoiceInput({ language = 'uz', onText } = {}) {
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    && typeof window !== 'undefined' && !!window.MediaRecorder;

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const cancelRef = useRef(false);
  const timerRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);

  const cleanup = useCallback(() => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setSeconds(0);
  }, []);

  useEffect(() => () => {
    cancelRef.current = true;
    try { if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop(); } catch { /* ignore */ }
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (!supported || recording || transcribing) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelRef.current = false;
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        chunksRef.current = [];
        cleanup();
        if (cancelRef.current || !blob.size) return;
        setTranscribing(true);
        try {
          const res = await aiService.transcribe(blob, language);
          const text = (res?.text || '').trim();
          if (text) onText?.(text);
          else setError("Ovoz aniqlanmadi, qayta urinib ko'ring");
        } catch (err) {
          const code = err?.response?.data?.error?.code;
          setError(code === 'transcription_unavailable'
            ? err.response.data.error.message
            : "Transkripsiya ishlamadi");
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      cleanup();
      setError('Mikrofonga ruxsat berilmadi — brauzer sozlamalarini tekshiring');
    }
  }, [supported, recording, transcribing, language, onText, cleanup]);

  const send = useCallback(() => {
    cancelRef.current = false;
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop(); } catch { /* ignore */ }
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop(); } catch { /* ignore */ }
    cleanup();
  }, [cleanup]);

  return { supported, recording, transcribing, seconds, error, start, send, cancel, clearError: () => setError(null) };
}

export default useVoiceInput;
