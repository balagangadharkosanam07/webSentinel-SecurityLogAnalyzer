import { db } from '../db/index.js';
import { detectionRules, DetectionRuleModel } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export const detectionRulesRepository = {
  async findAll(): Promise<DetectionRuleModel[]> {
    return await db.select().from(detectionRules).orderBy(detectionRules.id);
  },

  async findById(id: string): Promise<DetectionRuleModel | null> {
    const res = await db.select().from(detectionRules).where(eq(detectionRules.id, id)).limit(1);
    return res[0] || null;
  },

  async findEnabled(): Promise<DetectionRuleModel[]> {
    return await db.select().from(detectionRules).where(eq(detectionRules.enabled, true));
  },
};
