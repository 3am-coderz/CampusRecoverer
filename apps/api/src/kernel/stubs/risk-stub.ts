import { RiskPort, RiskLevel } from '../ports.js';

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class RiskStub implements RiskPort {
  classify(category: string, hidden_attributes?: Record<string, any>): RiskLevel {
    const highRiskKeywords = [
      'phone', 'phones', 'smartphone', 'smartphones', 'mobile',
      'laptop', 'laptops', 'macbook', 'notebook pc',
      'wallet', 'wallets', 'purse', 'purses',
      'id card', 'id cards', 'student id',
      'bank card', 'bank cards', 'credit card', 'credit cards', 'debit card', 'debit cards',
      'passport', 'passports',
      'document', 'documents', 'license', 'licence',
    ];

    const mediumRiskKeywords = [
      'headphone', 'headphones', 'earphone', 'earphones', 'airpod', 'airpods', 'earbud', 'earbuds',
      'bag', 'bags', 'backpack', 'backpacks', 'handbag', 'handbags',
      'watch', 'watches', 'smartwatch', 'smartwatches',
      'calculator', 'calculators',
      'tablet', 'tablets', 'ipad', 'ipads', 'kindle',
      'camera', 'cameras',
      'key', 'keys',
    ];

    const cat = category.toLowerCase().trim();

    const matchesWord = (target: string, keyword: string): boolean => {
      // Ensure keyword is matched on word boundaries, preventing 'phone' from matching 'headphones'
      const pattern = new RegExp(`(^|\\b|[^a-z0-9])${escapeRegExp(keyword)}($|\\b|[^a-z0-9])`, 'i');
      return pattern.test(target);
    };

    // Check medium risk keywords first so compound words like 'headphones' take precedence over 'phone'
    if (mediumRiskKeywords.some((k) => k === cat || matchesWord(cat, k))) {
      return 'MEDIUM';
    }

    if (highRiskKeywords.some((k) => k === cat || matchesWord(cat, k))) {
      return 'HIGH';
    }

    if (hidden_attributes && Object.keys(hidden_attributes).length > 0) {
      const serialized = JSON.stringify(hidden_attributes).toLowerCase();
      // If hidden attributes match medium risk and do not contain high risk keywords
      const hasHigh = highRiskKeywords.some((k) => matchesWord(serialized, k));
      const hasMedium = mediumRiskKeywords.some((k) => matchesWord(serialized, k));

      if (hasHigh) return 'HIGH';
      if (hasMedium) return 'MEDIUM';
    }

    return 'LOW';
  }
}
