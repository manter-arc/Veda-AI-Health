import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, Activity, Moon, Zap, BarChart3, Info, Sparkles, ChevronUp } from 'lucide-react';
import { JournalEntry } from '../types';
import { cn, formatMsg } from '../lib/utils';
import { callGemini } from '../lib/gemini';

interface TrendMetric {
  label: string;
  current: number;
  previous: number;
  unit: string;
  betterIfHigher: boolean | null; // null if neutral like heart rate
}

interface Insight {
  id: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
}

export function TrendsInsights({ journal }: { journal: JournalEntry[] }) {
  const [aiResult, setAiResult] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);

  const stats = useMemo(() => {
    if (journal.length < 2) return null;

    // Filter and sort by date descending
    const sorted = [...journal].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Split into current week (last 7 entries) and previous week (next 7 entries)
    // For simplicity, we take 7 entries as a "week"
    const currentWeek = sorted.slice(0, 7);
    const previousWeek = sorted.slice(7, 14);

    if (currentWeek.length === 0) return null;

    const avg = (arr: JournalEntry[], key: keyof JournalEntry) => {
      const vals = arr.map(e => Number(e[key])).filter(v => !isNaN(v) && v !== 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const metrics: TrendMetric[] = [
      {
        label: 'Avg Sleep',
        current: avg(currentWeek, 'sleep'),
        previous: avg(previousWeek, 'sleep'),
        unit: 'h',
        betterIfHigher: true
      },
      {
        label: 'Energy Level',
        current: avg(currentWeek, 'energy'),
        previous: avg(previousWeek, 'energy'),
        unit: '/5',
        betterIfHigher: true
      },
      {
        label: 'Mood Score',
        current: avg(currentWeek, 'mood'),
        previous: avg(previousWeek, 'mood'),
        unit: '/5',
        betterIfHigher: true
      },
      {
        label: 'Blood Sugar',
        current: avg(currentWeek, 'sugar'),
        previous: avg(previousWeek, 'sugar'),
        unit: 'mg/dL',
        betterIfHigher: false
      }
    ];

    const sysCurrent = avg(currentWeek, 'bpSys');
    const sysPrev = avg(previousWeek, 'bpSys');
    if (sysCurrent > 0) {
      metrics.push({
        label: 'Systolic BP',
        current: sysCurrent,
        previous: sysPrev,
        unit: 'mmHg',
        betterIfHigher: false
      });
    }

    // Generate specific insights
    const insights: Insight[] = [];

    // Sleep Insight
    const sleepDiff = metrics[0].current - metrics[0].previous;
    if (metrics[0].previous > 0) {
      if (sleepDiff > 0.5) {
        insights.push({
          id: 'sleep-up',
          text: `You're sleeping ${sleepDiff.toFixed(1)}h more on average this week. Great for recovery!`,
          type: 'positive',
          icon: <Moon className="text-blue-400" size={18} />
        });
      } else if (sleepDiff < -0.5) {
        insights.push({
          id: 'sleep-down',
          text: `Sleep is down by ${Math.abs(sleepDiff).toFixed(1)}h. This might explain any fatigue.`,
          type: 'negative',
          icon: <Moon className="text-red-400" size={18} />
        });
      }
    }

    // Correlation Energy/Sleep
    if (metrics[0].current > metrics[0].previous && metrics[1].current > metrics[1].previous) {
      insights.push({
        id: 'corr-sleep-energy',
        text: "Positive correlation: Your energy levels are rising along with your increased sleep.",
        type: 'positive',
        icon: <Zap className="text-yellow-400" size={18} />
      });
    }

    // Sugar Insight
    const sugar = metrics.find(m => m.label === 'Blood Sugar');
    if (sugar && sugar.previous > 0) {
      const sugarDiff = sugar.current - sugar.previous;
      if (sugarDiff > 10) {
        insights.push({
          id: 'sugar-up',
          text: "Your average blood sugar is higher this week. Monitor your carbohydrate intake.",
          type: 'negative',
          icon: <Activity className="text-red-400" size={18} />
        });
      } else if (sugarDiff < -10) {
        insights.push({
          id: 'sugar-down',
          text: "Excellent! Your average blood sugar has stabilized compared to last week.",
          type: 'positive',
          icon: <Activity className="text-emerald-400" size={18} />
        });
      }
    }

    // Mood Insight
    const mood = metrics.find(m => m.label === 'Mood Score');
    if (mood && mood.previous > 0) {
       if (mood.current < 3 && mood.current < mood.previous) {
         insights.push({
           id: 'mood-low',
           text: "Mood has been dipping. Consider a relaxation session or talking to a friend.",
           type: 'neutral',
           icon: <BarChart3 className="text-purple-400" size={18} />
         });
       }
    }

    return { metrics, insights };
  }, [journal]);

  const handleAiDeepDive = async () => {
    if (journal.length < 3) return;
    setIsAiLoading(true);
    setShowAi(true);
    try {
      const summary = journal.slice(0, 14).map(e => `${e.date}: Mood ${e.mood}/5, Sleep ${e.sleep}h, Energy ${e.energy}/5. Notes: ${e.notes}`).join('\n');
      const prompt = `Analyze these health journal entries and find hidden patterns or correlations (e.g., between sleep and mood, or heart rate and stress). Provide 3 specific, actionable insights based on these statistics:\n${summary}`;
      const response = await callGemini(prompt);
      setAiResult(response);
    } catch (error) {
      setAiResult("Error detecting patterns. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!stats || journal.length < 2) {
    return (
      <div className="glass border border-white/10 rounded-[32px] p-10 text-center space-y-6 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none" />
        <div className="w-20 h-20 rounded-3xl glass-morphism border border-teal-500/20 flex items-center justify-center mx-auto text-teal-400 shadow-xl group-hover:scale-110 transition-transform duration-500">
          <Info size={40} />
        </div>
        <div className="space-y-2 relative z-10">
          <h3 className="font-serif text-2xl text-white">Not Enough Data</h3>
          <p className="text-sm text-[var(--muted)] font-medium leading-relaxed max-w-[240px] mx-auto">Log your health for at least 2 separate days to reveal hidden patterns and trends.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg shadow-[var(--teal)]/20">
          <BarChart3 size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight text-white">Trends & Insights</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em]">Statistical health report</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4" role="list">
        {stats.metrics.map((m, idx) => {
          const diff = m.previous > 0 ? ((m.current - m.previous) / m.previous) * 100 : 0;
          const isUp = m.current > m.previous;
          const isNeutral = Math.abs(diff) < 1 || m.previous === 0;
          
          let colorClass = "text-white/40";
          if (!isNeutral) {
            if (m.betterIfHigher === null) colorClass = "text-blue-400";
            else if (m.betterIfHigher) colorClass = isUp ? "text-emerald-400" : "text-red-400";
            else colorClass = isUp ? "text-red-400" : "text-emerald-400";
          }

          return (
            <motion.div
              key={m.label}
              role="listitem"
              aria-label={`${m.label}: ${m.current.toFixed(1)} ${m.unit}. ${isNeutral ? 'Stable' : (isUp ? 'Up' : 'Down') + ' by ' + Math.abs(diff).toFixed(1) + '%'} since last week.`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="glass border border-white/10 rounded-[28px] p-5 flex flex-col justify-between h-36 hover:border-white/20 transition-all shadow-lg"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">{m.label}</div>
              <div className="flex items-baseline gap-1 py-1">
                <div className="text-3xl font-serif text-white tracking-tight">{m.current.toFixed(1)}</div>
                <div className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">{m.unit}</div>
              </div>
              <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 self-start glass-morphism border border-white/5", colorClass)}>
                {isNeutral ? (
                  <>Stable</>
                ) : (
                  <>
                    {isUp ? <TrendingUp size={12} strokeWidth={3} /> : <TrendingDown size={12} strokeWidth={3} />}
                    {Math.abs(diff).toFixed(0)}% vs Prev
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] px-1">Weekly Intelligence</h3>
        {stats.insights.length > 0 ? (
          stats.insights.map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + (i * 0.1) }}
              className={cn(
                "p-5 rounded-[24px] border flex gap-4 items-start shadow-xl",
                insight.type === 'positive' && "glass border-emerald-500/20 shadow-emerald-950/10",
                insight.type === 'negative' && "glass border-red-500/20 shadow-red-950/10",
                insight.type === 'neutral' && "glass border-purple-500/20 shadow-purple-950/10"
              )}
            >
              <div className="mt-0.5 p-2 glass-morphism rounded-xl border border-white/5">{insight.icon}</div>
              <p className="text-sm text-[var(--text2)] leading-relaxed font-medium">{insight.text}</p>
            </motion.div>
          ))
        ) : (
          <div className="glass border border-dashed border-white/10 rounded-[28px] p-8 text-center text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em]">
            Log more data to unlock specific insights.
          </div>
        )}
      </div>

      <div className="glass-darker border border-white/5 rounded-[32px] p-6 space-y-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
        <div className="flex items-center gap-3 text-[var(--teal)] relative z-10">
          <div className="w-8 h-8 rounded-lg glass flex items-center justify-center shadow-lg"><Activity size={18} /></div>
          <h3 className="font-serif text-lg tracking-tight">Data Quality</h3>
        </div>
        <p className="text-xs text-[var(--muted)] leading-relaxed font-medium relative z-10">
          Your trends are currently derived from <span className="text-white font-black">{journal.length}</span> patient log entries. 
          Scientific accuracy increases with consistent daily heart and vital logging.
        </p>
      </div>

      <div className="pt-4">
        <button 
          onClick={handleAiDeepDive}
          disabled={isAiLoading || journal.length < 3}
          aria-label={journal.length < 3 ? 'AI Deep Dive Patterns (Requires 3+ days of logs)' : 'Generate AI Deep Dive Patterns report'}
          className="w-full py-5 glass border border-blue-500/30 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[24px] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          {isAiLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Sparkles size={18} className="text-blue-400" />
          )}
          <span className="relative z-10">{journal.length < 3 ? 'Log 3+ days for AI Patterns' : 'AI Deep Dive Patterns'}</span>
        </button>
      </div>

      <AnimatePresence>
        {showAi && (aiResult || isAiLoading) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="overflow-hidden"
          >
            <div className="glass border border-blue-500/30 rounded-[32px] p-6 pt-5 mt-4 space-y-6 shadow-2xl shadow-blue-900/10 border-b-4 border-b-blue-600/20">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="w-8 h-8 rounded-lg glass flex items-center justify-center"><Sparkles size={18} /></div>
                  <h3 className="font-serif text-lg">AI Vision Analysis</h3>
                </div>
                <button onClick={() => setShowAi(false)} className="w-8 h-8 rounded-lg glass flex items-center justify-center text-[var(--muted)] hover:text-white transition-colors">
                  <ChevronUp size={20} />
                </button>
              </div>
              
              {isAiLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-white/5 rounded-full w-3/4" />
                  <div className="h-4 bg-white/5 rounded-full w-1/2" />
                  <div className="h-4 bg-white/5 rounded-full w-5/6" />
                </div>
              ) : (
                <div className="text-[13px] leading-[1.8] space-y-4 text-white/80 font-medium prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formatMsg(aiResult) }} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
