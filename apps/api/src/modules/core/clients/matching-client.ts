import { MatchingPort, MatchScoreResult, SimilarityResult } from '../../../kernel/ports.js';
import { config } from '../../../kernel/config.js';
import { logger } from '../../../kernel/logger.js';

export class HttpMatchingClient implements MatchingPort {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl = config.matchingServiceUrl, apiKey = config.internalApiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async score(item: any, claim: any): Promise<MatchScoreResult> {
    try {
      const res = await fetch(`${this.baseUrl}/matching/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': this.apiKey,
        },
        body: JSON.stringify({
          item: {
            category: item.category,
            hidden_description: item.hidden_description || '',
            hidden_attributes: item.hidden_attributes || {},
            found_location_public: item.found_location_public,
            found_date: item.found_date,
          },
          claim: {
            description: claim.description,
            claimed_attributes: claim.claimed_attributes || {},
            lost_date: claim.lost_date,
            lost_location: claim.lost_location,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Matching service returned status ${res.status}`);
      }

      const data = (await res.json()) as MatchScoreResult;
      return data;
    } catch (err: any) {
      logger.warn(`Matching service error (${err.message}). Falling back to MANUAL_REVIEW mode.`);
      return {
        structured_score: 50.0,
        semantic_score: 50.0,
        final_score: 50.0,
        match_score: 50.0,
        confidence: 'LOW',
        ml_used: false,
        explanation: ['matching_service_unavailable: fallback to MANUAL_REVIEW'],
      };
    }
  }

  async similarity(pairs: Array<{ expected: string; given: string }>): Promise<SimilarityResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}/matching/similarity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': this.apiKey,
        },
        body: JSON.stringify({ pairs }),
      });

      if (!res.ok) {
        throw new Error(`Matching similarity returned status ${res.status}`);
      }

      const data = (await res.json()) as { results: SimilarityResult[] };
      return data.results;
    } catch (err: any) {
      logger.warn(`Matching similarity service error (${err.message}). Falling back to basic match.`);
      return pairs.map((p) => {
        const exp = (p.expected || '').toLowerCase().trim();
        const giv = (p.given || '').toLowerCase().trim();
        const matched = exp.length > 0 && (giv.includes(exp) || exp.includes(giv));
        return { similarity: matched ? 0.9 : 0.1, matched };
      });
    }
  }
}
