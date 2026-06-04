import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, ShieldAlert, FileText, HelpCircle, Activity, Sparkles, BookOpen } from 'lucide-react';
import { SYMPTOM_PAGES, SymptomDetail } from '../data/symptomData';
import { BLOG_ARTICLES } from '../data/blogData';
import { InteractiveLeadTriageWidget } from './InteractiveLeadTriageWidget';

interface SymptomDetailViewProps {
  symptomSlug: string;
  onNavigateHome: () => void;
  onSwitchMode: (mode: any) => void;
  onStartChatWithPreload: (text: string) => void;
}

export function SymptomDetailView({ symptomSlug, onNavigateHome, onSwitchMode, onStartChatWithPreload }: SymptomDetailViewProps) {
  const currentSymptom = SYMPTOM_PAGES[symptomSlug];

  // Fallback if not found
  if (!currentSymptom) {
    return (
      <div className="text-center py-12 space-y-4">
        <ShieldAlert className="text-yellow-500 mx-auto" size={40} />
        <h2 className="text-lg font-bold text-white">Symptom Guide Not Found</h2>
        <p className="text-xs text-[var(--muted)]">The requested symptom page could not be located.</p>
        <button onClick={onNavigateHome} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
          Return Home
        </button>
      </div>
    );
  }

  // Parse related symptoms
  const otherSymptomsGuides = currentSymptom.relatedSymptomSlugs
    .map(slug => SYMPTOM_PAGES[slug])
    .filter(Boolean);

  // Parse related blogs
  const relatedBlogs = currentSymptom.relatedBlogSlugs
    .map(slug => BLOG_ARTICLES[slug])
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Standard SEO Breadcrumb and Heading */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <button 
          onClick={onNavigateHome} 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--teal)] hover:opacity-85 transition-opacity"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
        <span className="text-[9px] font-mono uppercase tracking-widest text-blue-400 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
          Clinical Resource
        </span>
      </div>

      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-sans font-black tracking-tight text-white flex items-center gap-3">
          <Activity className="text-[var(--teal)] shrink-0" size={28} />
          {currentSymptom.title}
        </h1>
        
        {/* Keywords badges */}
        <div className="flex flex-wrap gap-2 pt-1">
          {currentSymptom.keywords.map((kw, kIdx) => (
            <span key={kIdx} className="text-[9px] font-mono text-[var(--muted)] border border-[var(--border)] px-2.5 py-0.5 rounded-full">
              #{kw.replaceAll(' ', '_')}
            </span>
          ))}
        </div>
      </div>

      {/* Overview Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Overview text */}
          <div className="bg-[var(--card)] p-6 border border-[var(--border)] rounded-3xl space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-white border-b border-[var(--border)] pb-2">
              Symptom Overview
            </h2>
            <p className="text-[13.5px] text-[var(--text2)] leading-relaxed select-text">
              {currentSymptom.overview}
            </p>
          </div>

          {/* Causes Matrix */}
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <FileText className="text-[var(--teal)]" size={16} /> Possible Common Causes
            </h2>
            
            <div className="grid grid-cols-1 gap-4">
              {currentSymptom.commonCauses.map((cause, cIdx) => (
                <div 
                  key={cIdx} 
                  className="bg-[var(--card)] border border-[var(--border)] p-5 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-[var(--teal)]/20 transition-all"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-white">{cause.name}</h3>
                    <p className="text-[12.5px] text-[var(--text2)] leading-relaxed select-text">{cause.description}</p>
                  </div>
                  
                  {/* Probability chip */}
                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shrink-0 h-fit text-center border mt-1 sm:mt-0 ${
                    cause.probability === 'High' 
                      ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                      : cause.probability === 'Moderate'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                  }`}>
                    {cause.probability} Probability
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* High-visibility Warning/Red Flags Sheet */}
          <div className="border border-red-500/20 bg-red-500/5 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-400 border-b border-red-500/10 pb-3">
              <ShieldAlert size={18} /> Red Flags: When to Seek Medical Attention
            </div>
            
            <p className="text-[12.5px] text-[var(--text2)] leading-relaxed">
              While many sudden symptoms are self-limiting or easily controlled with simple rest, certain clinical "red flags" demand immediate, physical emergency evaluation. Please consult a doctor immediately if you notice:
            </p>

            <ul className="space-y-2.5">
              {currentSymptom.whenToSeekAttention.map((flag, fIdx) => (
                <li key={fIdx} className="flex items-start gap-2.5 text-[12.5px] text-[var(--text2)] leading-relaxed select-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0 animate-pulse" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Collapsible FAQ Section */}
          <div className="space-y-4 pt-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <HelpCircle className="text-[var(--teal)]" size={16} /> Symptom FAQ
            </h2>
            
            <div className="space-y-3">
              {currentSymptom.faqs.map((faq, fIdx) => (
                <div key={fIdx} className="bg-[var(--card)] border border-[var(--border)] p-5 rounded-2xl space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">Q: {faq.question}</h3>
                  <p className="text-[12.5px] text-[var(--text2)] leading-relaxed select-text">A: {faq.answer}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Sidebar Navigation */}
        <div className="space-y-6">
          
          {/* Interactive Lead Triage Widget */}
          <InteractiveLeadTriageWidget 
            onStartChat={onStartChatWithPreload}
            defaultRegion={
              symptomSlug === 'headache' ? 'Head & Neck' :
              symptomSlug === 'stomach-pain' ? 'Abdominal / Stomach area' :
              symptomSlug === 'fever' || symptomSlug === 'fatigue' ? 'Systemic (General Body)' : ''
            }
          />

          {/* Related Articles Widgets */}
          {relatedBlogs.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] border-b border-[var(--border)] pb-2">
                Related Health Guides
              </h3>
              <div className="space-y-2.5">
                {relatedBlogs.map((art) => (
                  <a 
                    key={art.slug} 
                    href={`/blog/${art.slug}`}
                    className="flex items-center justify-between p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--teal)]/40 hover:bg-[var(--bg)] transition-all group"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-white group-hover:text-[var(--teal)] transition-colors line-clamp-1 flex-1 pr-2">
                      <BookOpen size={12} className="text-[var(--teal)] shrink-0" />
                      {art.title}
                    </span>
                    <ArrowRight size={12} className="text-[var(--muted)] group-hover:translate-x-1 transition-transform" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Other Symptoms */}
          {otherSymptomsGuides.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] border-b border-[var(--border)] pb-2">
                Other Symptom Overviews
              </h3>
              <div className="space-y-2">
                {otherSymptomsGuides.map((sym) => (
                  <a 
                    key={sym.slug} 
                    href={`/symptoms/${sym.slug}`}
                    className="block p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-red-500/25 hover:bg-[var(--bg)] transition-all text-xs font-bold text-white leading-tight"
                  >
                    {sym.name} Clinical Guide
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
