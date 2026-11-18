import React, { useState } from 'react';
import { useSipPhone } from '../../context/SipPhoneContext';
import {
    Phone,
    PhoneCall,
    PhoneOff,
    Mic,
    MicOff,
    Volume2,
    User,
    Minus,
    Maximize2,
    ExternalLink,
    Hash,
    Radio,
    Clock,
    RefreshCw,
    X,
    PhoneForwarded,
} from 'lucide-react';

export const FloatingCallWidget = () => {
    const {
        callState,
        callDirection,
        callNumber,
        callDuration,
        isMuted,
        customerInfo,
        statusMessage,
        credentials,
        hangupCall,
        toggleMute,
        sendDTMF,
        makeCall,
        serverOriginateCall,
    } = useSipPhone();

    const [isMinimized, setIsMinimized] = useState(false);
    const [showKeypad, setShowKeypad] = useState(false);
    const [serverCalling, setServerCalling] = useState(false);

    // If phone is idle, don't show the widget
    if (callState === 'idle') {
        return null;
    }

    const formatTimer = (seconds) => {
        const m = Math.floor(seconds / 60)
            .toString()
            .padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const isConnected = callState === 'connected';
    const isCalling = callState === 'calling' || callState === 'ringing';
    const isEnded = callState === 'ended';

    const customerDisplayName = customerInfo?.name || 'সম্মানিত গ্রাহক';

    const keypadKeys = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['*', '0', '#'],
    ];

    const handleServerCall = async () => {
        if (!callNumber || serverCalling) return;
        setServerCalling(true);
        try {
            const res = await serverOriginateCall(callNumber);
            alert(res.message || 'সার্ভার কল শুরু হয়েছে!');
        } catch (e) {
            alert('সার্ভার কল ব্যর্থ হয়েছে');
        } finally {
            setServerCalling(false);
        }
    };

    const handleRedial = () => {
        if (callNumber) {
            makeCall(callNumber, customerInfo);
        }
    };

    // Minimized Floating Pill View
    if (isMinimized) {
        return (
            <div className="fixed bottom-5 right-5 z-[9999] animate-in fade-in slide-in-from-bottom-3 duration-200">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900/95 border-2 border-indigo-500/80 shadow-2xl shadow-indigo-950/60 backdrop-blur-xl text-white">
                    <div
                        className={`w-3 h-3 rounded-full shrink-0 ${
                            isConnected
                                ? 'bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20'
                                : isCalling
                                ? 'bg-amber-400 animate-ping'
                                : 'bg-rose-400'
                        }`}
                    />

                    <button
                        type="button"
                        onClick={() => setIsMinimized(false)}
                        className="text-left cursor-pointer flex items-center gap-2 hover:opacity-90"
                        title="ম্যাক্সিমাইজ করুন"
                    >
                        <span className="text-xs font-bold truncate max-w-[120px]">
                            {customerDisplayName}
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                            {formatTimer(callDuration)}
                        </span>
                    </button>

                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                        <button
                            type="button"
                            onClick={() => setIsMinimized(false)}
                            className="p-1 rounded-md hover:bg-slate-800 text-slate-300 cursor-pointer"
                            title="বড় করুন"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={hangupCall}
                            className="p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow cursor-pointer"
                            title="কল শেষ করুন"
                        >
                            <PhoneOff className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Expanded Floating Card View
    return (
        <div className="fixed bottom-5 right-5 z-[9999] w-88 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="rounded-2xl bg-slate-900/95 border-2 border-indigo-500/70 shadow-2xl shadow-indigo-950/80 backdrop-blur-xl text-white p-4 space-y-3.5 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isConnected
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : isCalling
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                        >
                            <PhoneCall className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-white truncate flex items-center gap-1.5">
                                <span>ePBX WebPhone</span>
                                <span className="text-[10px] font-mono text-indigo-300 font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 border border-indigo-500/30">
                                    Ext {credentials.extension}
                                </span>
                            </h4>
                            <span className="text-[10px] text-slate-400 block truncate">
                                {callDirection === 'outbound' ? 'আউটবাউন্ড কল' : 'ইনকামিং কল'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <a
                            href={`/call-center/ip-call?phone=${encodeURIComponent(callNumber || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="নতুন ট্যাবে ফুল ডায়লার খুলুন"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                            type="button"
                            onClick={() => setIsMinimized(true)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="মিনিমাইজ করুন"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Customer Information & Live Status Banner */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate">{customerDisplayName}</span>
                            </span>
                            <span className="text-sm font-mono font-black text-indigo-300 block mt-0.5 tracking-wider">
                                {callNumber}
                            </span>
                        </div>

                        <div className="text-right shrink-0">
                            <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                    isConnected
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                        : isCalling
                                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse'
                                        : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        isConnected
                                            ? 'bg-emerald-400'
                                            : isCalling
                                            ? 'bg-amber-400'
                                            : 'bg-rose-400'
                                    }`}
                                />
                                {isConnected
                                    ? 'কথা বলা চলছে'
                                    : callState === 'ringing'
                                    ? 'রিং হচ্ছে...'
                                    : callState === 'calling'
                                    ? 'ডায়াল হচ্ছে...'
                                    : 'কল শেষ'}
                            </span>
                            <div className="font-mono text-base font-black text-emerald-400 mt-1 flex items-center justify-end gap-1">
                                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{formatTimer(callDuration)}</span>
                            </div>
                        </div>
                    </div>

                    {statusMessage && (
                        <p className="text-[11px] text-slate-300 pt-1.5 border-t border-slate-800 flex items-center gap-1 font-medium">
                            <Radio className="w-3 h-3 text-indigo-400 shrink-0 animate-pulse" />
                            <span className="truncate">{statusMessage}</span>
                        </p>
                    )}
                </div>

                {/* Keypad Drawer (DTMF) */}
                {showKeypad && !isEnded && (
                    <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 animate-in fade-in duration-150">
                        <div className="grid grid-cols-3 gap-1.5">
                            {keypadKeys.flat().map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => sendDTMF(key)}
                                    className="py-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-200 hover:text-white font-mono font-bold text-xs border border-slate-700/60 transition-colors cursor-pointer"
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons Toolbar */}
                {isEnded ? (
                    <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleRedial}
                                className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>পুনরায় ডায়াল</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleServerCall}
                                disabled={serverCalling}
                                className="flex-1 py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-950/40 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {serverCalling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PhoneForwarded className="w-3.5 h-3.5" />}
                                <span>সার্ভার কল</span>
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={hangupCall}
                            className="w-full py-1.5 text-center text-slate-400 hover:text-slate-200 text-[11px] font-medium"
                        >
                            উইন্ডো বন্ধ করুন
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 pt-1">
                        {/* Mute Button */}
                        <button
                            type="button"
                            onClick={toggleMute}
                            disabled={!isConnected}
                            className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                !isConnected
                                    ? 'opacity-50 cursor-not-allowed bg-slate-800/40 border-slate-800 text-slate-500'
                                    : isMuted
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 hover:bg-amber-500/30'
                                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200'
                            }`}
                            title={isMuted ? 'আনমিউট করুন' : 'মাইক্রোফোন মিউট করুন'}
                        >
                            {isMuted ? <MicOff className="w-3.5 h-3.5 text-amber-400" /> : <Mic className="w-3.5 h-3.5" />}
                            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                        </button>

                        {/* Keypad Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setShowKeypad(!showKeypad)}
                            disabled={!isConnected}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                !isConnected
                                    ? 'opacity-50 cursor-not-allowed bg-slate-800/40 border-slate-800 text-slate-500'
                                    : showKeypad
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200'
                            }`}
                            title="DTMF Keypad"
                        >
                            <Hash className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Keypad</span>
                        </button>

                        {/* Hangup / End Call Button */}
                        <button
                            type="button"
                            onClick={hangupCall}
                            className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/60 transition-all active:scale-95 cursor-pointer"
                            title="কল কেটে দিন"
                        >
                            <PhoneOff className="w-3.5 h-3.5" />
                            <span>{isCalling ? 'কল বাতিল' : 'কল কাটুন'}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
