import { RiskPort, RiskLevel } from '../../../kernel/ports.js';

const HIGH_RISK_KEYWORDS = [
  'phone',
  'smartphone',
  'iphone',
  'android',
  'laptop',
  'macbook',
  'wallet',
  'purse',
  'id card',
  'campus card',
  'bank card',
  'credit card',
  'debit card',
  'passport',
  'driver license',
  'documents',
  'keys',
];

const MEDIUM_RISK_KEYWORDS = [
  'headphones',
  'airpods',
  'earbuds',
  'headset',
  'earphones',
  'sony',
  'bose',
  'beats',
  'wh-',
  'xm4',
  'xm5',
  'bags',
  'backpack',
  'watch',
  'smartwatch',
  'calculator',
  'camera',
  'tablet',
  'ipad',
];

export class RiskClassifier implements RiskPort {
  classify(category: string, hidden_attributes?: Record<string, any>): RiskLevel {
    const cat = (category || '').toLowerCase().trim();

    if (HIGH_RISK_KEYWORDS.some((kw) => cat.includes(kw))) {
      return 'HIGH';
    }
    if (MEDIUM_RISK_KEYWORDS.some((kw) => cat.includes(kw))) {
      return 'MEDIUM';
    }

    if (hidden_attributes) {
      const serialized = JSON.stringify(hidden_attributes).toLowerCase();
      if (HIGH_RISK_KEYWORDS.some((kw) => serialized.includes(kw))) {
        return 'HIGH';
      }
      if (MEDIUM_RISK_KEYWORDS.some((kw) => serialized.includes(kw))) {
        return 'MEDIUM';
      }
    }

    return 'LOW';
  }
}
