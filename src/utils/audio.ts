/**
 * Web Audio API helper to programmatically synthesize notification sounds.
 * Avoids loading external MP3 files and works 100% locally and offline.
 */
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    
    // Resume context if suspended (browser autoplay policy security)
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    // Tone 1 (Chime base note)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5 (523Hz)
    gain1.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.15);
    
    // Tone 2 (Higher harmony chime tone played with a 75ms delay)
    setTimeout(() => {
      try {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5 (659Hz)
        gain2.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
        
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.22);
      } catch {}
    }, 75);

  } catch (err) {
    console.warn("Web Audio API blocked or not supported by browser:", err);
  }
}
