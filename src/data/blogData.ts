export interface FAQItem {
  question: string;
  answer: string;
}

export interface BlogArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: string;
  date: string;
  readTime: string;
  author: string;
  summary: string;
  image: string;
  keywords: string[];
  content: {
    sectionTitle: string;
    text: string;
    subsections?: { title: string; text: string }[];
  }[];
  faqs: FAQItem[];
  relatedArticlesSlugs: string[];
  relatedSymptomsSlugs: string[];
}

export const BLOG_ARTICLES: Record<string, BlogArticle> = {
  'headache-causes': {
    slug: 'headache-causes',
    title: 'Understanding Headache Causes: When Tension Highlights Hidden Triggers',
    metaTitle: 'Headache Causes & Triggers: When to Seek Medical Help | Veda AI',
    metaDescription: 'Discover the most common headache causes including tension, climate change, and lifestyle triggers. Learn when a headache might require instant medical care.',
    category: 'Symptom Guide',
    date: 'June 02, 2026',
    readTime: '6 min read',
    author: 'Dr. Anita Roy, Chief Medical Advisor',
    summary: 'Headaches are among the most common ailments worldwide, yet pinpointing the exact cause can be challenging. Learn about primary vs. secondary triggers and how to identify yours.',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
    keywords: ['headache causes', 'AI symptom checker', 'symptom checker AI', 'health AI assistant', 'symptom analysis tool'],
    content: [
      {
        sectionTitle: 'What Causes a Headache?',
        text: 'Almost everyone experiences headaches occasionally. While most headaches are harmless, identifying the root cause can help you discover structural relief. Primary headaches are standalone conditions directly caused by overactivity or dysfunction of pain-sensitive structures in your head. Examples include tension headaches, migraines, and cluster headaches. Utilizing an expert symptom analysis tool can help you structure your medical history before consulting a physician.'
      },
      {
        sectionTitle: 'Common Primary Headache Triggers',
        text: 'Primary headaches can be activated by several everyday lifestyle elements, environment changes, or food choices:',
        subsections: [
          {
            title: 'Dehydration and Fluid Deficit',
            text: 'A mild drop in hydration levels causes blood vessels in the brain to constrict temporarily, triggering a dehydration headache. This is often accompanied by dark urine, dry mouth, or dry skin.'
          },
          {
            title: 'Muscle Tension and Electronic Eye Strain',
            text: 'Spending hours in front of terminal or laptop monitors strains ocular muscles and compromises neck posture. This tension radiates upwards, forming a classic band-like tension headache.'
          },
          {
            title: 'Dietary Intolerances and Caffeine Fluctuations',
            text: 'Aged cheeses, processed meats containing nitrates, artificial sweeteners, and sudden withdrawal from caffeine can trigger acute migraine attacks in susceptible individuals.'
          }
        ]
      },
      {
        sectionTitle: 'Primary vs. Secondary Headaches: Knowing the Difference',
        text: 'Secondary headaches are symptoms of another underlying medical complication. Unlike primary headaches, secondary headaches point to separate structural issues ranging from sinus infections to vascular complications. When diagnosing, a patient can run their symptoms through a smart symptom checker AI to understand check-in steps, though clinical assessment remains the gold standard.'
      },
      {
        sectionTitle: 'When to Seek Urgent Emergency Care',
        text: 'Consult emergency services immediately if your headache is accompanied by sudden numbness, difficulty speaking, severe confusion, a stiff neck, high fever, or if it represents the most painful headache you have ever experienced (often called a "thunderclap headache").'
      }
    ],
    faqs: [
      {
        question: 'Does drinking water instantly cure a dehydration headache?',
        answer: 'While hydrating can alleviate a dehydration-induced headache, it typically takes 30 minutes to 2 hours of moderate fluid absorption to fully restore hydration balance and soothe active headaches.'
      },
      {
        question: 'How can an AI symptom checker help with headaches?',
        answer: 'An AI symptom checker acts as a preliminary health companion, analyzing factors like location, severity, duration, and associated symptoms to suggest potential causes and direct you to the right care pathway.'
      },
      {
        question: 'What is the most common form of headache?',
        answer: 'Tension-type headaches are the most widespread, affecting up to 80% of adults. They feel like a tight band squeezed around the forehead.'
      }
    ],
    relatedArticlesSlugs: ['dehydration-signs', 'why-googling-symptoms-causes-anxiety'],
    relatedSymptomsSlugs: ['headache', 'fatigue']
  },

  'dehydration-signs': {
    slug: 'dehydration-signs',
    title: '5 Subtle Dehydration Signs You Are Probably Ignoring',
    metaTitle: '5 Dehydration Signs & Symptoms: Hidden Risks | Veda AI',
    metaDescription: 'Explore the 5 subtle dehydration signs your body is sending you. Find out how fluid balance affects energy levels, focusing, and joint health.',
    category: 'Daily Wellness',
    date: 'May 28, 2026',
    readTime: '5 min read',
    author: 'Dr. Vivek Sharma, MD',
    summary: 'Waiting until you feel extremely thirsty means you are already mildly dehydrated. Discover the silent indicators that tell you it is time to drink water.',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=800&q=80',
    keywords: ['dehydration signs', 'AI health app', 'symptom checker AI', 'health AI assistant', 'symptom analysis tool'],
    content: [
      {
        sectionTitle: 'The Hidden Dangers of Mild Dehydration',
        text: 'Our biological systems consist of nearly 60% fluid. Water regulates body temperature, lubricates joints, aids digestion, and transports critical structural nutrients. Mild dehydration—just a 1.5% loss in normal water volume—can degrade physical performance, weaken alertness, and trigger acute headaches. Keeping a close eye on these signals with a health AI assistant is an excellent way to maintain long-term metabolic health.'
      },
      {
        sectionTitle: 'The 5 Subtle Indicators You Need Water',
        text: 'While thirst is the most obvious sign of needing water, your body has several other ways of signaling dehydration:',
        subsections: [
          {
            title: '1. Unexplained Sugar Cravings',
            text: 'When dehydrated, organs like the liver struggle to release glycogen (stored glucose) into the bloodstream, confusing your metabolic systems into signaling sugar cravings.'
          },
          {
            title: '2. Persistent Bad Breath (Halitosis)',
            text: 'Dehydration limits saliva production. Saliva possesses critical antibacterial properties; without sufficient flow, odor-causing oral bacteria multiply rapidly.'
          },
          {
            title: '3. Cognitive Fog and Sudden Mood Swings',
            text: 'A decrease in cellular volume affects brain hydration directly. This leads to difficulties in concentration, memory retrieval shifts, and short-term weariness.'
          },
          {
            title: '4. Skin Turgor Decrease and Dryness',
            text: 'Pinch the skin on the back of your hand. If it takes several seconds to snap back into position rather than smoothing instantly, you have low tissue hydration.'
          },
          {
            title: '5. Dull Headache and Muscle Cramp Sensations',
            text: 'Decreased circulatory volume alters electrolyte density, resulting in hypersensitive nerves and muscles which trigger spasms and throbbing head pain.'
          }
        ]
      },
      {
        sectionTitle: 'How to Build a Sustainable Hydration habit',
        text: 'Aim for structured hydration rather than drinking massive quantities at once. Keep a reusable steel flask visible on your work desk. Try adding natural visual cues, like cucumber or lemon slices, and drink a glass of pure, filtered water directly upon waking up.'
      }
    ],
    faqs: [
      {
        question: 'What color should my urine be if I am properly hydrated?',
        answer: 'Properly hydrated urine is a pale, translucent straw color. If it is dark yellow, amber, or honey-colored, you should increase water intake immediately.'
      },
      {
        question: 'Are sports drinks better than water for rehydrating?',
        answer: 'For everyday moderate activity, pure water is exceptional. Sports drinks are only superior during intense workouts exceeding 60 minutes where electrolyte replacement is critical.'
      }
    ],
    relatedArticlesSlugs: ['headache-causes', 'why-googling-symptoms-causes-anxiety'],
    relatedSymptomsSlugs: ['fatigue', 'headache']
  },

  'why-googling-symptoms-causes-anxiety': {
    slug: 'why-googling-symptoms-causes-anxiety',
    title: 'Why Googling Medical Symptoms Causes Cyberchondria (And How AI Helps)',
    metaTitle: 'The Danger of Googling Symptoms & Cyberchondria | Veda AI',
    metaDescription: 'Why does searching medical issues online always lead to extreme health anxiety? Learn how a modern AI symptom checker provides balanced guidance.',
    category: 'Digital Mental Health',
    date: 'May 15, 2026',
    readTime: '7 min read',
    author: 'Sarah Jenkins, Clinical Psychologist',
    summary: 'Searching a simple twitch online often redirects to catastrophic diagnoses. Understand cyberchondria and how modern AI tools offer a personalized, evidence-based alternative.',
    image: 'https://images.unsplash.com/photo-1516062423079-7ca13cca775f?auto=format&fit=crop&w=800&q=80',
    keywords: ['cyberchondria', 'AI symptom checker', 'symptom checker AI', 'health AI assistant', 'AI health app', 'symptom analysis tool'],
    content: [
      {
        sectionTitle: 'The "Search Soap-Opera" and Health Anxiety',
        text: 'We have all been there: a slight muscle twitch or a mild cough prompts a quick query in a generic search box. Within three clicks, search algorithms—which thrive on high engagement and dramatic headlines—show forum pages discussing severe neurological issues or terminal respiratory failures. This psychological loop of doom-scrolling and scanning worst-case diagnoses has a clinical name: cyberchondria.'
      },
      {
        sectionTitle: 'Why Search Engines Fail at Patient Triage',
        text: 'Traditional search portals treat words as simple text matches. They do not cross-reference your age, chronic medications, underlying clinical profile, or actual lifestyle records. Instead, they show documents ranked by SEO optimization and click counts, prioritizing rare, fatal, or alarming syndromes over common, mild causes.'
      },
      {
        sectionTitle: 'The AI Symptom Checker: A Personalized, Scientific Path Forward',
        text: 'In contrast to search engines, a modern symptom checker AI parses clinical relationships holistically. By querying the patient on localized factors, age, timelines, and pre-existing medical diagnoses, a high-fidelity AI health app can cross-reference an vast catalog of medical cases immediately.',
        subsections: [
          {
            title: 'Dynamic Questioning and Clinical Logic',
            text: 'Rather than dumping static, unfiltered articles, a symptom analysis tool acts like an empathetic clinical assistant: it asks context-aware follow-up questions to understand the scope of the issue.'
          },
          {
            title: 'Somatic Demystification without Alarmism',
            text: 'Advanced models are specifically guardrailed to remain balanced and objective. They outline highly probable causes (e.g., muscle strain or fatigue) while providing proper visibility into clear red flags without inducing panic.'
          }
        ]
      },
      {
        sectionTitle: 'How to Reclaim Peace of Mind',
        text: 'The next time you encounter an odd somatic signal, take a deep breath. Instead of launching dozens of search tabs that spiral into anxiety, consult a verified, secure AI tool or schedule a consult with your local primary practitioner.'
      }
    ],
    faqs: [
      {
        question: 'What is cyberchondria?',
        answer: 'Cyberchondria is a form of health anxiety amplified by repeated, obsessive web searches for medical information, leading to heightened anxiety and constant reassurance-seeking.'
      },
      {
        question: 'Can I trust an AI health assistant completely?',
        answer: 'An AI assistant is an educational tool designed to clarify pathways and organize pre-consult reports. It does not replace physical examination or professional primary care doctors.'
      }
    ],
    relatedArticlesSlugs: ['headache-causes', 'dehydration-signs'],
    relatedSymptomsSlugs: ['headache', 'fatigue', 'stomach-pain']
  }
};
