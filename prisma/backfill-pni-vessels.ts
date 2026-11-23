/**
 * Links existing P&I vessels (pni_vessel.vesselId = null) to the vessel master.
 *
 *   bun prisma/backfill-pni-vessels.ts           dry run: prints what would change
 *   bun prisma/backfill-pni-vessels.ts --apply   writes vesselId
 *
 * Only vesselId is ever written. The snapshot columns of the P&I vessel
 * (name, IMO, year, GT, ...) are left exactly as they are, so old quotations
 * keep reading the same as before.
 *
 * A row is matched only when the match is unambiguous:
 *   1. IMO number, when both sides have one and exactly one vessel has it.
 *   2. Otherwise the vessel identity (name + build year + GRT), the same key
 *      the vessel master uses to detect duplicates.
 * Rows that match nothing, or more than one vessel, are listed and skipped.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { normalizeName, vesselIdentityKey } from '../src/vessels/vessel.util';

const apply = process.argv.includes('--apply');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Reason = 'IMO' | 'IDENTITY';

async function main() {
  console.log(apply ? 'Mode: APPLY (writes vesselId)' : 'Mode: dry run');

  const vessels = await prisma.vessel.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, imoNumber: true, identityKey: true },
  });

  const byImo = new Map<string, string[]>();
  const byIdentity = new Map<string, string[]>();
  for (const vessel of vessels) {
    const imo = vessel.imoNumber?.trim();
    if (imo) byImo.set(imo, [...(byImo.get(imo) ?? []), vessel.id]);
    byIdentity.set(vessel.identityKey, [
      ...(byIdentity.get(vessel.identityKey) ?? []),
      vessel.id,
    ]);
  }

  const rows = await prisma.pniVessel.findMany({
    where: { vesselId: null, deletedAt: null },
    select: {
      id: true,
      name: true,
      imoNumber: true,
      builtYear: true,
      grossTonnage: true,
    },
  });

  const matches: { id: string; name: string; vesselId: string; by: Reason }[] =
    [];
  const unmatched: { id: string; name: string }[] = [];
  const ambiguous: { id: string; name: string; candidates: number }[] = [];

  for (const row of rows) {
    const imo = row.imoNumber?.trim();
    const imoHits = imo ? (byImo.get(imo) ?? []) : [];
    const identityHits =
      byIdentity.get(
        vesselIdentityKey(
          normalizeName(row.name),
          row.builtYear,
          row.grossTonnage?.toString(),
        ),
      ) ?? [];

    if (imoHits.length === 1) {
      matches.push({
        id: row.id,
        name: row.name,
        vesselId: imoHits[0],
        by: 'IMO',
      });
    } else if (imoHits.length === 0 && identityHits.length === 1) {
      matches.push({
        id: row.id,
        name: row.name,
        vesselId: identityHits[0],
        by: 'IDENTITY',
      });
    } else if (imoHits.length > 1 || identityHits.length > 1) {
      ambiguous.push({
        id: row.id,
        name: row.name,
        candidates: Math.max(imoHits.length, identityHits.length),
      });
    } else {
      unmatched.push({ id: row.id, name: row.name });
    }
  }

  console.log(`\nP&I vessels without a link: ${rows.length}`);
  console.log(`  would link:  ${matches.length}`);
  console.log(`  ambiguous:   ${ambiguous.length}`);
  console.log(`  no match:    ${unmatched.length}`);

  for (const match of matches) {
    console.log(
      `  link  ${match.id}  "${match.name}" -> ${match.vesselId} (${match.by})`,
    );
  }
  for (const item of ambiguous) {
    console.log(
      `  skip  ${item.id}  "${item.name}" matches ${item.candidates} vessels`,
    );
  }
  for (const item of unmatched) {
    console.log(`  none  ${item.id}  "${item.name}"`);
  }

  if (!apply) {
    console.log('\nDry run only. Run again with --apply to write the links.');
    return;
  }

  let written = 0;
  for (const match of matches) {
    // The vesselId = null guard keeps a re-run, or a link made in the
    // meantime, from being overwritten.
    const result = await prisma.pniVessel.updateMany({
      where: { id: match.id, vesselId: null },
      data: { vesselId: match.vesselId },
    });
    written += result.count;
  }
  console.log(`\nLinked ${written} P&I vessels.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
