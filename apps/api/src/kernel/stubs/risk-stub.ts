import { RiskPort, RiskLevel } from '../ports.js';

export class RiskStub implements RiskPort {
  classify(category: string, hidden_attributes?: Record<string, any>): RiskLevel {
    const highRiskCategories = ['phone', 'laptop', 'wallet', 'id card', 'bank card', 'credit card', 'debit card', 'passport', 'documents'];
    const mediumRiskCategories = ['headphones', 'bags', 'watches', 'calculators'];

    const cat = category.toLowerCase().trim();
    if (highRiskCategories.some((c) => cat.includes(c))) {
      return 'HIGH';
    }
    if (mediumRiskCategories.some((c) => cat.includes(c))) {
      return 'MEDIUM';
    }

    if (hidden_attributes) {
      const serialized = JSON.stringify(hidden_attributes).toLowerCase();
      if (highRiskCategories.some((k) => serialized.includes(k))) return 'HIGH';
      if (mediumRiskCategories.some((k) => serialized.includes(k))) return 'MEDIUM';
    }

    return 'LOW';
  }
}
