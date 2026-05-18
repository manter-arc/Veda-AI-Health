# Netlify Deployment Guide for Veda Health

To make **Wellness Coach** and **Health Chat AI** work perfectly after deploying to Netlify, follow these steps:

## 1. Set Environment Variables
The most common reason for AI features failing after deployment is a missing API key.
1. Go to your **Netlify Dashboard**.
2. Select your site.
3. Go to **Site selection** > **Environment variables**.
4. Click **Add a variable** > **Create new variable**.
5. Key: `GEMINI_API_KEY`
6. Value: Your Gemini API Key. (You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey)).
7. Save.

## 2. Configure Build Settings
Ensure your build settings are correct in Netlify:
- **Build command**: `npm run build`
- **Publish directory**: `dist`

## 3. SPA Routing
I have added a `netlify.toml` file to your project. This ensures that when you refresh the page on a specific route (like `/wellness`), Netlify doesn't give a 404 error.

## 4. Troubleshooting Firestore "Unavailable"
If you see Firestore connection errors on Netlify:
- We have enabled `experimentalAutoDetectLongPolling` in `src/firebase.ts` to help with restricted network environments.
- Ensure your Firebase project is not in use by too many applications or hitting Spark plan limits.

## 5. Verify Model Names
We are now using the latest `gemini-3-flash-preview` model, which is much more capable and stable for health-related tasks.
