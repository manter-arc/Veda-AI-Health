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
  let canonicalUrl = `${siteUrl}${pathname || '/'}`;

  // 1. Check if we are viewing a specific blog article
  if (pathname.startsWith('/blog/')) {
    const slug = pathname.replace('/blog/', '').replace(/\/$/, '');
    const article = BLOG_ARTICLES[slug];
    if (article) {
      title = article.metaTitle;
      description = article.metaDescription;
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
    </Helmet>
  );
}
