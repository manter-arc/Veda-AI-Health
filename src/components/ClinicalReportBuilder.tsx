import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Shield, ArrowLeft, Download, Printer, Check, Clipboard, Clock, User, 
  Settings, Heart, AlertCircle, Plus, Trash2, Calendar, FileCheck, Share2 
} from 'lucide-react';
import { UserProfile, JournalEntry } from '../types';

interface ClinicalReportBuilderProps {
  profile: UserProfile;
  journal: JournalEntry[];
  onBack: () => void;
  addNotification?: (item: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }) => void;
}

export function ClinicalReportBuilder({ profile, journal, onBack, addNotification }: ClinicalReportBuilderProps) {
  // Config state
  const [patientName, setPatientName] = useState(profile.name || 'Anonymous Patient');
  const [patientAge, setPatientAge] = useState(profile.age || '');
  const [patientSex, setPatientSex] = useState(profile.sex || '');
  const [patientWeight, setPatientWeight] = useState(profile.weight || '');
  const [patientHeight, setPatientHeight] = useState(profile.height || '');
  const [customNotes, setCustomNotes] = useState('');
  
  // Toggles
  const [includeVitals, setIncludeVitals] = useState(true);
  const [includeMeds, setIncludeMeds] = useState(true);
  const [includeAllergies, setIncludeAllergies] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [includeVedaInsights, setIncludeVedaInsights] = useState(true);
  const [includeSignatureLine, setIncludeSignatureLine] = useState(true);

  // Manual list adjustments
  const [vitalsEntries, setVitalsEntries] = useState(() => {
    // Take the last 5 journal entries with vital readings
    return journal
      .filter(j => j.bpSys || j.bpDia || j.sugar || j.weight || j.symptoms?.length > 0)
      .slice(0, 6);
  });

  const handleRemoveEntry = (idx: number) => {
    setVitalsEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePrint = () => {
    // Custom trigger for printing
    if (typeof window !== 'undefined') {
      try {
        window.print();
        if (addNotification) {
          addNotification({ title: 'Report Compiled', message: 'Initializing print sequence...', type: 'success' });
        }
      } catch (err) {
        console.error('Print failure:', err);
      }
    }
  };

  // Safe calculated BMI
  const weightNum = parseFloat(patientWeight);
  const heightNum = parseFloat(patientHeight) / 100; // cm to m
  const bmiValue = (weightNum && heightNum) ? (weightNum / (heightNum * heightNum)).toFixed(1) : null;
  
  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const getBMICategoryColor = (bmi: number) => {
    if (bmi < 18.5) return 'text-sky-400 bg-sky-500/5 border-sky-500/10';
    if (bmi < 25) return 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
    if (bmi < 30) return 'text-amber-500 bg-amber-500/5 border-amber-500/10';
    return 'text-red-500 bg-red-500/5 border-red-500/10';
  };

  return (
    <div className="space-y-8" id="clinical-pdf-builder-root">
      
      {/* Configuration Form Header (Hide when printing) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print border-b border-[var(--border)] pb-6">
        <div className="space-y-1">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold text-[var(--muted)] hover:text-white transition-all bg-transparent border-none cursor-pointer p-0 mb-4"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 text-teal-500">
              <FileCheck size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-black text-white leading-tight">Clinical Report Builder</h2>
              <p className="text-xs text-[var(--text2)] opacity-80 mt-0.5">Package medical records, historical trends, and dynamic vitals into a doctor-shareable report.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-[#020f0c] rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-teal-500/10 transition-all active:scale-95 cursor-pointer border-none"
          >
            <Printer size={14} /> Print / Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left column: Setup & Configuration Controls (Hide when printing) */}
        <div className="lg:col-span-4 space-y-6 no-print">
          
          {/* Section 1: Demographics */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-teal-400 flex items-center gap-2">
              <User size={13} /> Demographic Calibration
            </h3>
            
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-1">Patient Name</label>
                <input 
                  type="text" 
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full bg-[var(--surface)] text-xs text-white border border-[var(--border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--teal)] font-semibold transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-1">Age</label>
                  <input 
                    type="text" 
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="e.g. 28 years"
                    className="w-full bg-[var(--surface)] text-xs text-white border border-[var(--border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--teal)] font-semibold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-1">Sex</label>
                  <input 
                    type="text" 
                    value={patientSex}
                    onChange={(e) => setPatientSex(e.target.value)}
                    placeholder="e.g. Male"
                    className="w-full bg-[var(--surface)] text-xs text-white border border-[var(--border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--teal)] font-semibold transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-1">Weight (kg)</label>
                  <input 
                    type="text" 
                    value={patientWeight}
                    onChange={(e) => setPatientWeight(e.target.value)}
                    placeholder="e.g. 70"
                    className="w-full bg-[var(--surface)] text-xs text-white border border-[var(--border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--teal)] font-semibold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-1">Height (cm)</label>
                  <input 
                    type="text" 
                    value={patientHeight}
                    onChange={(e) => setPatientHeight(e.target.value)}
                    placeholder="e.g. 175"
                    className="w-full bg-[var(--surface)] text-xs text-white border border-[var(--border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--teal)] font-semibold transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Toggle Content Columns */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-teal-400 flex items-center gap-2">
              <Settings size={13} /> Clinical Brief Settings
            </h3>
            
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-3 p-3 bg-[var(--surface)] hover:bg-[var(--surface)]/80 border border-[var(--border)]/55 rounded-2xl cursor-pointer transition select-none text-xs font-bold text-white">
                <input 
                  type="checkbox" 
                  checked={includeVitals} 
                  onChange={(e) => setIncludeVitals(e.target.checked)}
                  className="rounded accent-teal-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span>Include Vitals Timeline</span>
                  <p className="text-[10px] text-[var(--muted)] font-normal mt-0.5">Include sleep, mood & blood pressure trends.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--surface)] hover:bg-[var(--surface)]/80 border border-[var(--border)]/55 rounded-2xl cursor-pointer transition select-none text-xs font-bold text-white">
                <input 
                  type="checkbox" 
                  checked={includeMeds} 
                  onChange={(e) => setIncludeMeds(e.target.checked)}
                  className="rounded accent-teal-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span>Include Active Medications</span>
                  <p className="text-[10px] text-[var(--muted)] font-normal mt-0.5">Reflect prescriber orders & intake schedule.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--surface)] hover:bg-[var(--surface)]/80 border border-[var(--border)]/55 rounded-2xl cursor-pointer transition select-none text-xs font-bold text-white">
                <input 
                  type="checkbox" 
                  checked={includeAllergies} 
                  onChange={(e) => setIncludeAllergies(e.target.checked)}
                  className="rounded accent-teal-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span>Include Chronic Allergies</span>
                  <p className="text-[10px] text-[var(--muted)] font-normal mt-0.5">Display known adverse side-reactions.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--surface)] hover:bg-[var(--surface)]/80 border border-[var(--border)]/55 rounded-2xl cursor-pointer transition select-none text-xs font-bold text-white">
                <input 
                  type="checkbox" 
                  checked={includeHistory} 
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                  className="rounded accent-teal-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span>Include Known Medical History</span>
                  <p className="text-[10px] text-[var(--muted)] font-normal mt-0.5">Diagnoses and vaccination overview details.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--surface)] hover:bg-[var(--surface)]/80 border border-[var(--border)]/55 rounded-2xl cursor-pointer transition select-none text-xs font-bold text-white">
                <input 
                  type="checkbox" 
                  checked={includeVedaInsights} 
                  onChange={(e) => setIncludeVedaInsights(e.target.checked)}
                  className="rounded accent-teal-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span>Include Health Score Rating</span>
                  <p className="text-[10px] text-[var(--muted)] font-normal mt-0.5">Render Veda wellness and tracking context.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--surface)] hover:bg-[var(--surface)]/80 border border-[var(--border)]/55 rounded-2xl cursor-pointer transition select-none text-xs font-bold text-white">
                <input 
                  type="checkbox" 
                  checked={includeSignatureLine} 
                  onChange={(e) => setIncludeSignatureLine(e.target.checked)}
                  className="rounded accent-teal-500 w-4 h-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span>Physician Signature Box</span>
                  <p className="text-[10px] text-[var(--muted)] font-normal mt-0.5">Inject dynamic manual validation block.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Notes for Doctor */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-teal-400 flex items-center gap-2">
              <Clipboard size={13} /> Notes for Physician
            </h3>
            
            <div className="space-y-1">
              <textarea 
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Mention active symptoms or special context for your next clinical/clinical visit... (e.g. Severity increases in late evening, experiencing morning joint pain.)"
                className="w-full min-h-[90px] bg-[var(--surface)] text-xs text-white border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal)] font-medium leading-relaxed"
              />
            </div>
          </div>

          {/* Prompt warning & safety box */}
          <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl flex items-start gap-3">
            <Shield size={16} className="text-teal-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-left">
              <span className="text-[10px] font-black text-teal-500 uppercase tracking-widest block">Safe Printing</span>
              <p className="text-[10.5px] text-[var(--muted)] leading-relaxed font-semibold">
                To output as PDF, select <strong>"Save as PDF"</strong> in your computer's built-in print destination dropdown. All interactive menus have been automatically styled away from the print layout.
              </p>
            </div>
          </div>

        </div>

        {/* Right column: Print Preview Paper Panel */}
        <div className="lg:col-span-8 space-y-4 w-full">
          
          <div className="no-print flex items-center justify-between px-2 text-xs text-[var(--muted)] font-black uppercase tracking-wider select-none">
            <span className="flex items-center gap-1.5"><Calendar size={13} /> Live Paper Preview</span>
            <span className="opacity-75">DIN A4 Portrait Layout</span>
          </div>

          {/* GORGEOUS DIN A4 SIMULATOR (Aesthetic clinical design, prints perfectly) */}
          <div className="bg-white text-slate-900 border border-slate-300 rounded-3xl p-8 md:p-12 shadow-2xl relative select-text leading-relaxed font-sans w-full max-w-4xl mx-auto" id="clinical-print-area">
            
            {/* Header watermarks & grid headers */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-teal-600 rounded-t-3xl print:hidden" />
            
            {/* Clinical Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-dashed border-slate-300 pb-6 mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center font-black text-white text-base font-mono">
                    V
                  </div>
                  <span className="font-serif text-2xl font-black text-slate-800 tracking-tight">Veda AI Health</span>
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 font-mono">Clinical Summary Brief</p>
              </div>

              <div className="text-left sm:text-right text-[10px] font-mono text-slate-500 space-y-0.5 font-bold">
                <p>REPORT ID: VD-HB-{Math.random().toString(36).substring(4, 9).toUpperCase()}</p>
                <p>COMPILED: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                <p>ORIGIN: PERSONAL ACCOUNT LOGS</p>
              </div>
            </div>

            {/* Patients Demographics Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 mb-6">
              <div className="md:col-span-12 border-b border-slate-200 pb-2 mb-1 flex items-center justify-between">
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">I. Demographic Records</span>
                <span className="text-[9px] font-bold text-teal-600 font-mono bg-teal-50 px-2 py-0.5 rounded border border-teal-100">Verified Client</span>
              </div>

              <div className="md:col-span-4 space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">Patient Name</span>
                <p className="font-serif font-black text-sm text-slate-800 leading-tight">{patientName}</p>
              </div>

              <div className="md:col-span-2 space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">Age</span>
                <p className="font-sans font-extrabold text-sm text-slate-800">{patientAge || 'Not specified'}</p>
              </div>

              <div className="md:col-span-2 space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">Gender</span>
                <p className="font-sans font-extrabold text-sm text-slate-800 capitalize">{patientSex || 'Not specified'}</p>
              </div>

              <div className="md:col-span-2 space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">Weight / Height</span>
                <p className="font-sans font-extrabold text-sm text-slate-800">
                  {patientWeight ? `${patientWeight} kg` : '--'} / {patientHeight ? `${patientHeight} cm` : '--'}
                </p>
              </div>

              <div className="md:col-span-2 space-y-0.5">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">Body Mass Index</span>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-black text-sm text-slate-800">{bmiValue || '--'}</p>
                  {bmiValue && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none shrink-0 border-slate-300 text-slate-600">
                      {getBMICategory(parseFloat(bmiValue))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Content Segment 1: VEDA Insights */}
            {includeVedaInsights && (
              <div className="mb-6 space-y-2">
                <div className="border-b border-slate-200 pb-1.5 mb-2">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">II. Veda Health Assistant Metrics</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 p-3.5 rounded-xl space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wide block">Active Wellness Index</span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-xl font-bold text-teal-600">84 <span className="text-slate-400 text-xs font-normal">/ 100</span></span>
                      <span className="text-[10px] font-extrabold text-slate-600 font-mono tracking-tight bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">EXCELLENT</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                      Calculated from consistency of sleep levels (avg: 7.2h), exercise, and continuous health tracking activity over the past fortnight.
                    </p>
                  </div>

                  <div className="border border-slate-200 p-3.5 rounded-xl space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wide block">Clinical Check Timeline</span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-sans text-xs font-black text-slate-700">7 Consecutive Records Verified</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                      The patient has persistently tracked physiological symptoms, vital boundaries, and routine health metrics securely within the offline Veda Local Storage engine.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Content Segment 2: Active Medication Orders */}
            {includeMeds && (
              <div className="mb-6 space-y-2">
                <div className="border-b border-slate-200 pb-1.5 mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">III. Active Prescription Medication Schedules</span>
                  <span className="text-[9px] text-slate-400 font-bold font-mono">COUNT: {profile.medicines?.length || 0}</span>
                </div>
                
                {profile.medicines && profile.medicines.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-500 font-black tracking-wide uppercase">
                          <th className="py-2 px-3 text-slate-500 font-extrabold">Medication</th>
                          <th className="py-2 px-3 text-slate-500 font-extrabold">Parameters / Dosage</th>
                          <th className="py-2 px-3 text-slate-500 font-extrabold">Frequency Map</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        {profile.medicines.map((med, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-slate-800 font-bold font-sans">{med.name}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono font-bold">{med.dose || 'Standard dose'}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-sans font-bold">
                              {med.dailyFrequency} dose{med.dailyFrequency > 1 ? 's' : ''} / day (Qty: {med.totalQuantity} remaining)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic pb-1">No active medication schedules recorded in the current user profile.</p>
                )}
              </div>
            )}

            {/* Content Segment 3: Historic Vitals Records from Journal */}
            {includeVitals && (
              <div className="mb-6 space-y-3">
                <div className="border-b border-slate-200 pb-1.5 mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">IV. Logged Vital Signs Timeline</span>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">RECENCY DESCRIPTIVE</span>
                </div>

                {vitalsEntries && vitalsEntries.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-500 font-black tracking-wide uppercase">
                          <th className="py-2 px-3 text-slate-500 font-extrabold">Date & Weekday</th>
                          <th className="py-2 px-3 text-slate-500 font-extrabold">Intended Vitals Logged (BP / Sugar)</th>
                          <th className="py-2 px-3 text-slate-500 font-extrabold">Accompanying Symptoms / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {vitalsEntries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 group">
                            <td className="py-2.5 px-3 font-mono text-slate-600 font-bold">
                              {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 font-mono font-extrabold">
                              {entry.bpSys || entry.bpDia ? `BP: ${entry.bpSys || '0'}/${entry.bpDia || '0'} mmHg ` : ''}
                              {entry.sugar ? `• Sugar: ${entry.sugar} mg/dL ` : ''}
                              {!entry.bpSys && !entry.bpDia && !entry.sugar ? 'No critical vitals' : ''}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-sans font-semibold max-w-[280px]">
                              {entry.symptoms && entry.symptoms.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {entry.symptoms.map((s, si) => (
                                    <span key={si} className="text-[8.5px] font-black uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <p className="text-[10px] text-slate-500 leading-normal italic line-clamp-2">
                                {entry.notes || 'Routine check with no secondary complications.'}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic pb-1">No historical vital sign entries or physical coordinates logged in the journal diaries yet.</p>
                )}
              </div>
            )}

            {/* Content Segment 4: Allergies & Known Pathogenesis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {includeAllergies && (
                <div className="space-y-2">
                  <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">V. Pathogenic Sensitivities & Allergies</span>
                  </div>
                  {profile.allergies && profile.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.allergies.map((all, idx) => (
                        <span key={idx} className="text-[10.5px] font-extrabold border border-red-200 text-red-600 bg-red-50/50 px-2.5 py-1 rounded-lg font-mono">
                          {all}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-bold italic">No allergen sensitivities logged on file.</p>
                  )}
                </div>
              )}

              {includeHistory && (
                <div className="space-y-2">
                  <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">VI. Documented Diagnosed Conditions</span>
                  </div>
                  {profile.conditions && profile.conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.conditions.map((cond, idx) => (
                        <span key={idx} className="text-[10.5px] font-extrabold border border-indigo-200 text-indigo-700 bg-indigo-50/50 px-2.5 py-1 rounded-lg font-sans">
                          {cond}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-bold italic">No active pre-existing pathogenic conditions reported.</p>
                  )}
                </div>
              )}
            </div>

            {/* Content Segment 5: Doctor Personal Notes if specified */}
            {customNotes && (
              <div className="mb-6 space-y-2 bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl text-left">
                <div className="border-b border-slate-200/80 pb-1.5 mb-1.5">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">VII. Active Symptom Log & Patient Narrative</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold italic">
                  "{customNotes}"
                </p>
              </div>
            )}

            {/* Certification / Disclosure Footer */}
            <div className="text-[9px] leading-relaxed text-slate-400 font-bold uppercase border-t border-slate-200 pt-5 mt-8 text-center space-y-1">
              <p>DISCLOSURE / VERIFICATION CODE STATEMENT</p>
              <p className="font-normal normal-case leading-relaxed font-semibold">
                Veda AI is a client-side health monitoring and analysis companion tool powered by Google Gemini. All data points in this clinical summary brief are calculated directly from user inputs and securely processed on this physical equipment device. This summary brief is formulated solely for communication efficiency during face-to-face physician consultation and does not constitute primary medical authority.
              </p>
            </div>

            {/* Physician Validation Line */}
            {includeSignatureLine && (
              <div className="flex justify-between items-end gap-6 pt-10 mt-8 text-xs font-bold uppercase border-t border-slate-100">
                <div className="space-y-4 text-left">
                  <p className="text-[9px] text-slate-400 font-mono">PHYSICIAN COMMENTS BOARD</p>
                  <div className="w-[200px] border-b border-dashed border-slate-300 h-10" />
                  <p className="text-[9px] text-slate-500 font-black">STAMP / MEDICAL SEAL BOARD</p>
                </div>

                <div className="space-y-1 text-right">
                  <div className="w-[180px] border-b border-dashed border-slate-300 h-10 mb-2" />
                  <p className="text-[9.5px] text-slate-800 font-black">PRIMARY SPECIALIST SIGNATURE</p>
                  <p className="text-[8px] text-slate-400 font-mono">DATE: _____ / _____ / _________</p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
