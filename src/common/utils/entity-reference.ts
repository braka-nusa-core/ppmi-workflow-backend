import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';

export const ENTITY_TYPES = [
  'VESSEL',
  'QUOTATION',
  'POLICY',
  'CLIENT',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

const LABELS: Record<EntityType, string> = {
  VESSEL: 'Vessel',
  QUOTATION: 'Quotation',
  POLICY: 'Policy',
  CLIENT: 'Client',
};

/**
 * Assignments, meetings and follow-ups point at an entity by type + id
 * without a foreign key, so the target is checked here instead.
 */
export async function assertEntityExists(
  prisma: PrismaService,
  entityType: EntityType,
  entityId: string,
) {
  const where = { id: entityId, deletedAt: null };
  const select = { id: true };

  const found = await {
    VESSEL: () => prisma.vessel.findFirst({ where, select }),
    QUOTATION: () => prisma.quotation.findFirst({ where, select }),
    POLICY: () => prisma.policy.findFirst({ where, select }),
    CLIENT: () => prisma.client.findFirst({ where, select }),
  }[entityType]();

  if (!found) throw new NotFoundException(`${LABELS[entityType]} not found`);
}
