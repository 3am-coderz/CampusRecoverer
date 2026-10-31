import { MatchingPort, MatchScoreResult, SimilarityResult } from '../ports.js';

export class MatchingStub implements MatchingPort {
  async score(item: any, claim: any): Promise<MatchScoreResult> {
    const explanations: string[] = [];
    let structuredScore = 0;

    const itemCategory = (item.category || '').toLowerCase();
    const claimDesc = (claim.description || '').toLowerCase();
    const itemAttr = item.hidden_attributes || {};
    const claimAttr = claim.claimed_attributes || {};

    if (itemCategory && (claimDesc.includes(itemCategory) || JSON.stringify(claimAttr).toLowerCase().includes(itemCategory))) {
      structuredScore += 20;
      explanations.push('category: match');
    }

    if (itemAttr.brand && claimAttr.brand && itemAttr.brand.toLowerCase() === claimAttr.brand.toLowerCase()) {
      structuredScore += 15;
      explanations.push('brand: match');
    }

    if (itemAttr.model && claimAttr.model && itemAttr.model.toLowerCase() === claimAttr.model.toLowerCase()) {
      structuredScore += 15;
      explanations.push('model: match');
    }

    if (itemAttr.color && claimAttr.color && itemAttr.color.toLowerCase() === claimAttr.color.toLowerCase()) {
      structuredScore += 10;
      explanations.push('color: match');
    }

    if (item.found_location_public && claim.lost_location) {
      structuredScore += 10;
      explanations.push('location: partial match');
    }

    if (item.found_date && claim.lost_date) {
      structuredScore += 10;
      explanations.push('date: close match');
    }

    if (itemAttr.unique_features && claimAttr.unique_features) {
      structuredScore += 20;
      explanations.push('unique_features: match');
    }

    const semanticScore = Math.min(100, structuredScore * 0.95);
    const finalScore = Math.round((0.6 * structuredScore + 0.4 * semanticScore) * 10) / 10;

    let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (finalScore >= 80) confidence = 'HIGH';
    else if (finalScore >= 50) confidence = 'MEDIUM';

    return {
      structured_score: structuredScore,
      semantic_score: semanticScore,
      final_score: finalScore,
      match_score: finalScore,
      confidence,
      ml_used: false,
      explanation: explanations,
    };
  }

  async similarity(pairs: Array<{ expected: string; given: string }>): Promise<SimilarityResult[]> {
    return pairs.map((pair) => {
      const exp = (pair.expected || '').toLowerCase().trim();
      const giv = (pair.given || '').toLowerCase().trim();
      const matched = exp.length > 0 && (giv.includes(exp) || exp.includes(giv));
      return {
        similarity: matched ? 1.0 : 0.2,
        matched,
      };
    });
  }
}
