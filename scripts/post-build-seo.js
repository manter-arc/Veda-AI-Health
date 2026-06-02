import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');
const publicDir = path.join(process.cwd(), 'public');

// 1. Resolve site URL from Vercel environment variables or dynamic settings
let siteUrl = process.env.VITE_SITE_URL || '';

if (!siteUrl) {
  // If Vercel environment variables are available, build the URL
  const vercelProjectUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelUrl = process.env.VERCEL_URL;
  
  if (vercelProjectUrl) {
    siteUrl = `https://${vercelProjectUrl}`;
  } else if (vercelUrl) {
    siteUrl = `https://${vercelUrl}`;
  } else {
    // Default fallback url if not specified
    siteUrl = 'https://drveda.vercel.app';
  }
}

// Strip trailing slash for consistency
if (siteUrl.endsWith('/')) {
  siteUrl = siteUrl.slice(0, -1);
}

console.log(`[SEO Build Script] Using resolved Production Domain: ${siteUrl}`);

// 2. Helper to replace fallbacks with the production domain
function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[SEO Build Script] File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace fallback domains with resolved siteUrl
  const originalFallback = 'https://drveda.vercel.app';
  const updatedContent = content.replaceAll(originalFallback, siteUrl);
  
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log(`[SEO Build Script] Successfully updated metadata URLs in: ${filePath}`);
}

// Update sitemap.xml in both source and output
processFile(path.join(publicDir, 'sitemap.xml'));
processFile(path.join(distDir, 'sitemap.xml'));

// Update fallback index.html in output dist directory
processFile(path.join(distDir, 'index.html'));
