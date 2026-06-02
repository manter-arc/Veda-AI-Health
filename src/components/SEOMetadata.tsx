import React from 'react';
import { Helmet } from 'react-helmet-async';
import { AppMode } from '../types';

interface SEOMetadataProps {
  mode: AppMode;
}

export function SEOMetadata({ mode }: SEOMetadataProps) {
  // Determine site URL dynamically in browser, with fallback
  const siteUrl = typeof window !== 'undefined' && window.location.origin 
    ? window.location.origin 
    : 'https://veda-health.vercel.app';

  // Specific canonical URL based on the current SPA tab/view
  const canonicalUrl = mode && mode !== 'landing' 
    ? `${siteUrl}/?view=${mode}` 
    : `${siteUrl}/`;

  // Page-specific titles and descriptions
  let title = 'Veda AI – AI Symptom Checker & Health Assistant';
  let description = 'Check symptoms with AI in seconds. Get possible causes, health guidance, and next steps with Veda AI.';

  switch (mode) {
    case 'landing':
      title = 'Veda AI – AI Symptom Checker & Health Assistant';
      description = 'Check symptoms with AI in seconds. Get possible causes, health guidance, and next steps with Veda AI.';
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
      // Keep homepage values
      break;
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
