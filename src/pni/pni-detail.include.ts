// What the P&I detail endpoint returns. Shared with the quotation export so
// both always show the same P&I data.
export const PNI_DETAIL_INCLUDE = {
  club: { select: { id: true, code: true, name: true } },
  qsTemplate: { select: { id: true, name: true, templateVersion: true } },
  quotation: {
    include: {
      client: true,
      insuranceType: true,
      technicalUnit: { select: { id: true, name: true } },
    },
  },
  vessels: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      coverages: { where: { deletedAt: null } },
    },
  },
  insuranceBlocks: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      deductibles: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
        include: { vesselScopes: true },
      },
      provisions: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
        include: { vesselScopes: true },
      },
      coverRestrictions: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  provisions: {
    where: { deletedAt: null, insuranceBlockId: null },
    orderBy: { sortOrder: 'asc' as const },
    include: { vesselScopes: true },
  },
  installments: {
    where: { deletedAt: null },
    orderBy: { installmentNo: 'asc' as const },
  },
  requiredDocuments: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
  },
  organizationRoles: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
  },
  coverRestrictions: {
    where: { deletedAt: null, insuranceBlockId: null },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;
