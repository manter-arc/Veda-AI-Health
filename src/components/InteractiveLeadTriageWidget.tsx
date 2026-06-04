import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Clock, Shield, Sparkles, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

interface InteractiveLeadTriageWidgetProps {
  onStartChat: (preloadedText: string) => void;
  className?: string;
  defaultRegion?: string;
}

export function InteractiveLeadTriageWidget({ onStartChat, className = '', defaultRegion = '' }: InteractiveLeadTriageWidgetProps) {
  const [step, setStep] = useState(1);
  const [region, setRegion] = useState(defaultRegion || '');
  const [intensity, setIntensity] = useState('');
  const [timeline, setTimeline] = useState('');

  const regions = [
    { name: 'Head & Neck', value: 'Head & Neck', icon: '🧠' },
    { name: 'Chest & Upper Back', value: 'Chest & Upper Back', icon: '🫁' },
    { name: 'Abdomen (Stomach)', value: 'Abdominal / Stomach area', icon: '🤢' },
    { name: 'Muscles & Joint pain', value: 'Muscles & Joints', icon: '🦴' },
    { name: 'Systemic / Generalized', value: 'Systemic (General Body)', icon: '🌡️' }
  ];

  const intensities = [
    { label: 'Mild / Noticeable', value: 'Mild (1-3/10)', desc: 'Annoying but does not affect daily tasks.', color: 'border-teal-500/20 text-teal-400 bg-teal-500/5' },
    { label: 'Moderate / Distracting', value: 'Moderate (4-7/10)', desc: 'Interferes with focus or sleep.', color: 'border-amber-500/20 text-amber-400 bg-amber-500/5' },
    { label: 'Severe / Intense', value: 'Severe (8-10/10)', desc: 'Extremely painful; critical to check.', color: 'border-red-500/20 text-red-500 bg-red-500/5' }
  ];

  const timelines = [
    { label: 'Just started (Today)', value: 'Less than 24 hours ago' },
    { label: 'A few days (2-3 days)', value: 'About 2-3 days' },
    { label: 'Persistent (Over a week)', value: 'More than a week' }
  ];

  const handleReset = () => {
    setStep(1);
    setRegion(defaultRegion || '');
    setIntensity('');
    setTimeline('');
  };

  const handleComplete = () => {
    const rParam = region || 'unspecified region';
    const iParam = intensity || 'moderate intensity';
    const tParam = timeline || 'just started';
    const preloadText = `I would like to analyze the following symptoms:\n- **Location/Region**: ${rParam}\n- **Intensity Level**: ${iParam}\n- **Timeline/Duration**: ${tParam}\n\nPlease provide a safe clinical evaluation, initial triage level, potential causes, and clear guide steps.`;
    onStartChat(preloadText);
  };

  return (
    <div className={`bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 relative overflow-hidden transition-all shadow-lg hover:shadow-[0_20px_50px_rgba(13,148,136,0.05)] ${className}`} id="interactive-triage-widget">
      {/* Absolute Glow */}
      <div className="absolute -right-16 -top-16 w-32 h-32 bg-[var(--teal)]/10 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--teal)]/10 flex items-center justify-center border border-[var(--teal)]/20">
            <Activity size={12} className="text-[var(--teal)] animate-pulse" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--teal)]">Assess Severity</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold text-[var(--text2)] opacity-70">
            Step {step} of 3
          </span>
          {step > 1 && (
            <button 
              onClick={handleReset} 
              className="p-1 text-[10px] text-[var(--muted)] hover:text-white flex items-center gap-1 transition-colors bg-transparent border-none cursor-pointer focus:outline-none"
              title="Reset evaluation"
            >
              <RefreshCw size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Main Steps Content with clean AnimatePresence */}
      <div className="min-h-[220px] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 flex-1"
            >
              <h4 className="text-sm font-sans font-extrabold text-white leading-tight">
                Where is the primary area of discomfort?
              </h4>
              <p className="text-[11px] text-[var(--text2)] mb-3 opacity-80">
                Select the most prominent physical region to initiate analysis.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {regions.map((reg) => (
                  <button
                    key={reg.value}
                    onClick={() => {
                      setRegion(reg.value);
                      setStep(2);
                    }}
                    className={`flex items-center gap-3 p-3 text-left rounded-xl border text-xs font-bold transition-all w-full select-none cursor-pointer focus:outline-none ${
                      region === reg.value 
                        ? 'bg-[var(--teal)]/10 border-[var(--teal)] text-white' 
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:border-[var(--teal)]/30 hover:text-white'
                    }`}
                  >
                    <span className="text-base select-none">{reg.icon}</span>
                    <span className="truncate">{reg.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 flex-1"
            >
              <h4 className="text-sm font-sans font-extrabold text-white leading-tight">
                How intense is the pain or discomfort?
              </h4>
              <div className="space-y-2.5">
                {intensities.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setIntensity(item.value);
                      setStep(3);
                    }}
                    className={`block w-full text-left p-3 border rounded-xl transition-all select-none cursor-pointer focus:outline-none ${
                      intensity === item.value 
                        ? 'border-[var(--teal)] bg-[var(--teal)]/10 text-white' 
                        : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--teal)]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span className="text-white">{item.label}</span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${item.color}`}>
                        {item.value.split(' ')[0]}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--muted)] mt-1 font-semibold leading-relaxed">
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 flex-1"
            >
              <h4 className="text-sm font-sans font-extrabold text-white leading-tight">
                How long have you been experiencing this?
              </h4>
              <div className="space-y-2">
                {timelines.map((time) => (
                  <button
                    key={time.value}
                    onClick={() => setTimeline(time.value)}
                    className={`w-full text-left p-3 border rounded-xl text-xs font-bold transition-all select-none cursor-pointer focus:outline-none ${
                      timeline === time.value 
                        ? 'bg-[var(--teal)]/15 border-[var(--teal)] text-white' 
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:border-[var(--teal)]/30 hover:text-white'
                    }`}
                  >
                    {time.label}
                  </button>
                ))}
              </div>

              {/* Action */}
              {timeline && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-2"
                >
                  <button
                    onClick={handleComplete}
                    className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-[#020f0c] font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2 group border-none cursor-pointer"
                  >
                    <Sparkles size={12} className="group-hover:rotate-12 transition-transform" />
                    Complete AI Triage Check
                    <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info or safety alert */}
        <div className="mt-5 pt-3 border-t border-[var(--border)]/50 flex items-center justify-between text-[9px] text-[var(--muted)] font-bold uppercase tracking-wider select-none">
          <span className="flex items-center gap-1">
            <Shield size={10} className="text-teal-500" />
            Empowered by Gemini AI
          </span>
          <span className="flex items-center gap-1 opacity-70">
            <AlertCircle size={10} className="text-yellow-500" />
            Clinical Guidance Only
          </span>
        </div>
      </div>
    </div>
  );
}
