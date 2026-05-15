import { GoogleGenAI } from "@google/genai";
import { UserProfile, JournalEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
  try {
    const response = await ai.models.generateContent({
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

export async function analyzePrescription(base64Data: string) {
  const prompt = `Analyze this medical prescription image. Extract all medications.
  For each medication, find:
  - name: Medicine name
  - dose: e.g. 500mg
  - dailyFrequency: number of times per day (integer)
  - duration: number of days (integer)
  - instructions: e.g. "After food"
  
  Also provide a general summary of the condition being treated.
  Return as valid JSON.`;

  const schema = {
    type: "object",
    properties: {
      medications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            dose: { type: "string" },
            dailyFrequency: { type: "number" },
            duration: { type: "number" },
            instructions: { type: "string" }
          },
          required: ["name", "dose", "dailyFrequency"]
        }
      },
      summary: { type: "string" }
    },
    required: ["medications", "summary"]
  } as const;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: prompt }
          ]
        }
      ],
      config: {
        systemInstruction: "You are a clinical pharmacist. return only JSON. No markdown blocks.",
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Prescription Analysis Error:", error);
    throw error;
  }
}

export async function getWellnessResponse(message: string, history: { role: 'user' | 'model', parts: any[] }[], profile: UserProfile) {
  const systemInstruction = `You are Veda's Wellness Coach. You are an empathetic, calm, and insightful mental health companion.
  Your goals:
  - Provide emotional support and active listening.
  - Suggest stress-reduction techniques (breathing exercises, journaling prompts).
  - Offer guided meditation scripts if requested.
  - Maintain a warm, non-judgmental tone.
  - IF the user expresses thoughts of self-harm or severe clinical distress, gently encourage them to seek professional help and provide SOS resources (e.g., helplines).
  - User Profile context: ${profile.age}yrs, ${profile.sex}.
  - Keep responses concise but meaningful.`;

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      history: history as any,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const result = await chat.sendMessage({ message });
    return result.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Wellness Chat Error:", error);
    throw error;
  }
}

export async function analyzeImage(base64Data: string, prompt: string, mimeType: string = "image/jpeg") {
  try {
    const response = await ai.models.generateContent({
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

export async function analyzeSymptoms(symptom: string, duration: string, severity: number, profile: UserProfile) {
  const schema = {
    type: "object",
    properties: {
      urgency: { 
        type: "string", 
        enum: ["routine", "urgent", "emergency"], 
        description: "How quickly the user should seek medical attention." 
      },
      summary: { type: "string", description: "Brief overview of the concern." },
      likelyCauses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            condition: { type: "string" },
            likelihood: { type: "string", enum: ["High", "Moderate", "Low"] },
            explanation: { type: "string" }
          },
          required: ["condition", "likelihood", "explanation"]
        }
      },
      recommendedActions: { type: "array", items: { type: "string" }, description: "Specific steps the user should take." },
      redFlags: { type: "array", items: { type: "string" }, description: "Symptoms that indicate emergency care is needed." },
      homeCareTips: { type: "array", items: { type: "string" }, description: "Ways to manage symptoms at home." }
    },
    required: ["urgency", "summary", "likelyCauses", "recommendedActions", "redFlags"]
  } as const;

  const prompt = `Patient reports: ${symptom}. Duration: ${duration}. Severity: ${severity}/10. Profile: ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}. Analyze these symptoms to provide likely causes, urgency, and clinical guidance. Return as valid JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.3,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Symptom Analysis Error:", error);
    throw error;
  }
}

export async function generateSmartMedicationSchedule(profile: UserProfile, additionalInfo?: string) {
  const schema = {
    type: "object",
    properties: {
      reminders: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            dose: { type: "string" },
            time: { type: "string", description: "HH:mm format" },
            freq: { type: "string", enum: ["Daily", "Weekly", "Monthly", "Once"] },
            color: { type: "string", enum: ["indigo", "emerald", "rose", "amber", "sky", "purple"] },
            note: { type: "string" }
          },
          required: ["name", "dose", "time", "freq", "color"]
        }
      },
      wellnessTips: { type: "array", items: { type: "string" } }
    },
    required: ["reminders"]
  } as const;

  const medsText = profile.medicines.map(m => `${m.name} (${m.dose}), frequency: ${m.dailyFrequency}x daily`).join('\n');
  const prompt = `Based on the following patient profile and medications, generate a smart, safe, and logical medication schedule.
  
  Patient Profile: ${profile.age}yrs, ${profile.sex}.
  Medical Conditions: ${profile.conditions.join(', ')}.
  Current Medications:
  ${medsText}
  
  Additional context: ${additionalInfo || 'None'}
  
  Requirements:
  - Space out doses logically (e.g., if 2x daily, set morning and evening).
  - Assign distinct colors to different medicines.
  - Add clinical notes (e.g., "Take with food", "Avoid dairy").
  - Ensure times are in 24h HH:mm format.
  
  Return as valid JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.2,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Schedule Generation Error:", error);
    throw error;
  }
}

export async function analyzeLabReport(base64Data?: string, textContent?: string) {
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string", description: "Plain English summary of the overall report." },
      parameters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            parameter: { type: "string" },
            value: { type: "string" },
            range: { type: "string" },
            status: { type: "string", enum: ["normal", "low", "high", "critical"] },
            explanation: { type: "string" }
          },
          required: ["parameter", "value", "status"]
        }
      },
      dietarySuggestions: { type: "array", items: { type: "string" } },
      lifestyleSuggestions: { type: "array", items: { type: "string" } },
      followUpQuestions: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "parameters", "followUpQuestions"]
  } as const;

  const prompt = "Analyze this lab report. Extract values and explain them in plain English. Highlight out-of-range results.";

  try {
    const parts: any[] = [];
    if (base64Data) parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
    if (textContent) parts.push({ text: `Report text content: ${textContent}` });
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
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
  const schema = {
    type: "object",
    properties: {
      stressLevel: { type: "number" },
      burnoutRisk: { type: "string", enum: ["low", "moderate", "high"] },
      summary: { type: "string" },
      recommendation: { type: "string" }
    },
    required: ["stressLevel", "burnoutRisk", "summary", "recommendation"]
  } as const;

  try {
    const response = await ai.models.generateContent({
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
  const schema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        month: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] }
      },
      required: ["title", "description", "month", "priority"]
    }
  } as const;

  const prompt = `Based on this user profile: Age: ${profile.age}, Sex: ${profile.sex}, Conditions: ${profile.conditions.join(', ')}. Generate a personalized preventive health roadmap for the next 12 months.`;

  try {
    const response = await ai.models.generateContent({
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
  const prompt = `Summarize this tele-consultation call into key points: patient concerns, doctor's diagnosis, and prescribed actions/medications. Transcript: ${callTranscript}`;

  try {
    const response = await ai.models.generateContent({
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

export async function analyzeFood(base64Data: string, profile: UserProfile) {
  const schema = {
    type: "object",
    properties: {
      dishName: { type: "string" },
      explanation: { type: "string" },
      protein: { type: "number" },
      carbs: { type: "number" },
      fats: { type: "number" },
      calories: { type: "number" },
      healthTips: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } }
    },
    required: ["dishName", "calories", "protein", "carbs", "fats", "healthTips"]
  } as const;

  const context = `User Profile: ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}.`;
  const prompt = `Identify the meal in this image and estimate nutrition. CONTEXT: ${context}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ 
        role: "user", 
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: prompt }
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

export async function analyzeLockerDocument(base64Data: string, mimeType: string = "image/jpeg") {
  const schema = {
    type: "object",
    properties: {
      category: { type: "string", enum: ["prescription", "scan", "report", "insurance", "other"] },
      name: { type: "string" },
      summary: { type: "string" },
      extractedData: {
        type: "object",
        properties: {
          doctorName: { type: "string" },
          hospital: { type: "string" },
          date: { type: "string" },
          items: { type: "array", items: { type: "string" } }
        }
      },
      suggestions: { type: "array", items: { type: "string" } }
    },
    required: ["category", "name", "summary", "extractedData"]
  } as const;

  const prompt = `Analyze this health document. Detect category, provide name, summary, and extract key data.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data.split(',')[1] || base64Data } },
            { text: prompt }
          ]
        }
      ],
      config: {
        systemInstruction: "You are a clinical document analyzer. Return only JSON.",
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.1,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Locker Analysis Error:", error);
    throw error;
  }
}

export async function generateAppointmentBriefing(journal: JournalEntry[], appointmentType: string) {
  const lastEntries = journal.slice(-10);
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      keySymptoms: { type: "array", items: { type: "string" } },
      suggestedQuestions: { type: "array", items: { type: "string" } },
      lifestyleNotes: { type: "string" }
    },
    required: ["summary", "keySymptoms", "suggestedQuestions"]
  } as const;

  const prompt = `Prepare a concise briefing for a ${appointmentType} visit based on recent health journal entries: ${JSON.stringify(lastEntries)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a clinical preparation assistant. Summarize data succinctly.",
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Briefing Generation Error:", error);
    throw error;
  }
}

export async function generatePostVisitChecklist(notes: string) {
  const schema = {
    type: "object",
    properties: {
      tasks: { 
        type: "array", 
        items: { 
          type: "object",
          properties: {
            title: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            deadline: { type: "string" }
          }
        }
      },
      nextAppointmentSuggestion: { type: "string" }
    },
    required: ["tasks"]
  } as const;

  const prompt = `Convert these record notes into a structured checklist: ${notes}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a post-visit health coordinator. Extract actionable tasks.",
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Post-Visit Checklist Error:", error);
    throw error;
  }
}
