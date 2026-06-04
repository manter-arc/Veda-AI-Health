import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Shield, Heart, HelpCircle, Activity, ChevronDown, ChevronUp, Stethoscope, 
  Brain, Droplets, Thermometer, Sparkles, Clipboard, Users, ShieldAlert, BookOpen 
} from 'lucide-react';

interface PatientDirectoryFooterProps {
  onStartChat?: () => void;
  className?: string;
}

export function PatientDirectoryFooter({ onStartChat, className = '' }: PatientDirectoryFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper inside click-intercept SPA router
  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const directorySections = [
    {
      title: "Cranial Systems & Fever",
      icon: <Brain size={14} className="text-teal-400" />,
      description: "Neurological & body temperature pathways",
      links: [
        { name: "Cranial Headache Guide", path: "/symptoms/headache", desc: "Tension, migraine & ocular pain triggers" },
        { name: "Elevated Fever Tracker", path: "/symptoms/fever", desc: "Immune responses & pathogen spikes" },
        { name: "Brain Fog & Fatigue Index", path: "/symptoms/fatigue", desc: "Chronic exhaustion & stamina assessment" },
        { name: "Headache Triggers Analysis", path: "/blog/headache-causes", desc: "7 underlying causes of cranial pressure" }
      ]
    },
    {
      title: "Abdominal & Nutrition Systems",
      icon: <Droplets size={14} className="text-blue-400" />,
      description: "Digestive and metabolic parameters",
      links: [
        { name: "Abdominal Spasm Directory", path: "/symptoms/stomach-pain", desc: "Gut bloating, appendix signs & side-pain" },
        { name: "Dehydration Red-Flags", path: "/blog/dehydration-signs", desc: "Subtle metabolic clues & electrolyte indices" },
        { name: "Cyberchondria Care Guide", path: "/blog/why-googling-symptoms-causes-anxiety", desc: "Anxiety-free clinical symptom parsing" },
        { name: "AI Caloric Nutrition Model", path: "/food", desc: "Metabolic menu logging & food optimization" }
      ]
    },
    {
      title: "AI Verification Tools",
      icon: <Sparkles size={14} className="text-indigo-400" />,
      description: "High-fidelity diagnostic models",
      links: [
        { name: "Conversational Wellness AI", path: "/chat", desc: "End-to-end clinical private helper chat" },
        { name: "Interactive Symptom Solver", path: "/symptoms", desc: "Structured diagnosis checkup logic" },
        { name: "Emergency Severity Triage", path: "/triage", desc: "Dynamic coordinate pain scale analysis" },
        { name: "Prescription Scan AI", path: "/rx", desc: "Autonomous medicine card translation" }
      ]
    },
    {
      title: "Clinician & Record Portals",
      icon: <Clipboard size={14} className="text-emerald-400" />,
      description: "Offline health histories & files",
      links: [
        { name: "Doctor Report Compiler", path: "/clinical_report", desc: "Generate print-ready clinical briefs" },
        { name: "Medical History Index", path: "/records", desc: "Structured lab result directories" },
        { name: "Secure Digital Document Locker", path: "/locker", desc: "Local cloud-synchronized PDF locker" },
        { name: "Family Health Circle", path: "/family", desc: "Collaborative metrics across relatives" }
      ]
    }
  ];

  return (
    <div className={`mt-12 pt-8 border-t border-[var(--border)] relative z-10 ${className}`} id="patient-directory-sitemap-root">
      
      {/* Toggler Bar */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-4 px-6 bg-[var(--surface)] hover:bg-[var(--surface)]/80 border border-[var(--border)] rounded-2xl flex items-center justify-between text-left transition-all group cursor-pointer focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-all border border-teal-500/20">
            <Activity size={16} />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-[0.15em] text-[var(--teal)] block">Directory Index Mapping</span>
            <h4 className="text-[13px] font-sans font-bold text-white mt-0.5">Explore Veda AI Clinical Interlinks & Blog Sites</h4>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[var(--muted)] group-hover:text-white transition-colors text-xs font-bold">
          <span>{isExpanded ? "Collapse Sitemap" : "Expand Directory"}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Directory Columns */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-8 pb-6 text-left">
              {directorySections.map((section, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-[var(--border)]/70 pb-2">
                    {section.icon}
                    <h5 className="text-[11.5px] font-black uppercase tracking-wider text-[var(--text)]">
                      {section.title}
                    </h5>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] font-bold mt-[-8px] leading-tight opacity-75">
                    {section.description}
                  </p>

                  <ul className="space-y-3 list-none pl-0 mt-2">
                    {section.links.map((link, lidx) => (
                      <li key={lidx} className="group/item">
                        <a
                          href={link.path}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateTo(link.path);
                          }}
                          className="text-[12.5px] text-[var(--muted)] group-hover/item:text-[var(--teal)] font-bold transition-all no-underline block leading-tight pt-0.5"
                        >
                          {link.name}
                        </a>
                        <span className="text-[9.5px] text-[var(--muted)] opacity-65 font-medium leading-relaxed block mt-0.5">
                          {link.desc}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Organic growth / SEO citation box */}
            <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 text-xs text-[var(--muted)] font-semibold mb-2">
              <div className="flex items-center gap-2.5 text-left">
                <Shield size={14} className="text-teal-500 shrink-0" />
                <span>Page Rank Optimization Index — High relevancy clinical deep linking prevents orphan navigation routes and optimizes system crawler index schedules.</span>
              </div>
              <button 
                onClick={() => navigateTo('/trust')}
                className="text-[10.5px] font-black uppercase tracking-widest text-teal-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer"
              >
                Trust Center →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
