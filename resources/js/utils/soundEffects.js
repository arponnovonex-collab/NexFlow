/**
 * NexFlow Notification & Message Sound Effects
 * Web Audio API synthesized tones (Zero external audio assets required, zero lag, works 100% offline & online)
 */

const STORAGE_KEY = 'nexflow_sound_settings';

const DEFAULT_SETTINGS = {
    incoming_enabled: true,
    outgoing_enabled: true,
    volume: 80, // 0 - 100
};

export const getSoundSettings = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
    } catch (e) {
        // Fallback to defaults
    }
    return DEFAULT_SETTINGS;
};

export const saveSoundSettings = (settings) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save sound settings:', e);
    }
};

const getAudioContext = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!window.__nexflowAudioCtx) {
            window.__nexflowAudioCtx = new AudioCtx();
        }
        if (window.__nexflowAudioCtx.state === 'suspended') {
            window.__nexflowAudioCtx.resume().catch(() => {});
        }
        return window.__nexflowAudioCtx;
    } catch (e) {
        return null;
    }
};

/**
 * Play authentic Incoming Message Chime (Messenger Bell Style)
 */
export const playIncomingMessageSound = (force = false) => {
    const settings = getSoundSettings();
    if (!force && !settings.incoming_enabled) return;

    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const vol = (settings.volume / 100) * 0.25;
        const now = ctx.currentTime;

        // Tone 1: High note (587.33 Hz - D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // Ramp to A5

        gain1.gain.setValueAtTime(vol, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.35);

        // Tone 2: Harmonic shimmer (1174 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(880, now + 0.08);
        osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22);

        gain2.gain.setValueAtTime(0, now);
        gain2.gain.setValueAtTime(vol * 0.4, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(now + 0.08);
        osc2.stop(now + 0.38);
    } catch (e) {
        // Audio might be blocked prior to user interaction
    }
};

/**
 * Play authentic Outgoing Message Swoosh / Pop (Messenger Sent Style)
 */
export const playOutgoingMessageSound = (force = false) => {
    const settings = getSoundSettings();
    if (!force && !settings.outgoing_enabled) return;

    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const vol = (settings.volume / 100) * 0.28;
        const now = ctx.currentTime;

        // Messenger-style ascending quick pop (420Hz -> 880Hz in 70ms)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.14);

        // Subtle soft bubble tap component
        const tap = ctx.createOscillator();
        const tapGain = ctx.createGain();
        tap.type = 'triangle';
        tap.frequency.setValueAtTime(600, now);
        tap.frequency.exponentialRampToValueAtTime(300, now + 0.05);

        tapGain.gain.setValueAtTime(vol * 0.3, now);
        tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        tap.connect(tapGain);
        tapGain.connect(ctx.destination);

        tap.start(now);
        tap.stop(now + 0.05);
    } catch (e) {
        // Audio context error ignore
    }
};
