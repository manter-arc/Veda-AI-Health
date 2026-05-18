import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, JournalEntry } from "../types";

const MODEL_NAME = "gemini-flash-latest";

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
                 
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    console.warn("Gemini API key is not configured. Please ensure GEMINI_API_KEY is set in Settings > Secrets.");
    throw new Error("Gemini API key is not configured.");
  }
  return new GoogleGenAI({ apiKey });
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
      }
    });
    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

export async function getChatResponse(message: string, history: any[], profile: UserProfile) {
  const systemInstruction = `${SYS_PROMPT}
  
  Patient Profile: ${profile.name}, ${profile.age}yrs, ${profile.sex}. 
  Medical Conditions: ${profile.conditions.join(', ')}. 
  Recent Medicines: ${profile.medicines.map(m => m.name).join(', ')}.`;

  try {
    const ai = getAI();
    // For robust history handling, we'll use generateContent with the history mapped to contents
    const messages = history ? history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.content || h.parts?.[0]?.text || '' }]
    })) : [];
    
    // Append the new message
    messages.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: messages,
      config: {
        systemInstruction,
        temperature: 0.3,
      }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Health Chat Error details:", {
      message: error.message,
      status: error.status,
      details: error.details,
    });
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
    type: Type.OBJECT,
    properties: {
      medications: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            dose: { type: Type.STRING },
            dailyFrequency: { type: Type.INTEGER },
            duration: { type: Type.INTEGER },
            instructions: { type: Type.STRING }
          },
          required: ["name", "dose", "dailyFrequency"]
        }
      },
      summary: { type: Type.STRING }
    },
    required: ["medications", "summary"]
  };

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data.split(',')[1] || base64Data } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: "You are a clinical pharmacist. return only JSON. No markdown blocks.",
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Prescription Analysis Error:", error);
    throw error;
  }
}

export async function getWellnessResponse(message: string, history: any[], profile: UserProfile) {
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
    const ai = getAI();
    const messages = history ? history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.content || h.parts?.[0]?.text || '' }]
    })) : [];
    
    messages.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: messages,
      config: {
        systemInstruction,
        temperature: 0.4,
      }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Wellness Chat Error details:", {
      message: error.message,
      status: error.status,
      details: error.details,
    });
    throw error;
  }
}

export async function analyzeImage(base64Data: string, prompt: string, mimeType: string = "image/jpeg") {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data.split(',')[1] || base64Data } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: SYS_PROMPT,
        temperature: 0.3,
      }
    });

    return response.text || "I'm sorry, I couldn't analyze the image.";
  } catch (error) {
    console.error("Gemini Image API error:", error);
    throw error;
  }
}

export async function analyzeSymptoms(symptom: string, duration: string, severity: number, profile: UserProfile) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      urgency: { 
        type: Type.STRING, 
        enum: ["routine", "urgent", "emergency"], 
        description: "How quickly the user should seek medical attention." 
      },
      summary: { type: Type.STRING, description: "Brief overview of the concern." },
      likelyCauses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            condition: { type: Type.STRING },
            likelihood: { type: Type.STRING, enum: ["High", "Moderate", "Low"] },
            explanation: { type: Type.STRING }
          },
          required: ["condition", "likelihood", "explanation"]
        }
      },
      recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific steps the user should take." },
      redFlags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Symptoms that indicate emergency care is needed." },
      homeCareTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ways to manage symptoms at home." }
    },
    required: ["urgency", "summary", "likelyCauses", "recommendedActions", "redFlags"]
  };

  const prompt = `Patient reports: ${symptom}. Duration: ${duration}. Severity: ${severity}/10. Profile: ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}. Analyze these symptoms to provide likely causes, urgency, and clinical guidance. Return as valid JSON.`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Symptom Analysis Error:", error);
    throw error;
  }
}

export async function generateSmartMedicationSchedule(profile: UserProfile, additionalInfo?: string) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      reminders: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            dose: { type: Type.STRING },
            time: { type: Type.STRING, description: "HH:mm format" },
            freq: { type: Type.STRING, enum: ["Daily", "Weekly", "Monthly", "Once"] },
            color: { type: Type.STRING, enum: ["indigo", "emerald", "rose", "amber", "sky", "purple"] },
            note: { type: Type.STRING }
          },
          required: ["name", "dose", "time", "freq", "color"]
        }
      },
      wellnessTips: { type: Type.ARRAY, items: { type: Type.STRING } }
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
  
  Return as valid JSON.`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Schedule Generation Error:", error);
    throw error;
  }
}

export async function analyzeLabReport(base64Data?: string, textContent?: string) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "Plain English summary of the overall report." },
      parameters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            parameter: { type: Type.STRING },
            value: { type: Type.STRING },
            range: { type: Type.STRING },
            status: { type: Type.STRING, enum: ["normal", "low", "high", "critical"] },
            explanation: { type: Type.STRING }
          },
          required: ["parameter", "value", "status"]
        }
      },
      dietarySuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      lifestyleSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      followUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["summary", "parameters", "followUpQuestions"]
  };

  const prompt = "Analyze this lab report. Extract values and explain them in plain English. Highlight out-of-range results.";

  try {
    const parts: any[] = [];
    if (base64Data) parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data.split(',')[1] || base64Data } });
    if (textContent) parts.push({ text: `Report text content: ${textContent}` });
    parts.push({ text: prompt });

    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Lab Report Analysis Error:", error);
    throw error;
  }
}

export async function analyzeJournal(notes: string) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      stressLevel: { type: Type.NUMBER },
      burnoutRisk: { type: Type.STRING, enum: ["low", "moderate", "high"] },
      summary: { type: Type.STRING },
      recommendation: { type: Type.STRING }
    },
    required: ["stressLevel", "burnoutRisk", "summary", "recommendation"]
  };

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: `Analyze the following journal entry for mood, stress level, and burnout risk: ${notes}` }] },
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Journal Analysis Error:", error);
    throw error;
  }
}

export async function generateHealthRoadmap(profile: UserProfile) {
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        month: { type: Type.STRING },
        priority: { type: Type.STRING, enum: ["high", "medium", "low"] }
      },
      required: ["title", "description", "month", "priority"]
    }
  };

  const prompt = `Based on this user profile: Age: ${profile.age}, Sex: ${profile.sex}, Conditions: ${profile.conditions.join(', ')}. Generate a personalized preventive health roadmap for the next 12 months.`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
      }
    });

    return JSON.parse(result.text || "[]");
  } catch (error) {
    console.error("Roadmap Generation Error:", error);
    throw error;
  }
}

export async function generateCallSummary(callTranscript: string) {
  const prompt = `Summarize this tele-consultation call into key points: patient concerns, doctor's diagnosis, and prescribed actions/medications. Transcript: ${callTranscript}`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: SYS_PROMPT,
        temperature: 0.2,
      }
    });

    return result.text || "No summary available.";
  } catch (error) {
    console.error("Call Summary Error:", error);
    throw error;
  }
}

export async function analyzeFood(base64Data: string, profile: UserProfile) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      dishName: { type: Type.STRING },
      explanation: { type: Type.STRING },
      protein: { type: Type.NUMBER },
      carbs: { type: Type.NUMBER },
      fats: { type: Type.NUMBER },
      calories: { type: Type.NUMBER },
      healthTips: { type: Type.ARRAY, items: { type: Type.STRING } },
      warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["dishName", "calories", "protein", "carbs", "fats", "healthTips"]
  };

  const context = `User Profile: ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}.`;
  const prompt = `Identify the meal in this image and estimate nutrition. CONTEXT: ${context}`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data.split(',')[1] || base64Data } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Food Analysis Error:", error);
    throw error;
  }
}

export async function analyzeLockerDocument(base64Data: string, mimeType: string = "image/jpeg") {
  const schema = {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, enum: ["prescription", "scan", "report", "insurance", "other"] },
      name: { type: Type.STRING },
      summary: { type: Type.STRING },
      extractedData: {
        type: Type.OBJECT,
        properties: {
          doctorName: { type: Type.STRING },
          hospital: { type: Type.STRING },
          date: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      },
      suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["category", "name", "summary", "extractedData"]
  };

  const prompt = `Analyze this health document. Detect category, provide name, summary, and extract key data.`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data.split(',')[1] || base64Data } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: "You are a clinical document analyzer. Return only JSON.",
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1,
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Locker Analysis Error:", error);
    throw error;
  }
}

export async function generateAppointmentBriefing(journal: JournalEntry[], appointmentType: string) {
  const lastEntries = journal.slice(-10);
  const schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      keySymptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
      suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      lifestyleNotes: { type: Type.STRING }
    },
    required: ["summary", "keySymptoms", "suggestedQuestions"]
  };

  const prompt = `Prepare a concise briefing for a ${appointmentType} visit based on recent health journal entries: ${JSON.stringify(lastEntries)}`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "You are a clinical preparation assistant. Summarize data succinctly.",
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Briefing Generation Error:", error);
    throw error;
  }
}

export async function generatePostVisitChecklist(notes: string) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      tasks: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
            deadline: { type: Type.STRING }
          }
        }
      },
      nextAppointmentSuggestion: { type: Type.STRING }
    },
    required: ["tasks"]
  };

  const prompt = `Convert these record notes into a structured checklist: ${notes}`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "You are a post-visit health coordinator. Extract actionable tasks.",
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Post-Visit Checklist Error:", error);
    throw error;
  }
}
