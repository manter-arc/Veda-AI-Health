import { GoogleGenAI } from "@google/genai";
import { UserProfile } from "../types";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey });

export const SYS_PROMPT = `You are Veda, a warm, knowledgeable, and calm AI health companion with persistent memory. You remember past conversations and patient details across sessions. You help people understand their health better. When a patient says 'remember that...' or 'याद रखो', acknowledge it warmly. Reference their profile and past context naturally to feel like a continuous caring relationship.

RULES:
- You are NOT a doctor. NEVER diagnose.
- Always recommend seeing a real doctor for serious or urgent issues.
- Be warm, clear, and never alarmist. Use plain language.
- Use **bold** for key terms.
- ALWAYS complete your full response — never stop mid-sentence or mid-answer.
- Keep answers concise but complete. Do not cut off. Finish every sentence and every section fully.
- End every response with: "⚠️ I am an AI, not a doctor. Please consult a qualified healthcare professional for medical advice."`;

export async function callGemini(prompt: string, systemInstruction: string = SYS_PROMPT) {
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please configure it in the AI Studio Secrets panel.");
  }

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

export async function analyzeImage(base64Data: string, prompt: string, mimeType: string = "image/jpeg") {
  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt }
          ]
        }
      ],
      config: {
        systemInstruction: SYS_PROMPT,
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
    });

    return response.text || "I'm sorry, I couldn't analyze the image.";
  } catch (error) {
    console.error("Gemini Image API error:", error);
    throw error;
  }
}

export async function analyzeLabReport(base64Data?: string, textContent?: string) {
  if (!apiKey) throw new Error("Gemini API key is missing.");

  const schema = {
    type: "object",
    properties: {
      summary: { type: "string", description: "Plain English summary of the overall report." },
      parameters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            parameter: { type: "string", description: "Name of the test (e.g., Hemoglobin)." },
            value: { type: "string", description: "The result value." },
            range: { type: "string", description: "The normal reference range." },
            status: { type: "string", enum: ["normal", "low", "high", "critical"], description: "Status based on the range." },
            explanation: { type: "string", description: "Brief plain English explanation of what this parameter means." }
          },
          required: ["parameter", "value", "status"]
        }
      },
      dietarySuggestions: { type: "array", items: { type: "string" }, description: "Specific dietary changes suggested based on results." },
      lifestyleSuggestions: { type: "array", items: { type: "string" }, description: "Lifestyle changes suggested." },
      followUpQuestions: { type: "array", items: { type: "string" }, description: "Good questions the user should ask their doctor." },
    },
    required: ["summary", "parameters", "followUpQuestions"]
  };

  const prompt = "Analyze this lab report (blood test/medical report). Extract the values and provide a plain-English explanation of each part. Highlight anything out of range. Provide practical dietary/lifestyle suggestions and specific questions for their doctor.";

  try {
    const parts = [];
    if (base64Data) parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
    if (textContent) parts.push({ text: `Report text content: ${textContent}` });
    parts.push({ text: prompt });

    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.2,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Lab Report Analysis Error:", error);
    throw error;
  }
}

export async function analyzeJournal(notes: string) {
  if (!apiKey) throw new Error("Gemini API key is missing.");

  const schema = {
    type: "object",
    properties: {
      stressLevel: { type: "number", description: "Stress level from 1-10." },
      burnoutRisk: { type: "string", enum: ["low", "moderate", "high"], description: "Risk of burnout." },
      summary: { type: "string", description: "Brief analysis of the mood." },
      recommendation: { type: "string", description: "Recommendation for the user." }
    },
    required: ["stressLevel", "burnoutRisk", "summary", "recommendation"]
  };

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: `Analyze the following journal entry for mood, stress level, and burnout risk: ${notes}` }] }],
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.3,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Journal Analysis Error:", error);
    throw error;
  }
}

export async function generateHealthRoadmap(profile: UserProfile) {
  if (!apiKey) throw new Error("Gemini API key is missing.");

  const schema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the health screening or action." },
        description: { type: "string", description: "Why this is recommended." },
        month: { type: "string", description: "Recommended timing." },
        priority: { type: "string", enum: ["high", "medium", "low"], description: "Priority level." }
      },
      required: ["title", "description", "month", "priority"]
    }
  };

  const prompt = `Based on this user profile: Age: ${profile.age}, Sex: ${profile.sex}, Conditions: ${profile.conditions.join(', ')}. Generate a personalized preventive health roadmap for the next 12 months, suggesting screenings, checkups, and general wellness habits. Return as valid JSON array.`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.3,
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Roadmap Generation Error:", error);
    throw error;
  }
}

export async function generateCallSummary(callTranscript: string) {
  if (!apiKey) throw new Error("Gemini API key is missing.");

  const prompt = `Summarize this tele-consultation call into key points: patient concerns, doctor's diagnosis, and prescribed actions/medications. Use Markdown to format the output.\n\nTranscript / Notes:\n${callTranscript}`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYS_PROMPT,
        temperature: 0.2,
      },
    });

    return response.text || "No summary available.";
  } catch (error) {
    console.error("Call Summary Error:", error);
    throw error;
  }
}

export async function analyzeFood(base64Data: string) {
  if (!apiKey) throw new Error("Gemini API key is missing.");

  const schema = {
    type: "object",
    properties: {
      dishName: { type: "string", description: "Name of the dish." },
      explanation: { type: "string", description: "Brief description of the meal." },
      protein: { type: "number", description: "Estimated protein in grams." },
      carbs: { type: "number", description: "Estimated carbohydrates in grams." },
      fats: { type: "number", description: "Estimated fats in grams." },
      calories: { type: "number", description: "Estimated total calories." }
    },
    required: ["dishName", "calories", "protein", "carbs", "fats"]
  };

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ 
        role: "user", 
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: "Identify the meal in this image, estimate its nutrition (calories, protein, carbs, fats). Return as valid JSON." }
        ] 
      }],
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.2,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Food Analysis Error:", error);
    throw error;
  }
}
