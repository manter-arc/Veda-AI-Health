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
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[var(--teal-dim)]/10 flex items-center justify-center mx-auto text-[var(--teal)]">
          <Info size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif text-lg">Not Enough Data Yet</h3>
          <p className="text-sm text-[var(--muted)]">Log your health for at least 2 separate days to see trends and insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
          <BarChart3 size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Trends & Insights</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Statistical health report</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3" role="list">
        {stats.metrics.map((m, idx) => {
          const diff = m.previous > 0 ? ((m.current - m.previous) / m.previous) * 100 : 0;
          const isUp = m.current > m.previous;
          const isNeutral = Math.abs(diff) < 1 || m.previous === 0;
          
          let colorClass = "text-gray-400";
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between h-32"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{m.label}</div>
              <div className="flex items-baseline gap-1">
                <div className="text-2xl font-serif text-[var(--text)]">{m.current.toFixed(1)}</div>
                <div className="text-[10px] font-medium text-[var(--muted)]">{m.unit}</div>
              </div>
              <div className={cn("text-[10px] font-bold flex items-center gap-1", colorClass)}>
                {isNeutral ? (
                  <><Minus size={12} /> Stable</>
                ) : (
                  <>
                    {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(diff).toFixed(1)}% vs last week
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] px-1">Weekly Insights</h3>
        {stats.insights.length > 0 ? (
          stats.insights.map((insight) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "p-4 rounded-2xl border flex gap-4 items-start",
                insight.type === 'positive' && "bg-emerald-500/5 border-emerald-500/10",
                insight.type === 'negative' && "bg-red-500/5 border-red-500/10",
                insight.type === 'neutral' && "bg-purple-500/5 border-purple-500/10"
              )}
            >
              <div className="mt-0.5">{insight.icon}</div>
              <p className="text-sm text-[var(--text2)] leading-relaxed">{insight.text}</p>
            </motion.div>
          ))
        ) : (
          <div className="bg-[var(--card)] border border-dashed border-[var(--border)] rounded-2xl p-6 text-center text-sm text-[var(--muted)]">
            Keep logging to unlock deeper insights.
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-[var(--teal-dim)]/5 to-transparent border border-[var(--teal-dim)]/20 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-[var(--teal)]">
          <Activity size={18} />
          <h3 className="font-serif">Data Quality</h3>
        </div>
        <p className="text-xs text-[var(--text2)] leading-relaxed">
          Your trends are currently based on <span className="text-[var(--text)] font-bold">{journal.length}</span> log entries. 
          Consistent daily logging provides more accurate health insights.
        </p>
      </div>

      <div className="pt-4">
        <button 
          onClick={handleAiDeepDive}
          disabled={isAiLoading || journal.length < 3}
          aria-label={journal.length < 3 ? 'AI Deep Dive Patterns (Requires 3+ days of logs)' : 'Generate AI Deep Dive Patterns report'}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
        >
          {isAiLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
          {journal.length < 3 ? 'Log 3+ days for AI Patterns' : 'AI Deep Dive Patterns'}
        </button>
      </div>

      <AnimatePresence>
        {showAi && (aiResult || isAiLoading) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400">
                  <Sparkles size={18} />
                  <h3 className="font-serif">AI Vision Report</h3>
                </div>
                <button onClick={() => setShowAi(false)} className="text-[var(--muted)] hover:text-white">
                  <ChevronUp size={20} />
                </button>
              </div>
              
              {isAiLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-blue-500/10 rounded w-3/4" />
                  <div className="h-4 bg-blue-500/10 rounded w-1/2" />
                  <div className="h-4 bg-blue-500/10 rounded w-5/6" />
                </div>
              ) : (
                <div className="text-sm leading-relaxed space-y-4 text-[var(--text2)]" dangerouslySetInnerHTML={{ __html: formatMsg(aiResult) }} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
