import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, Calendar, Clock, User, ArrowLeft, ArrowRight, HelpCircle, Activity, Sparkles, AlertCircle } from 'lucide-react';
import { BLOG_ARTICLES, BlogArticle } from '../data/blogData';
import { SYMPTOM_PAGES } from '../data/symptomData';

interface BlogViewProps {
  articleSlug?: string;
  onNavigateHome: () => void;
  onSwitchMode: (mode: any) => void;
}

export function BlogView({ articleSlug, onNavigateHome, onSwitchMode }: BlogViewProps) {
  // If there's an article slug, find the article
  const currentArticle = articleSlug ? BLOG_ARTICLES[articleSlug] : null;

  // Render a single article view
  if (currentArticle) {
    return <ArticleDetail article={currentArticle} onSwitchMode={onSwitchMode} />;
  }

  // Render the blog list directory
  return <BlogDirectory onSwitchMode={onSwitchMode} onNavigateHome={onNavigateHome} />;
}

// -------------------------------------------------------------
// 1. Article Detail Component
// -------------------------------------------------------------
function ArticleDetail({ article, onSwitchMode }: { article: BlogArticle; onSwitchMode: (mode: any) => void }) {
  // Parse related items
  const relatedArticles = article.relatedArticlesSlugs
    .map(slug => BLOG_ARTICLES[slug])
    .filter(Boolean);

  const relatedSymptoms = article.relatedSymptomsSlugs
    .map(slug => SYMPTOM_PAGES[slug])
    .filter(Boolean);

  return (
    <motion.article 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Back to Blog Button */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <a 
          href="/blog" 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--teal)] hover:opacity-85 transition-opacity"
        >
          <ArrowLeft size={14} /> Back to Blog
        </a>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] px-3 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-full">
          {article.category}
        </span>
      </div>

      {/* Hero Section */}
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-sans font-extrabold tracking-tight text-white leading-tight">
          {article.title}
        </h1>
        
        {/* Meta details */}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-[11px] font-mono uppercase tracking-widest text-[var(--text2)] border-y border-[var(--border)] py-3">
          <span className="flex items-center gap-1.5"><User size={13} className="text-[var(--teal)]" /> {article.author}</span>
          <span className="flex items-center gap-1.5"><Calendar size={13} className="text-[var(--teal)]" /> {article.date}</span>
          <span className="flex items-center gap-1.5"><Clock size={13} className="text-[var(--teal)]" /> {article.readTime}</span>
        </div>
      </div>

      {/* Featured Image */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[16/9] border border-[var(--border)]">
        <img 
          src={article.image} 
          alt={article.title} 
          referrerPolicy="no-referrer"
          className="object-cover w-full h-full transform hover:scale-[1.02] transition-transform duration-500" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Main Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editorial Text Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="text-[15px] leading-relaxed text-[var(--text)] font-sans space-y-6">
            <p className="text-base font-semibold text-[var(--teal)] border-l-2 border-[var(--teal)] pl-4 italic bg-[var(--teal)]/5 py-2 rounded-r-xl">
              "{article.summary}"
            </p>

            {article.content.map((sec, sIdx) => (
              <div key={sIdx} className="space-y-4 pt-4">
                <h2 className="text-lg md:text-xl font-sans font-bold tracking-tight text-white border-b border-[var(--border)] pb-2">
                  {sec.sectionTitle}
                </h2>
                <p className="text-[14px] text-[var(--text2)] leading-relaxed select-text">{sec.text}</p>
                
                {sec.subsections && sec.subsections.map((subsec, subIdx) => (
                  <div key={subIdx} className="bg-[var(--card)] p-5 border border-[var(--border)] rounded-2xl space-y-2 hover:border-[var(--teal)]/30 transition-all">
                    <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal)]" />
                      {subsec.title}
                    </h3>
                    <p className="text-[13px] text-[var(--text2)] leading-relaxed select-text">{subsec.text}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Collapsible FAQ Section */}
          <div className="mt-12 space-y-4 pt-6 border-t border-[var(--border)]">
            <h3 className="text-base font-black uppercase tracking-widest text-white flex items-center gap-2">
              <HelpCircle className="text-[var(--teal)]" size={18} /> Frequently Asked Questions
            </h3>
            <div className="space-y-3">
              {article.faqs.map((faq, fIdx) => (
                <div key={fIdx} className="bg-[var(--surface)] border border-[var(--border)] p-5 rounded-2xl space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#93c5fd]">Q: {faq.question}</h4>
                  <p className="text-[13px] text-[var(--text2)] leading-relaxed select-text">A: {faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* AI Symptom Tracker CTA Panel */}
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-6 rounded-3xl space-y-4 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <Sparkles className="text-indigo-400" size={24} />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Veda Symptom Checker</h3>
            <p className="text-xs text-[var(--text2)] leading-relaxed">
              Experiencing a nagging headache, unexplained fatigue, or acute body aches? Avoid catastrophic web searches. Use Veda's secure diagnostic clinical AI.
            </p>
            <button 
              onClick={() => onSwitchMode('symptoms')}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-blue-500/10 active:scale-95"
            >
              Analyze Your Symptoms
            </button>
          </div>

          {/* Related Symptoms Guides */}
          {relatedSymptoms.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] border-b border-[var(--border)] pb-2">
                Related Symptoms Guides
              </h3>
              <div className="space-y-2.5">
                {relatedSymptoms.map((sym) => (
                  <a 
                    key={sym.slug} 
                    href={`/symptoms/${sym.slug}`}
                    className="flex items-center justify-between p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--teal)]/40 hover:bg-[var(--bg)] transition-all group"
                  >
                    <span className="flex items-center gap-2.5 text-xs font-semibold text-white group-hover:text-[var(--teal)] transition-colors">
                      <Activity size={14} className="text-[var(--teal)]" />
                      {sym.name} Clinical Guide
                    </span>
                    <ArrowRight size={12} className="text-[var(--muted)] group-hover:translate-x-1 transition-transform" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] border-b border-[var(--border)] pb-2">
                Further Wellness Reading
              </h3>
              <div className="space-y-3">
                {relatedArticles.map((art) => (
                  <a 
                    key={art.slug} 
                    href={`/blog/${art.slug}`}
                    className="block space-y-1 group"
                  >
                    <h4 className="text-xs font-bold text-white group-hover:text-[var(--teal)] transition-colors leading-snug line-clamp-2">
                      {art.title}
                    </h4>
                    <span className="text-[10px] font-mono text-[var(--muted)] block">
                      {art.readTime} • {art.date}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

// -------------------------------------------------------------
// 2. Blog Directory List Component
// -------------------------------------------------------------
function BlogDirectory({ onSwitchMode, onNavigateHome }: { onSwitchMode: (mode: any) => void; onNavigateHome: () => void }) {
  const articlesList = Object.values(BLOG_ARTICLES);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-12"
    >
      {/* Header Panel */}
      <div className="space-y-4 text-center max-w-2xl mx-auto">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--teal)] bg-[var(--teal)]/10 px-4 py-1.5 rounded-full border border-[var(--teal)]/20 shadow-sm inline-block">
          Veda Knowledge Portal
        </span>
        <h1 className="text-2xl md:text-3xl font-sans font-black tracking-tight text-white">
          Evidence-Based Health Guides
        </h1>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Read clinically reviewed articles on symptoms, wellness habits, mental triggers, and smart strategies powered by Veda AI symptom analysis tool.
        </p>
      </div>

      {/* Cards List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {articlesList.map((art, idx) => (
          <motion.div
            key={art.slug}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden hover:border-[var(--border-hover)] transition-all shadow-md hover:shadow-xl relative"
          >
            {/* Tag Overlay */}
            <span className="absolute top-4 left-4 z-10 text-[9px] font-mono uppercase tracking-widest bg-black/70 text-[var(--teal)] backdrop-blur-md px-3 py-1 rounded-full border border-[var(--teal)]/20">
              {art.category}
            </span>

            {/* Thumbnail */}
            <div className="aspect-[16/9] w-full overflow-hidden relative border-b border-[var(--border)]">
              <img 
                src={art.image} 
                alt={art.title} 
                referrerPolicy="no-referrer"
                className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
            </div>

            {/* Information */}
            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--muted)]">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {art.date}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {art.readTime}</span>
                </div>
                
                <h2 className="text-sm font-extrabold text-white group-hover:text-[var(--teal)] transition-colors leading-snug line-clamp-2">
                  <a href={`/blog/${art.slug}`} className="focus:outline-none">{art.title}</a>
                </h2>
                
                <p className="text-[12px] text-[var(--text2)] leading-relaxed line-clamp-3">
                  {art.summary}
                </p>
              </div>

              {/* Action */}
              <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between">
                <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">
                  By {art.author.split(',')[0]}
                </span>
                <a 
                  href={`/blog/${art.slug}`}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--teal)] group-hover:translate-x-1 transition-all"
                >
                  Read Post <ArrowRight size={12} />
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* General FAQ Section on Directory */}
      <div className="bg-[var(--card)] border border-[var(--border)] p-8 rounded-3xl space-y-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-center text-white flex items-center justify-center gap-2">
          <HelpCircle className="text-[var(--teal)]" size={16} /> Knowledge Hub FAQ
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--teal)]">How accurate is a symptom checker AI?</h4>
            <p className="text-[11px] text-[var(--text2)] leading-relaxed">
              Veda’s symptom analysis tool is designed using evidence-based medical standards. It structures patient logs on severity, timelines, and signs to present logical primary possibilities but is not a substitute for diagnostic medicine.
            </p>
          </div>
          <div className="space-y-1.5 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--teal)]">How does a health AI assistant protect data?</h4>
            <p className="text-[11px] text-[var(--text2)] leading-relaxed">
              Our app ensures strict encryption and complete offline or cloud-auth persistence. We do not sell your personal demographic logs or medical information to any third-party insurance or marketing companies.
            </p>
          </div>
        </div>
      </div>

      {/* Directory CTA */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-teal-400/10 border border-indigo-500/15 p-8 rounded-3xl text-center space-y-4">
        <Activity className="text-[var(--teal)] mx-auto" size={28} />
        <h3 className="text-sm font-black uppercase tracking-widest text-white">Do You Have Active Health Questions?</h3>
        <p className="text-xs text-[var(--text2)] max-w-lg mx-auto leading-relaxed">
          Skip generic, stress-inducing searches. Initiate a private, high-fidelity symptom checkout immediately with our intelligent health AI app.
        </p>
        <button 
          onClick={() => onSwitchMode('symptoms')}
          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all inline-block active:scale-95"
        >
          Check Symptoms Now
        </button>
      </div>
    </motion.div>
  );
}
