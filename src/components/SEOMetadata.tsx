import React from 'react';
import { Helmet } from 'react-helmet-async';
import { AppMode } from '../types';
import { BLOG_ARTICLES } from '../data/blogData';
import { SYMPTOM_PAGES } from '../data/symptomData';

interface SEOMetadataProps {
  mode: AppMode;
}

export function SEOMetadata({ mode }: SEOMetadataProps) {
  // Determine site URL dynamically in browser, with fallback
  const siteUrl = typeof window !== 'undefined' && window.location.origin 
    ? window.location.origin 
    : 'https://drveda.vercel.app';

  // Get current pathname to set page-specific meta values
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  // Default values
  let title = 'Veda AI – AI Symptom Checker & Health Assistant';
  let description = 'Check symptoms with AI in seconds. Get possible causes, health guidance, and next steps with Veda AI.';
  const canonicalUrl = `${siteUrl}${pathname || '/'}`;

  let activeArticle: any = null;
  let activeSymptom: any = null;
  let activeSlug = '';

  // 1. Check if we are viewing a specific blog article
  if (pathname.startsWith('/blog/')) {
    const slug = pathname.replace('/blog/', '').replace(/\/$/, '');
    const article = BLOG_ARTICLES[slug];
    if (article) {
      title = article.metaTitle;
      description = article.metaDescription;
      activeArticle = article;
      activeSlug = slug;
    } else {
      title = 'Health Blog Articles – Veda AI';
      description = 'Read clinically reviewed articles on symptoms, wellness habits, and wellness strategies.';
    }
  } 
  // 2. Check if we are viewing the general blog list
  else if (pathname === '/blog' || pathname === '/blog/') {
    title = 'Evidence-Based Wellness Blog & Guides | Veda AI';
    description = 'Explore our curated medical articles and health checklists. Learn symptoms, dehydration signs, and wellness strategies with Veda’s AI health app.';
  }
  // 3. Check if we are viewing a specific symptom page
  else if (pathname.startsWith('/symptoms/')) {
    const slug = pathname.replace('/symptoms/', '').replace(/\/$/, '');
    const symptom = SYMPTOM_PAGES[slug];
    if (symptom) {
      title = symptom.metaTitle;
      description = symptom.metaDescription;
      activeSymptom = symptom;
      activeSlug = slug;
    } else {
      title = 'Clinical Symptom Directories | Veda AI';
      description = 'Read clinically reviewed symptom overviews and learn common causes, indicators, and medical red flags.';
    }
  }
  // 4. Fallback to mode-specific matching (like dashboard views)
  else {
    switch (mode) {
      case 'landing':
        title = 'Veda AI – AI Symptom Checker & Health AI Assistant';
        description = 'Veda is a free AI health app & professional symptom analysis tool. Check symptoms with our expert symptom checker AI & health AI assistant instantly.';
        break;
      case 'chat':
        title = 'AI Health Chat – Veda AI';
        description = 'Have a secure, private, and intelligent conversation about your health concerns with Veda AI.';
        break;
      case 'symptoms':
        title = 'Symptom Checker & AI Diagnosis – Veda AI';
        description = 'Describe your symptoms with ease to Veda AI and get immediate, evidence-based health insights.';
        break;
      case 'score':
      case 'vitals':
        title = 'Health Score & Vitals Tracking – Veda AI';
        description = 'Monitor your blood pressure, blood sugar, heart rate, mood, and sleep levels to calculate your personalized wellness score.';
        break;
      case 'opinion':
        title = 'Get an Expert Second Opinion – Veda AI';
        description = 'Evaluate your diagnosis and lab reports against cutting-edge evidence-based clinical insights with Veda AI.';
        break;
      case 'medicine':
      case 'reminders':
        title = 'Medicine Tracker & Refill Reminders – Veda AI';
        description = 'Schedule smart dose alarms, track tablet quantities, set refill trackers, and never miss your prescriptions.';
        break;
      case 'hospital':
      case 'clinic':
        title = 'Find Nearby Hospitals & Clinics – Veda AI';
        description = 'Locate verified doctors, clinics, hospitals, and emergency services nearest to you across India.';
        break;
      case 'journal':
        title = 'Secure Health Journal & Mood Tracker – Veda AI';
        description = 'Log daily sleep, exercise, focus, and symptoms in a highly encrypted, private wellness journal.';
        break;
      case 'auth':
        title = 'Secure Member Portal Login – Veda AI';
        description = 'Access your personal health profile, family health accounts, and secure clinical records.';
        break;
      case 'insurance':
        title = 'Manage Health Insurance & Policies – Veda AI';
        description = 'Compare health coverages, manage policy timelines, analyze document layouts, and find network hospitals.';
        break;
      case 'triage':
        title = 'Smart Clinical Triage – Veda AI';
        description = 'Understand the urgency of your medical concerns and find the most suitable care pathway instantly.';
        break;
      case 'clinical_report':
        title = 'Clinical Summary & PDF Health Report Builder | Veda AI';
        description = 'Package and print a clean, clinically verified summary of your logged symptoms, vitals, and medication timeline for your physical doctor.';
        break;
      case 'scanner':
        title = 'Medical Report & Lab Scanner – Veda AI';
        description = 'Scan papers, prescription orders, and lab results, and extract structured health guidelines in seconds.';
        break;
      default:
        break;
    }
  }

  // Ensure titles are under 60 characters for SEO Best Practices
  if (title.length > 61) {
    title = title.substring(0, 57) + '...';
  }

  // Ensure descriptions are within 140-160 characters
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }

  const ogImageUrl = `${siteUrl}/og-image.png`;

  // --- Dynamic JSON-LD Structured Data Generation ---
  const jsonLdSchemas: any[] = [];

  // 1. Generic Website Schema
  jsonLdSchemas.push({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Veda AI",
    "url": siteUrl,
    "description": "Veda AI is a secure, comprehensive free AI health app & professional symptom analysis tool.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${siteUrl}/?search={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  });

  // 2. Organization Schema
  jsonLdSchemas.push({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Veda AI",
    "url": siteUrl,
    "logo": `${siteUrl}/favicon.ico`,
    "sameAs": [
      "https://twitter.com/veda_health",
      "https://github.com/veda-health"
    ]
  });

  // 3. Base Homepage FAQs (if landing or on homepage)
  if (mode === 'landing' || pathname === '/' || pathname === '') {
    jsonLdSchemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Veda Health and how does this health AI assistant help me?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Veda Health is a secure, comprehensive AI health app designed to empower families. It works as an intelligent, round-the-clock health AI assistant, guiding you through physical symptom verification, translation of scribbled doctor notes, analyzing clinical test reports, and tracking daily vitals in one beautifully integrated dashboard."
          }
        },
        {
          "@type": "Question",
          "name": "Is an AI symptom checker as safe as a traditional internet search?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Absolutely. Standard search engines rank documents by advertising bid rates or simple clicks, which frequently surfaces worst-case conditions and causes unnecessary anxiety. Veda's advanced AI symptom checker uses context-aware diagnostic algorithms. Instead of matching text fields statically, it functions as an empathetic symptom analysis tool, analyzing your specific profile and timelines to deliver balanced, evidence-based triage steps."
          }
        },
        {
          "@type": "Question",
          "name": "Can I use the symptom checker AI for multiple family members?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! Veda was constructed precisely for multi-user family healthcare. Within the portal, you can build personalized health profiles for kids, partners, or parents. When you run a query, our symptom checker AI cross-references that specific member's active medication list, known pre-existing allergies, and vaccination background to yield highly relevant guidance."
          }
        },
        {
          "@type": "Question",
          "name": "Is the symptom analysis tool clinical or should I consult a doctor?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No clinical AI symptom checker or symptom analysis tool can replace a human physician. Veda does not make formal diagnostics or prescribe medications. Rather, it demystifies complex bodily reactions and structured medical documents, helping you organize an informative health log to present directly to your doctor."
          }
        },
        {
          "@type": "Question",
          "name": "How does the prescription scanner protect data safety?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Safety and security are embedded into everything we build. All documents analyzed by our AI health app—whether an uploaded lab report or handwritten prescription image—are processed with standard security protections. Your custom profile history is stored transparently and never shared or sold to external agencies."
          }
        }
      ]
    });
  }

  // 4. Custom Symptom Detail Page Schema
  if (activeSymptom) {
    // 4.a Medical Symptom Condition Schema
    jsonLdSchemas.push({
      "@context": "https://schema.org",
      "@type": "MedicalSymptom",
      "name": activeSymptom.name,
      "description": activeSymptom.overview,
      "possibleTreatment": {
        "@type": "MedicalTherapy",
        "name": "Clinical overview, medical symptom verification, and medical monitoring"
      },
      "possibleCause": activeSymptom.commonCauses.map((cause: any) => ({
        "@type": "MedicalCause",
        "name": cause.name,
        "description": cause.description
      }))
    });

    // 4.b Symptom-Specific FAQ Page Schema
    if (activeSymptom.faqs && activeSymptom.faqs.length > 0) {
      jsonLdSchemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": activeSymptom.faqs.map((faq: any) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      });
    }

    // 4.c Symptom Breadcrumb Schema
    jsonLdSchemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Symptom Directories",
          "item": `${siteUrl}/symptoms`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": activeSymptom.name,
          "item": `${siteUrl}/symptoms/${activeSlug}`
        }
      ]
    });
  }

  // 5. Custom Blog Article Page Schema
  if (activeArticle) {
    // 5.a Article/BlogPosting Schema
    jsonLdSchemas.push({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${siteUrl}/blog/${activeSlug}`
      },
      "headline": activeArticle.title,
      "description": activeArticle.metaDescription,
      "image": activeArticle.image || `${siteUrl}/og-image.png`,
      "datePublished": "2026-06-03T08:00:00Z",
      "dateModified": "2026-06-03T08:00:00Z",
      "author": {
        "@type": "Person",
        "name": activeArticle.author || "Veda Medical Board"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Veda AI",
        "logo": {
          "@type": "ImageObject",
          "url": `${siteUrl}/favicon.ico`
        }
      }
    });

    // 5.b Blog-Specific FAQ Page Schema
    if (activeArticle.faqs && activeArticle.faqs.length > 0) {
      jsonLdSchemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": activeArticle.faqs.map((faq: any) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      });
    }

    // 5.c Blog Breadcrumb Schema
    jsonLdSchemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Wellness Blog",
          "item": `${siteUrl}/blog`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": activeArticle.title,
          "item": `${siteUrl}/blog/${activeSlug}`
        }
      ]
    });
  }

  return (
    <Helmet>
      {/* Primary HTML Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImageUrl} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImageUrl} />

      {/* Injected Rich Snippets (JSON-LD Microdata) */}
      {jsonLdSchemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
