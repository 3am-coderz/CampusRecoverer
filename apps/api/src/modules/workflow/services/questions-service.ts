import { DatabaseContext } from '../../../kernel/db.js';
import { MatchingPort, VerificationSummary } from '../../../kernel/ports.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../kernel/errors.js';

export interface OwnershipQuestion {
  id: string;
  question: string;
}

export class QuestionsService {
  private db: DatabaseContext;
  private matchingPort: MatchingPort;

  constructor(db: DatabaseContext, matchingPort: MatchingPort) {
    this.db = db;
    this.matchingPort = matchingPort;
  }

  async generateQuestions(claimId: string, claimantId: string): Promise<OwnershipQuestion[]> {
    const claimRes = await this.db.query('SELECT item_id, claimant_id FROM claims WHERE id = $1', [claimId]);
    if (claimRes.rows.length === 0) {
      throw new NotFoundError('Claim not found');
    }
    if (claimRes.rows[0].claimant_id !== claimantId) {
      throw new ForbiddenError('Only the submitting claimant may access verification questions');
    }

    const itemRes = await this.db.query('SELECT hidden_attributes FROM items WHERE id = $1', [
      claimRes.rows[0].item_id,
    ]);
    if (itemRes.rows.length === 0) {
      throw new NotFoundError('Item not found');
    }

    let attr = itemRes.rows[0].hidden_attributes;
    if (typeof attr === 'string') {
      try { attr = JSON.parse(attr); } catch { attr = {}; }
    }

    const questions: OwnershipQuestion[] = [];

    if (attr.unique_features && Array.isArray(attr.unique_features) && attr.unique_features.length > 0) {
      questions.push({
        id: 'q_features',
        question: 'Describe any specific sticker, scratch, marking, or distinctive feature present on the item.',
      });
    }

    if (attr.serial_number) {
      questions.push({
        id: 'q_serial',
        question: 'What are the last 4 characters of the device serial number?',
      });
    }

    if (attr.color) {
      questions.push({
        id: 'q_color',
        question: 'What is the exact color or finish of the item or its casing?',
      });
    }

    if (attr.contents && Array.isArray(attr.contents) && attr.contents.length > 0) {
      questions.push({
        id: 'q_contents',
        question: 'Name one or more specific accessories or contents stored with or inside the item.',
      });
    }

    // Default question if no specific attributes
    if (questions.length === 0) {
      questions.push({
        id: 'q_generic',
        question: 'Describe any distinctive private markings or characteristics of the lost item.',
      });
    }

    return questions;
  }

  async evaluateAnswers(
    claimId: string,
    claimantId: string,
    submittedAnswers: Array<{ question_id: string; answer: string }>,
  ): Promise<void> {
    const claimRes = await this.db.query('SELECT item_id, claimant_id FROM claims WHERE id = $1', [claimId]);
    if (claimRes.rows.length === 0) {
      throw new NotFoundError('Claim not found');
    }
    if (claimRes.rows[0].claimant_id !== claimantId) {
      throw new ForbiddenError('Unauthorized claimant');
    }

    const itemRes = await this.db.query('SELECT hidden_attributes FROM items WHERE id = $1', [
      claimRes.rows[0].item_id,
    ]);
    let attr = itemRes.rows[0]?.hidden_attributes || {};
    if (typeof attr === 'string') {
      try { attr = JSON.parse(attr); } catch { attr = {}; }
    }

    for (const ans of submittedAnswers) {
      let expected = '';
      if (ans.question_id === 'q_features' && attr.unique_features) {
        expected = Array.isArray(attr.unique_features) ? attr.unique_features.join(' ') : String(attr.unique_features);
      } else if (ans.question_id === 'q_serial' && attr.serial_number) {
        const s = String(attr.serial_number);
        expected = s.slice(-4);
      } else if (ans.question_id === 'q_color' && attr.color) {
        expected = String(attr.color);
      } else if (ans.question_id === 'q_contents' && attr.contents) {
        expected = Array.isArray(attr.contents) ? attr.contents.join(' ') : String(attr.contents);
      } else {
        expected = JSON.stringify(attr);
      }

      // Evaluate via matching similarity
      const results = await this.matchingPort.similarity([{ expected, given: ans.answer }]);
      const evalResult = results[0] || { similarity: 0.0, matched: false };

      const answerId = 'ans_' + Math.random().toString(36).substring(2, 10);
      await this.db.query(
        `INSERT INTO claim_answers (id, claim_id, question_id, matched, similarity, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [answerId, claimId, ans.question_id, evalResult.matched, evalResult.similarity],
      );
    }
  }

  async getVerificationSummary(claimId: string): Promise<VerificationSummary> {
    const res = await this.db.query(
      'SELECT matched, similarity FROM claim_answers WHERE claim_id = $1',
      [claimId],
    );

    const claimRes = await this.db.query(
      `SELECT i.risk_level FROM claims c JOIN items i ON c.item_id = i.id WHERE c.id = $1`,
      [claimId],
    );

    const isHigh = claimRes.rows[0]?.risk_level === 'HIGH';

    if (res.rows.length === 0) {
      return {
        questions_answered: 0,
        matched: 0,
        overall: 0,
        id_required: isHigh,
      };
    }

    const answered = res.rows.length;
    const matchedCount = res.rows.filter((r: any) => Boolean(r.matched)).length;
    const avgSim =
      res.rows.reduce((acc: number, r: any) => acc + parseFloat(r.similarity || '0'), 0) / answered;

    return {
      questions_answered: answered,
      matched: matchedCount,
      overall: Math.round(avgSim * 100),
      id_required: isHigh,
    };
  }
}
