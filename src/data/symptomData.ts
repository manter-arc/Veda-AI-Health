export interface SymptomCause {
  name: string;
  probability: 'High' | 'Moderate' | 'Low';
  description: string;
}

export interface SymptomDetail {
  slug: string;
  name: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  overview: string;
  introImage: string;
  keywords: string[];
  commonCauses: SymptomCause[];
  whenToSeekAttention: string[];
  faqs: { question: string; answer: string }[];
  relatedBlogSlugs: string[];
  relatedSymptomSlugs: string[];
}

export const SYMPTOM_PAGES: Record<string, SymptomDetail> = {
  'headache': {
    slug: 'headache',
    name: 'Headache',
    title: 'Symptom Guide: Understanding Headaches & Cranial Pressure',
    metaTitle: 'Headaches Guide: Types, Causes & Home Care | Veda AI',
    metaDescription: 'Is your headache from stress, tension, dehydration, or sinuses? Learn when to visit a practitioner and how our AI symptom checker guides your next steps.',
    overview: 'A headache refers to any degree of pain, tightness, or throbbing located in any region of the head or upper neck. Headaches are exceptionally common but can present in vastly different patterns—from dull, generalized tension to severe, debilitating, localized migraine attacks. Identifying the specific headache type is critical for matching management protocols.',
    introImage: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
    keywords: ['AI symptom checker', 'symptom checker AI', 'headache causes', 'symptom analysis tool'],
    commonCauses: [
      {
        name: 'Tension-Type Headache',
        probability: 'High',
        description: 'Caused by muscle contractions in the neck and scalp, often triggered by stress, poor posture, or prolonged computer use.'
      },
      {
        name: 'Dehydration Headache',
        probability: 'High',
        description: 'Caused by a temporary deficit in water volume, constricting cranial blood vessels and causing dull, throbbing pain.'
      },
      {
        name: 'Migraine',
        probability: 'Moderate',
        description: 'A pulsating, chemical and vascular reaction on one side of the brain accompanied by nausea, sensitivity to light, and visual halos.'
      },
      {
        name: 'Sinus Congestion',
        probability: 'Moderate',
        description: 'As sinus cavities fill with mucus during allergies or cold infections, pressure builds behind the forehead, nose, and eyes.'
      }
    ],
    whenToSeekAttention: [
      'Sudden onset of severe, explosive pain resembling a thunderclap (worst headache of your life)',
      'Headache accompanied by speech slurring, vision loss, or balance loss',
      'Pain that increases rapidly after a hard blow to the head',
      'Headache with high fever, stiff neck, vomiting, or confusion',
      'New or unusual headache pattern if you are over 50 years of age or have a compromised immune system'
    ],
    faqs: [
      {
        question: 'Does the location of head pain indicate what is triggering it?',
        answer: 'Yes, often. A tight band around the entire forehead usually points to tension. Pain behind one eye points to a cluster headache or sinus issue. Pain on one side with throbbing is typical of a migraine, and neck-to-scalp pain points to muscle tension.'
      },
      {
        question: 'How do I use Veda’s AI symptom checker for headache pain?',
        answer: 'By entering the exact location, intensity (1-10), duration, and associated signs like nausea or vision changes into Veda, our system asks precise follow-up questions to categorize severity and guide your next clinical actions.'
      }
    ],
    relatedBlogSlugs: ['headache-causes', 'dehydration-signs'],
    relatedSymptomSlugs: ['fatigue']
  },

  'fever': {
    slug: 'fever',
    name: 'Fever',
    title: 'Symptom Guide: Elevated Body Temperature & Immune Response',
    metaTitle: 'Fever Guide: High Temperature, Causes & Triage | Veda AI',
    metaDescription: 'Understand why a fever occurs, what constitutes a high-grade fever, and when to seek urgent medical attention. Empower yourself with a symptom analysis tool.',
    overview: 'A fever is a temporary rise in normal basal body temperature (typically above 100.4°F or 38°C) that indicates your immune system is actively fighting off an underlying infection, toxin, or illness. Fever is not a disease in itself, but rather an active, adaptive system response triggered by biochemical proteins called pyrogens.',
    introImage: 'https://images.unsplash.com/photo-1584030373081-f37b7bb4fa8e?auto=format&fit=crop&w=800&q=80',
    keywords: ['AI symptom checker', 'symptom checker AI', 'health AI assistant', 'fever symptoms'],
    commonCauses: [
      {
        name: 'Viral Infections (e.g., Influenza or Cold)',
        probability: 'High',
        description: 'Simple upper respiratory viral pathogens are the leading cause, typically presenting with chills, body aches, and nasal discharge.'
      },
      {
        name: 'Bacterial Infections (e.g., Strep Throat, UTI)',
        probability: 'Moderate',
        description: 'Bacterial invaders create highly localized inflammatory processes and usually require prescription antibiotic support.'
      },
      {
        name: 'Immunological Reactions',
        probability: 'Moderate',
        description: 'A fever can occur temporarily following vaccine administration or as a flare-up of autoimmune conditions like rheumatoid arthritis.'
      }
    ],
    whenToSeekAttention: [
      'In infants younger than 3 months with a temperature of 100.4°F (38°C) or higher',
      'The temperature stays above 103°F (39.4°C) in adults despite taking over-the-counter fever reducers',
      'The fever lasts longer than 3 consecutive days',
      'Fever accompanied by difficulty breathing, severe chest pain, or severe stiff neck',
      'Extreme lethargy, confusion, or inability to keep clear liquids down'
    ],
    faqs: [
      {
        question: 'What is the correct way to measure physical temperature?',
        answer: 'Oral digital thermometers are highly accurate for adults. Forehead scanners are fast but moderately affected by sweat, and tympanic (ear) or rectal pathways are preferred for toddlers and infants.'
      },
      {
        question: 'Should I take fever-reducing medication immediately?',
        answer: 'If the fever is mild (under 101°F) and you can rest comfortably, letting the body fight the infection naturally is often beneficial. If you feel severe body aches or chills, or if the temperature rises, medications like paracetamol or ibuprofen can alleviate discomfort.'
      }
    ],
    relatedBlogSlugs: ['why-googling-symptoms-causes-anxiety', 'dehydration-signs'],
    relatedSymptomSlugs: ['headache', 'fatigue']
  },

  'stomach-pain': {
    slug: 'stomach-pain',
    name: 'Stomach Pain',
    title: 'Symptom Guide: Abdominal Discomfort, Cramping & Bloating',
    metaTitle: 'Abdominal pain & Stomach cramps: Causes & Guidance | Veda AI',
    metaDescription: 'Explore the different types and locations of abdominal pain. Use Veda AI clinical helper to understand cramps, reflux, or when it could represent an appendix issue.',
    overview: 'Stomach pain, commonly referred to as abdominal pain, describes aches or discomfort in any region between your lower ribcage and pelvis. Because this area contains vital culinary, digestive, and excretory organs, abdominal pain has a broad spectrum of possible origins. Localizing the pain to specific quadrants is highly helpful for rapid triage.',
    introImage: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    keywords: ['AI symptom checker', 'symptom checker AI', 'health AI assistant', 'symptom analysis tool'],
    commonCauses: [
      {
        name: 'Gastroenteritis (Stomach Bugs)',
        probability: 'High',
        description: 'Viral or foodborne sickness causing abdominal spasms and cramps, often accompanied by mild nausea, diarrhea, or low fever.'
      },
      {
        name: 'Indigestion & Acid Reflux',
        probability: 'High',
        description: 'Upper abdominal burning located or felt behind the breastbone, triggered by spicy foods, heavy meals, or caffeine.'
      },
      {
        name: 'Irritable Bowel Syndrome (IBS)',
        probability: 'Moderate',
        description: 'Chronic gut sensitivity resulting in alternating patterns of gas, bloating, stomach constipation, or loose bowel motions.'
      },
      {
        name: 'Appendicitis',
        probability: 'Low',
        description: 'An emergency condition where the appendix becomes inflamed. It usually begins with a dull ache near the navel and shifts to sharp, acute pain in the lower right quadrant.'
      }
    ],
    whenToSeekAttention: [
      'Incredibly severe, sudden abdominal pain that makes it impossible to stand or move',
      'High fever, chills, persistent vomiting, or inability to digest food or water',
      'The abdomen is highly sensitive or tender to pressure, or feels hard and board-like',
      'Bloody diarrhea, black tarry stools, or vomiting blood',
      'Pain that radiates directly into your shoulder, back, or groin'
    ],
    faqs: [
      {
        question: 'Does the quadrant/location of stomach pain matter?',
        answer: 'Yes, immensely. Upper right pain can indicate gallbladder issues. Lower right pain is a focal sign of appendicitis. Lower left pain is common for diverticulitis, and central burning suggests acid indigestion.'
      },
      {
        question: 'When should I visit a hospital clinic for gut pain?',
        answer: 'Go immediately if the pain is sudden and severe, your stomach is tender to the touch, you cannot stop vomiting, or you observe blood in your stool.'
      }
    ],
    relatedBlogSlugs: ['why-googling-symptoms-causes-anxiety', 'dehydration-signs'],
    relatedSymptomSlugs: ['headache', 'fatigue']
  },

  'fatigue': {
    slug: 'fatigue',
    name: 'Fatigue',
    title: 'Symptom Guide: Persistent Lethargy, Fatigue & Exhaustion',
    metaTitle: 'Exhaustion & Chronic Fatigue: Causes, Signals & Support | Veda AI',
    metaDescription: 'Struggling with low energy, mind fog, or persistent fatigue? Learn about vitamins, sleep disruptions, and how Veda AI parses persistent exhaustion.',
    overview: 'Fatigue is a feeling of constant weariness, low stamina, and physical or mental exhaustion that does not improve with simple sleep or rest. Unlike everyday tiredness, clinical fatigue impairs cognitive productivity, focus, and physical endurance over extended periods, signaling potential energetic or vitamin-related needs.',
    introImage: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
    keywords: ['AI symptom checker', 'symptom checker AI', 'health AI assistant', 'dehydration signs'],
    commonCauses: [
      {
        name: 'Ongoing Sleep Deprivation or Apnea',
        probability: 'High',
        description: 'Consistently getting less than 7 hours of sleep, or suffering from sleep apnea where nighttime airway collapse interrupts deep REM sleep.'
      },
      {
        name: 'Inadequate Hydration levels',
        probability: 'High',
        description: 'Low fluid levels drop blood pressure, reducing oxygen flow to active muscles and organs and creating deep physical fatigue.'
      },
      {
        name: 'Vitamin Deficiencies (Vitamin D, B12, Iron)',
        probability: 'Moderate',
        description: 'Low red blood cell count (anemia) or vitamin deficits directly restrict energy production systems at the cellular level.'
      },
      {
        name: 'Chronic Stress or Thyroid Dysfunction',
        probability: 'Moderate',
        description: 'Prolonged elevations in cortisol burn out metabolic pathways, or an underactive thyroid (hypothyroidism) slows metabolism.'
      }
    ],
    whenToSeekAttention: [
      'Fatigue accompanied by sudden weight loss, fever, night sweats, or swollen lymph glands',
      'Shortness of breath, chest pains, or rapid irregular heartbeats with minimal exertion',
      'Severe, constant headaches or changes in vision',
      'Feelings of deep, clinical depression, mental numbness, or thoughts of self-harm',
      'Fatigue that is completely incapacitating and lasts for more than 4 consecutive weeks'
    ],
    faqs: [
      {
        question: 'Are fatigue and tiredness the same thing?',
        answer: 'No, tiredness is a normal response to physical activity or a long day and is relieved by a good night of restful sleep. Fatigue is chronic, persistent, and does not improve with sleep, severely affecting your daily capacity.'
      },
      {
        question: 'How can tracking sleep with Veda AI assist with fatigue?',
        answer: 'Using Veda’s health journal and score analyzer, you can cross-reference sleep durations, mood levels, exercise frequency, and symptoms to discover patterns that might be draining your energy reservoirs.'
      }
    ],
    relatedBlogSlugs: ['dehydration-signs', 'headache-causes'],
    relatedSymptomSlugs: ['headache', 'fever']
  }
};
