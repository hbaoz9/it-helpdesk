import { apiRequest } from '../../shared/api/client';

export interface AiAssistResult {
  summary: string;
  quickChecks: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  escalationAdvice: string;
}

export function assistWithAi(description: string): Promise<AiAssistResult> {
  return apiRequest('/ai/assist', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}
