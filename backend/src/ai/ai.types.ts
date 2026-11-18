export interface AiAssistResult {
  summary: string;
  quickChecks: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  escalationAdvice: string;
}

export interface AiProvider {
  assist(description: string): Promise<AiAssistResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
