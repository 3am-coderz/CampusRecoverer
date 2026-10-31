import { apiClient } from '../kernel/client';
import { Claim } from '../kernel/types';

export interface ChallengeQuestion {
  id: string;
  question: string;
  category: string;
}

export interface CustodyEvent {
  id: string;
  item_id: string;
  actor_id: string;
  action: string;
  notes?: string;
  created_at: string;
}

export const workflowService = {
  async evaluateClaim(claimId: string): Promise<Claim> {
    const res = await apiClient.post<{ claim: Claim }>(`/workflow/claims/${claimId}/evaluate`);
    return res.claim;
  },

  async approveClaim(claimId: string): Promise<Claim> {
    const res = await apiClient.post<{ claim: Claim }>(`/workflow/claims/${claimId}/approve`);
    return res.claim;
  },

  async rejectClaim(claimId: string, reason?: string): Promise<Claim> {
    const res = await apiClient.post<{ claim: Claim }>(`/workflow/claims/${claimId}/reject`, { reason });
    return res.claim;
  },

  async getQuestions(claimId: string): Promise<ChallengeQuestion[]> {
    const res = await apiClient.get<{ questions: ChallengeQuestion[] }>(`/workflow/claims/${claimId}/questions`);
    return res.questions || [];
  },

  async submitAnswers(claimId: string, answers: Record<string, string>): Promise<{ score: number; passed: boolean }> {
    const res = await apiClient.post(`/workflow/claims/${claimId}/answers`, { answers });
    return res;
  },

  async getCustodyHistory(itemId: string): Promise<CustodyEvent[]> {
    const res = await apiClient.get<{ events: CustodyEvent[] }>(`/workflow/items/${itemId}/custody`);
    return res.events || [];
  },

  async addCustodyEvent(itemId: string, action: string, notes?: string): Promise<CustodyEvent> {
    const res = await apiClient.post<{ event: CustodyEvent }>(`/workflow/items/${itemId}/custody`, {
      action,
      notes,
    });
    return res.event;
  },
};
