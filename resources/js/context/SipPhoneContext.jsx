import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import JsSIP from 'jssip';
import api from '../api/client';
import { Phone, PhoneCall, PhoneOff, Mic, MicOff, Volume2, UserCheck, AlertCircle } from 'lucide-react';

const SipPhoneContext = createContext(null);

export const SipPhoneProvider = ({ children }) => {
    // SIP UA & Settings state
    const [ua, setUa] = useState(null);
    const [sipStatus, setSipStatus] = useState('offline'); // 'offline' | 'connecting' | 'registered' | 'error'
    const [statusMessage, setStatusMessage] = useState('Disconnected');
    const [credentials, setCredentials] = useState({
        extension: '102',
        password: 'MJt#27766',
        domain: 'auliro010.epbx.bd',
        wssUrl: 'wss://auliro010.epbx.bd/ws',
    });

    // Active Call state
    const [activeSession, setActiveSession] = useState(null);
    const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
    const [callDirection, setCallDirection] = useState('outbound'); // 'outbound' | 'inbound'
    const [callNumber, setCallNumber] = useState('');
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null); // { session, callerNumber, callerName }
    const [customerInfo, setCustomerInfo] = useState(null);

    // Audio & Timer references
    const remoteAudioRef = useRef(null);
    const durationTimerRef = useRef(null);
    const audioContextRef = useRef(null);
    const ringOscillatorRef = useRef(null);
    const ringIntervalRef = useRef(null);
    const pendingOriginateRef = useRef(null); // { targetNumber, timestamp }

    // ----------------------------------------------------
    // Sound Synthesis (Web Audio API - No external files needed)
    // ----------------------------------------------------
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioContextRef.current = new AudioCtx();
            }
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    };

    // Play ringing tone for incoming calls (dual-tone 440Hz + 480Hz)
    const startIncomingRingtone = () => {
        try {
            const ctx = initAudioContext();
            if (!ctx) return;

            stopRingtone();

            const playTone = () => {
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();

                osc1.frequency.value = 440;
                osc2.frequency.value = 480;
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                osc1.start();
                osc2.start();
                osc1.stop(ctx.currentTime + 1.8);
                osc2.stop(ctx.currentTime + 1.8);
            };

            playTone();
            ringIntervalRef.current = setInterval(playTone, 3000);
        } catch (e) {
            console.error('Audio ringtone error:', e);
        }
    };

    // Stop ringing tone
    const stopRingtone = () => {
        if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current);
            ringIntervalRef.current = null;
        }
    };

    // Play DTMF beep
    const playDtmfTone = (digit) => {
        try {
            const ctx = initAudioContext();
            if (!ctx) return;

            const dtmfFreqs = {
                '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
                '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
                '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
                '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
            };

            const freqs = dtmfFreqs[digit] || [440, 480];
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.frequency.value = freqs[0];
            osc2.frequency.value = freqs[1];
            gain.gain.setValueAtTime(0.1, ctx.currentTime);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(ctx.currentTime + 0.12);
            osc2.stop(ctx.currentTime + 0.12);
        } catch (e) {
            // ignore
        }
    };

    // ----------------------------------------------------
    // Duration Timer
    // ----------------------------------------------------
    useEffect(() => {
        if (callState === 'connected') {
            durationTimerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (durationTimerRef.current) clearInterval(durationTimerRef.current);
            if (callState === 'idle') setCallDuration(0);
        }
        return () => {
            if (durationTimerRef.current) clearInterval(durationTimerRef.current);
        };
    }, [callState]);

    // ----------------------------------------------------
    // Load credentials & initialize JsSIP
    // ----------------------------------------------------
    useEffect(() => {
        fetchSettingsAndInit();
        return () => {
            stopRingtone();
            if (ua) ua.stop();
        };
    }, []);

    const fetchSettingsAndInit = async () => {
        try {
            setSipStatus('connecting');
            setStatusMessage('Loading SIP settings...');
            const res = await api.get('/call-center/settings');
            const data = res.data.data;

            const ext = data?.default_extension || '102';
            const pass = data?.extension_password || 'MJt#27766';
            const dom = 'auliro010.epbx.bd';
            const wss = 'wss://auliro010.epbx.bd/ws';

            setCredentials({
                extension: ext,
                password: pass,
                domain: dom,
                wssUrl: wss,
            });

            initJsSIP(ext, pass, dom, wss);
        } catch (err) {
            console.error('Failed to load SIP settings, using default 102:', err);
            initJsSIP('102', 'MJt#27766', 'auliro010.epbx.bd', 'wss://auliro010.epbx.bd/ws');
        }
    };

    const initJsSIP = (extension, password, domain, wssUrl) => {
        try {
            if (ua) {
                ua.stop();
            }

            const socket = new JsSIP.WebSocketInterface(wssUrl);
            const sipUri = `sip:${extension}@${domain}`;

            const configuration = {
                sockets: [socket],
                uri: sipUri,
                password: password,
                display_name: extension,
                register: true,
                register_expires: 300,
                session_timers: false,
                connection_recovery_min_interval: 2,
                connection_recovery_max_interval: 15,
            };

            const newUa = new JsSIP.UA(configuration);

            newUa.on('connecting', () => {
                setSipStatus('connecting');
                setStatusMessage('Connecting to ePBX server...');
            });

            newUa.on('connected', () => {
                setStatusMessage('Connected. Registering extension...');
            });

            newUa.on('disconnected', () => {
                setSipStatus('offline');
                setStatusMessage('Disconnected from server');
            });

            newUa.on('registered', () => {
                setSipStatus('registered');
                setStatusMessage(`Online (${extension}@${domain})`);
            });

            newUa.on('unregistered', () => {
                setSipStatus('offline');
                setStatusMessage('Unregistered');
            });

            newUa.on('registrationFailed', (e) => {
                setSipStatus('error');
                setStatusMessage('Registration Failed: ' + (e?.cause || 'Invalid Credentials'));
                console.error('SIP Registration failed:', e);
            });

            // Handle incoming calls and sessions
            newUa.on('newRTCSession', (data) => {
                const session = data.session;

                if (session.direction === 'incoming') {
                    // Check if this incoming call is from our own recent outbound originate request
                    const isPendingOriginate = pendingOriginateRef.current &&
                        (Date.now() - pendingOriginateRef.current.timestamp < 35000);

                    if (isPendingOriginate) {
                        const target = pendingOriginateRef.current.targetNumber;
                        console.log('[SIP] Originate loopback call received from PBX for target:', target);
                        pendingOriginateRef.current = null;

                        setCallDirection('outbound');
                        setCallNumber(target);
                        setCallState('calling');
                        setStatusMessage(`Connecting to ${target} via ePBX trunk...`);

                        attachSessionListeners(session);

                        const answerOptions = {
                            mediaConstraints: { audio: true, video: false },
                            pcConfig: {
                                iceServers: [
                                    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
                                ]
                            }
                        };

                        try {
                            session.answer(answerOptions);
                            if (remoteAudioRef.current) {
                                remoteAudioRef.current.play().catch(e => console.warn('Audio play policy:', e));
                            }
                        } catch (e) {
                            console.error('Failed to auto-answer originate call:', e);
                        }
                        return;
                    }

                    // Otherwise, genuine incoming call from customer
                    handleIncomingCall(session);
                } else if (session.direction === 'outgoing') {
                    attachSessionListeners(session);
                }
            });

            newUa.start();
            setUa(newUa);
        } catch (err) {
            console.error('Failed to initialize JsSIP:', err);
            setSipStatus('error');
            setStatusMessage('SIP Init Error: ' + err.message);
        }
    };

    // ----------------------------------------------------
    // Incoming Call Handler
    // ----------------------------------------------------
    const handleIncomingCall = async (session) => {
        const callerNum = session.remote_identity?.uri?.user || 'Unknown';
        const callerName = session.remote_identity?.display_name || '';

        setIncomingCall({
            session,
            callerNumber: callerNum,
            callerName: callerName,
        });

        startIncomingRingtone();

        // Customer lookup in CRM
        try {
            const clean = callerNum.replace(/[^0-9]/g, '');
            if (clean.length >= 6) {
                const res = await api.get('/call-center/customer-lookup', { params: { phone: clean } });
                setCustomerInfo(res.data.customer || null);
            }
        } catch (e) {
            // ignore
        }

        attachSessionListeners(session);
    };

    // ----------------------------------------------------
    // Attach Audio & Session Event Listeners
    // ----------------------------------------------------
    const attachSessionListeners = (session) => {
        setActiveSession(session);
        setIsMuted(false);

        // When WebRTC PeerConnection is created
        session.on('peerconnection', (data) => {
            const pc = data?.peerconnection || session.connection;
            if (pc) {
                const attachTrack = (event) => {
                    console.log('[SIP] Remote audio track received:', event);
                    if (remoteAudioRef.current) {
                        if (event.streams && event.streams[0]) {
                            remoteAudioRef.current.srcObject = event.streams[0];
                        } else if (event.track) {
                            remoteAudioRef.current.srcObject = new MediaStream([event.track]);
                        }
                        remoteAudioRef.current.play().catch(e => console.warn('Audio play auto-policy:', e));
                    }
                };

                pc.ontrack = attachTrack;
                pc.addEventListener('track', attachTrack);
            }
        });

        session.on('progress', () => {
            setCallState('ringing');
            setStatusMessage('Ringing...');
        });

        session.on('accepted', () => {
            stopRingtone();
            setIncomingCall(null);
            setCallState('connected');
            setStatusMessage('Connected');
            if (remoteAudioRef.current) {
                remoteAudioRef.current.play().catch(e => console.warn('Audio play auto-policy:', e));
            }
        });

        session.on('confirmed', () => {
            stopRingtone();
            setIncomingCall(null);
            setCallState('connected');
            setStatusMessage('Connected');
            if (remoteAudioRef.current) {
                remoteAudioRef.current.play().catch(e => console.warn('Audio play auto-policy:', e));
            }
        });

        session.on('ended', () => {
            handleCallTermination('completed', session);
        });

        session.on('failed', (e) => {
            handleCallTermination('failed', session, e?.cause || 'Call Failed');
        });
    };

    const handleCallTermination = (status, session, errorMsg = null) => {
        stopRingtone();
        pendingOriginateRef.current = null;
        setCallState('ended');
        setActiveSession(null);
        setIncomingCall(null);

        // Save Call Detail Record to backend
        const phone = session?.remote_identity?.uri?.user || callNumber;
        if (phone && phone.length >= 5) {
            api.post('/call-center/logs', {
                direction: session?.direction || callDirection,
                customer_phone: phone,
                status: status === 'completed' ? 'answered' : 'failed',
                duration_seconds: callDuration,
                notes: errorMsg ? `Call status: ${errorMsg}` : 'WebRTC in-browser call',
            }).catch(e => console.error('Failed to log WebRTC call:', e));
        }

        setTimeout(() => {
            setCallState('idle');
            setCallDuration(0);
        }, 3000);
    };

    // ----------------------------------------------------
    // Public Call Controls
    // ----------------------------------------------------
    const makeCall = async (targetNumber) => {
        if (!ua || sipStatus !== 'registered') {
            alert('SIP Phone is not registered. Status: ' + statusMessage);
            return false;
        }

        const clean = targetNumber.replace(/[^0-9]/g, '');
        if (clean.length < 3) {
            alert('Please enter a valid phone number.');
            return false;
        }

        initAudioContext();
        setCallNumber(clean);
        setCallDirection('outbound');
        setCallState('calling');
        setCallDuration(0);

        if (remoteAudioRef.current) {
            remoteAudioRef.current.play().catch(() => {});
        }

        // Internal PBX Intercom (3-4 digits e.g. 101, 102) -> direct SIP INVITE
        if (clean.length < 7) {
            return dialDirectSip(clean);
        }

        // Outbound PSTN / Mobile Call -> ePBX Originate + WebRTC Bridge
        try {
            pendingOriginateRef.current = {
                targetNumber: clean,
                timestamp: Date.now(),
            };
            setStatusMessage(`Initiating outbound call to ${clean}...`);

            const res = await api.post('/call-center/originate', {
                phone: clean,
                extension: credentials.extension,
            });

            console.log('[Originate OK]', res.data);
            setStatusMessage(`Connecting Extension ${credentials.extension} to ${clean}...`);
            return true;
        } catch (err) {
            console.error('[Originate Error]', err);
            const errorMsg = err.response?.data?.message || err.message;
            pendingOriginateRef.current = null;

            // Fallback to direct SIP dial
            console.warn('Originate API failed, trying direct SIP dial as fallback...');
            setStatusMessage('Calling via direct SIP: ' + errorMsg);
            return dialDirectSip(clean);
        }
    };

    const dialDirectSip = (clean) => {
        const options = {
            mediaConstraints: { audio: true, video: false },
            pcConfig: {
                iceServers: [
                    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
                ]
            }
        };

        const targetUri = `sip:${clean}@${credentials.domain}`;

        try {
            const session = ua.call(targetUri, options);
            attachSessionListeners(session);
            return true;
        } catch (err) {
            console.error('Call origination failed:', err);
            alert('Failed to initiate SIP call: ' + err.message);
            setCallState('idle');
            return false;
        }
    };

    const answerCall = () => {
        if (!incomingCall?.session) return;
        stopRingtone();
        initAudioContext();

        const options = {
            mediaConstraints: { audio: true, video: false },
            pcConfig: {
                iceServers: [
                    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
                ]
            }
        };

        try {
            incomingCall.session.answer(options);
            setCallDirection('inbound');
            setCallNumber(incomingCall.callerNumber);
            setCallState('connected');
            setIncomingCall(null);
        } catch (err) {
            console.error('Failed to answer call:', err);
            setIncomingCall(null);
        }
    };

    const rejectCall = () => {
        stopRingtone();
        if (incomingCall?.session) {
            try {
                incomingCall.session.terminate({
                    status_code: 486,
                    reason_phrase: 'Busy Here'
                });
            } catch (e) {
                // ignore
            }
        }
        setIncomingCall(null);
    };

    const hangupCall = () => {
        stopRingtone();
        pendingOriginateRef.current = null;
        if (activeSession) {
            try {
                activeSession.terminate();
            } catch (e) {
                console.warn('Session terminate error:', e);
            }
        }
        setCallState('ended');
        setActiveSession(null);
        setIncomingCall(null);
        setStatusMessage('Call ended');
    };

    const toggleMute = () => {
        if (!activeSession) return;
        if (isMuted) {
            activeSession.unmute({ audio: true });
            setIsMuted(false);
        } else {
            activeSession.mute({ audio: true });
            setIsMuted(true);
        }
    };

    const sendDTMF = (digit) => {
        playDtmfTone(digit);
        if (activeSession && activeSession.isInProgress()) {
            activeSession.sendDTMF(digit);
        }
    };

    const reconnect = () => {
        fetchSettingsAndInit();
    };

    return (
        <SipPhoneContext.Provider
            value={{
                ua,
                sipStatus,
                statusMessage,
                credentials,
                activeSession,
                callState,
                callDirection,
                callNumber,
                callDuration,
                isMuted,
                incomingCall,
                customerInfo,
                makeCall,
                answerCall,
                rejectCall,
                hangupCall,
                toggleMute,
                sendDTMF,
                reconnect,
            }}
        >
            {/* Hidden HTML5 Audio Element for Remote Audio Playback */}
            <audio ref={remoteAudioRef} autoPlay playsInline />

            {/* Global Floating Incoming Call Alert Modal */}
            {incomingCall && (
                <div className="fixed top-6 right-6 z-50 animate-bounce shadow-2xl">
                    <div className="p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500/80 shadow-emerald-950/60 text-white w-80 backdrop-blur-xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40 animate-pulse">
                                <PhoneCall className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                                    Incoming Call • Ext {credentials.extension}
                                </span>
                                <h3 className="text-base font-extrabold text-white truncate font-mono">
                                    {incomingCall.callerNumber}
                                </h3>
                                {customerInfo && (
                                    <p className="text-xs text-slate-300 truncate font-semibold">
                                        👤 {customerInfo.name}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={answerCall}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-colors"
                            >
                                <Phone className="w-4 h-4" />
                                <span>Answer</span>
                            </button>
                            <button
                                type="button"
                                onClick={rejectCall}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50 transition-colors"
                            >
                                <PhoneOff className="w-4 h-4" />
                                <span>Decline</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {children}
        </SipPhoneContext.Provider>
    );
};

export const useSipPhone = () => {
    const context = useContext(SipPhoneContext);
    if (!context) {
        throw new Error('useSipPhone must be used within a SipPhoneProvider');
    }
    return context;
};

