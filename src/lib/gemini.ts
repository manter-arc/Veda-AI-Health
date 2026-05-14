import { GoogleGenAI } from "@google/genai";
import { UserProfile, JournalEntry } from "../types";

let genAIInstance: any = null;

function getGenAI() {
  if (!genAIInstance) {
    const key = typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || "") : "";
    genAIInstance = new GoogleGenAI({ apiKey: key || 'missing-key' });
  }
  return genAIInstance;
}

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
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

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
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

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
      model: "gemini-flash-latest",
      history: history,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const result = await chat.sendMessage({ message: message });
    return result.text;
  } catch (error) {
    console.error("Wellness Chat Error:", error);
    throw error;
  }
}

export async function analyzeImage(base64Data: string, prompt: string, mimeType: string = "image/jpeg") {
  const ai = getGenAI();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

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
  };

  const prompt = `Patient reports: ${symptom}. Duration: ${duration}. Severity: ${severity}/10. Profile: ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}. Analyze these symptoms to provide likely causes, urgency, and clinical guidance. Return as valid JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

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
  };

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
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

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

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

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
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

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
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

  const prompt = `Summarize this tele-consultation call into key points: patient concerns, doctor's diagnosis, and prescribed actions/medications. Use Markdown to format the output.\n\nTranscript / Notes:\n${callTranscript}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

  const schema = {
    type: "object",
    properties: {
      dishName: { type: "string", description: "Name of the dish." },
      explanation: { type: "string", description: "Brief description of the meal." },
      protein: { type: "number", description: "Estimated protein in grams." },
      carbs: { type: "number", description: "Estimated carbohydrates in grams." },
      fats: { type: "number", description: "Estimated fats in grams." },
      calories: { type: "number", description: "Estimated total calories." },
      healthTips: { type: "array", items: { type: "string" }, description: "Tips tailored to user medical history." },
      warnings: { type: "array", items: { type: "string" }, description: "Specific medical warnings based on user history (e.g. high sugar for diabetics)." }
    },
    required: ["dishName", "calories", "protein", "carbs", "fats", "healthTips"]
  };

  const context = `User Profile: ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}.`;
  const prompt = `Identify the meal in this image and estimate its nutrition (calories, protein, carbs, fats). 
  CONTEXT: ${context}
  Provide personalized health tips and any necessary warnings based on their medical history. 
  Return as valid JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
  const ai = getGenAI();

  const schema = {
    type: "object",
    properties: {
      category: { 
        type: "string", 
        enum: ["prescription", "scan", "report", "insurance", "other"],
        description: "Automatic detection of document type."
      },
      name: { type: "string", description: "A suitable file name based on content." },
      summary: { type: "string", description: "Plain English summary of the document." },
      extractedData: {
        type: "object",
        description: "Key structured data found in the document.",
        properties: {
          doctorName: { type: "string" },
          hospital: { type: "string" },
          date: { type: "string" },
          items: { 
            type: "array", 
            items: { type: "string" },
            description: "List of extracted findings, meds, or parameters." 
          }
        }
      },
      suggestions: { type: "array", items: { type: "string" }, description: "AI suggestions like 'Sync to Medical Records' or 'Add Reminder'." }
    },
    required: ["category", "name", "summary", "extractedData"]
  };

  const prompt = `Analyze this health document. 
  1. Detect its category (prescription, scan, lab report, insurance, etc).
  2. Provide a descriptive name for the file.
  3. Summarize the findings in simple, plain English (no jargon).
  4. Extract structured data like Doctor name, Hospital, Date, and any specific findings/medications.
  5. Suggest next steps (e.g., "This looks like a lab report. Would you like to sync these parameters to your medical records?").
  
  Return as valid JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
        systemInstruction: "You are a clinical document analyzer. Provide accurate, clear summaries and structured data. Return only JSON.",
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
  const ai = getGenAI();

  const lastEntries = journal.slice(-10); // Look at last 10 entries
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string", description: "30-second elevator pitch of health status." },
      keySymptoms: { type: "array", items: { type: "string" }, description: "List of symptoms to mention." },
      suggestedQuestions: { type: "array", items: { type: "string" }, description: "Questions to ask the doctor." },
      lifestyleNotes: { type: "string", description: "Relevant diet/sleep/stress patterns." }
    },
    required: ["summary", "keySymptoms", "suggestedQuestions"]
  };

  const prompt = `Based on these recent health journal entries, prepare a concise briefing for a ${appointmentType} visit. 
  Focus on patterns, symptom frequency, and what's most medically relevant.
  
  Recent Journal: ${JSON.stringify(lastEntries)}
  
  Return as valid JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a clinical preparation assistant. Help patients be heard by their doctors by summarizing their data succinctly.",
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
  const ai = getGenAI();

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
            deadline: { type: "string", description: "Relative timeframe like 'Asap' or 'In 2 days'" }
          }
        }
      },
      nextAppointmentSuggestion: { type: "string" }
    },
    required: ["tasks"]
  };

  const prompt = `Convert these messy medical appointment notes into a structured checklist of follow-up tasks (meds to buy, tests to take, habits to change).
  
  Notes: ${notes}
  
  Return as valid JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a post-visit health coordinator. Extract clear, actionable tasks from clinical notes.",
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
