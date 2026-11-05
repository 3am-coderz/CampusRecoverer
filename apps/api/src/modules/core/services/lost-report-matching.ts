import { AppContext } from '../../../kernel/app.js';

const MATCHABLE_STATUSES = ['OPEN_FOR_CLAIMS'];

function asAttributes(value: unknown): Record<string, any> {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function asFeatureList(...values: unknown[]): string[] {
  return values.flatMap((value) => {
    if (Array.isArray(value)) return value.filter((entry) => typeof entry === 'string');
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  });
}

function normalizeAttributes(value: unknown): Record<string, any> {
  const attributes = asAttributes(value);
  return {
    ...attributes,
    unique_features: asFeatureList(
      attributes.unique_features,
      attributes.stickers_or_marks,
      attributes.identifying_marks,
      attributes.unique_identifying_features,
    ),
    contents: asFeatureList(attributes.contents, attributes.contained_items),
  };
}

function normalizedSerial(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

function normalizedFeature(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function exactPrivateFeatureMatch(
  reportAttributes: Record<string, any>,
  itemAttributes: Record<string, any>,
  reportCategory: string,
  itemCategory: string,
): boolean {
  if (normalizedFeature(reportCategory) !== normalizedFeature(itemCategory)) return false;
  const lostFeatures = reportAttributes.unique_features as string[];
  const foundFeatures = itemAttributes.unique_features as string[];
  return lostFeatures.some((lostFeature) => {
    const normalizedLost = normalizedFeature(lostFeature);
    return normalizedLost.length >= 10 && foundFeatures.some(
      (foundFeature) => normalizedFeature(foundFeature) === normalizedLost,
    );
  });
}

/**
 * Compare saved lost reports with privately stored found reports. Candidate
 * matches may be detected before public release, but notifications never
 * contain the hidden descriptions or identifying proof values.
 */
export async function notifyLostReportMatches(
  ctx: AppContext,
  availableItems?: any[],
): Promise<void> {
  try {
    const [reportsResult, itemsResult] = await Promise.all([
      ctx.db.query(
        `SELECT id, user_id, category, description, identifying_attributes, lost_date, lost_location
         FROM lost_reports ORDER BY created_at ASC`,
      ),
      availableItems
        ? Promise.resolve({ rows: availableItems, rowCount: availableItems.length })
        : ctx.db.query(
            `SELECT * FROM items
             WHERE status = 'OPEN_FOR_CLAIMS'
             ORDER BY created_at DESC`,
          ),
    ]);

    for (const report of reportsResult.rows) {
      const reportAttributes = normalizeAttributes(report.identifying_attributes);

      for (const item of itemsResult.rows) {
        if (!MATCHABLE_STATUSES.includes(item.status) || item.finder_id === report.user_id) continue;

        const itemAttributes = normalizeAttributes(item.hidden_attributes);
        const reportSerial = normalizedSerial(reportAttributes.serial_number);
        const itemSerial = normalizedSerial(itemAttributes.serial_number);
        const exactSerialMatch = Boolean(reportSerial && itemSerial && reportSerial === itemSerial);
        const exactFeatureMatch = exactPrivateFeatureMatch(
          reportAttributes,
          itemAttributes,
          report.category,
          item.category,
        );

        const score = await ctx.ports.matching.score(
          { ...item, hidden_attributes: itemAttributes },
          {
            category: report.category,
            description: report.description,
            claimed_attributes: reportAttributes,
            lost_date: report.lost_date,
            lost_location: report.lost_location,
          },
        );
        if (!exactSerialMatch && !exactFeatureMatch && score.final_score < ctx.config.highConfidenceThreshold) continue;

        const title = 'Potential found-item match';
        const message = `A found item that may match your lost report is available to claim in Browse Items (reference ${item.id}). Its identifying details remain private.`;

        const previous = await ctx.db.query(
          `SELECT id FROM notifications
           WHERE user_id = $1 AND title = $2 AND message LIKE $3 AND message <> $4
           ORDER BY created_at DESC LIMIT 1`,
          [report.user_id, title, `%reference ${item.id}%`, message],
        );
        if (previous.rows.length > 0) {
          await ctx.db.query(
            'UPDATE notifications SET message = $1, read = FALSE WHERE id = $2',
            [message, previous.rows[0].id],
          );
          continue;
        }

        const exists = await ctx.db.query(
          'SELECT 1 FROM notifications WHERE user_id = $1 AND title = $2 AND message = $3 LIMIT 1',
          [report.user_id, title, message],
        );
        if (exists.rows.length === 0) {
          await ctx.ports.core.createNotification({ user_id: report.user_id, title, message });
        }
      }
    }
  } catch (err: any) {
    // Matching is best effort; never discard a persisted report or block an
    // item from entering custody when the matching service is unavailable.
    ctx.logger.warn(`Lost-report matching deferred: ${err.message}`);
  }
}
