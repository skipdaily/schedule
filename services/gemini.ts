import { GoogleGenAI } from "@google/genai";
import { Project } from "../types";

// This is a client-side app, but in production, API calls should proxy through backend.
// We assume env is available. If not, we handle gracefully.

export const generateDailyBriefing = async (project: Project): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "API Key not configured. Please add REACT_APP_GEMINI_API_KEY to your environment.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Summarize state for the prompt to save tokens
    const readyTasks = Object.values(project.tasks).filter(t => t.status === 'ready');
    const inProgressTasks = Object.values(project.tasks).filter(t => t.status === 'in-progress');
    const completeCount = Object.values(project.tasks).filter(t => t.status === 'complete').length;
    const totalCount = Object.values(project.tasks).length;

    // Helper to get names
    const getNames = (tasks: any[]) => {
        return tasks.slice(0, 10).map(t => {
            const unit = [...project.units, ...project.areas].find(u => u.id === t.unitId)?.name || 'Unknown Unit';
            const trade = project.trades.find(tr => tr.id === t.tradeId)?.name || 'Unknown Trade';
            const dateStr = t.expectedStartDate ? ` (Start: ${t.expectedStartDate})` : '';
            return `${trade} @ ${unit}${dateStr}`;
        }).join('\n');
    };

    const prompt = `
      You are a construction superintendent assistant. Analyze this project status and give a concise, actionable morning briefing.
      
      Project: ${project.name}
      Completion: ${Math.round((completeCount / totalCount) * 100)}%

      READY TO START (${readyTasks.length}):
      ${getNames(readyTasks)}

      CURRENTLY WORKING (${inProgressTasks.length}):
      ${getNames(inProgressTasks)}

      Tone: Professional, direct, authoritative. 
      Format: Plain text with clear headers. No markdown blocks.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      contents: prompt,
    });

    return response.text || "Could not generate briefing.";

  } catch (error) {
    console.error("Gemini API Error", error);
    return "Error generating briefing. Please check console.";
  }
};