const { createHash, pbkdf2Sync, randomBytes } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const rotateLegacyAdminOnly = process.argv.includes("--rotate-legacy-admin");
const productionEnvironment = [
  process.env.NODE_ENV,
  process.env.APP_ENV,
  process.env.VERCEL_ENV
].some((value) => value?.toLowerCase() === "production");

if (productionEnvironment && !rotateLegacyAdminOnly) {
  throw new Error("Sample seed is disabled in production environments.");
}

if (!rotateLegacyAdminOnly && process.env.ALLOW_SAMPLE_DATA !== "true") {
  throw new Error("Set ALLOW_SAMPLE_DATA=true explicitly before running the sample seed.");
}

const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";
const SEED_PASSWORD_MIN_LENGTH = 12;
// SHA-256 fingerprints let us recognize and retire the historical public seed
// credential without retaining that credential or its reusable PBKDF2 value.
const LEGACY_SEED_HASH_FINGERPRINT = "cfba75f5aafeda3f6f44b741208ac0c8bce5d063c0c037c1f5cb5a4078397ec2";
const LEGACY_SEED_PASSWORD_FINGERPRINT = "b0d107a1cb94cd60c513a8636f99b8d700154887e2a96f0310a1b5f3e60a6ddd";
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for seed operations.");
}

function databaseTarget(url) {
  const parsed = new URL(url);
  const port = parsed.port || "5432";
  const schema = parsed.searchParams.get("schema") || "public";
  return `${parsed.hostname}:${port}${parsed.pathname}?schema=${schema}`;
}

const actualDatabaseTarget = databaseTarget(databaseUrl);

if (process.env.SEED_DATABASE_TARGET?.trim() !== actualDatabaseTarget) {
  throw new Error(
    `Set SEED_DATABASE_TARGET=${actualDatabaseTarget} explicitly after verifying the non-production seed target or approved legacy-admin recovery target.`
  );
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

const allergenSeeds = [
  { code: "HDM-D1", name: "집먼지 진드기 D.pteronyssinus", category: "흡입성", minStock: 10 },
  { code: "HDM-D2", name: "집먼지 진드기 D.farinae", category: "흡입성", minStock: 10 },
  { code: "DOG-01", name: "개 비듬", category: "흡입성", minStock: 8 },
  { code: "CAT-01", name: "고양이 비듬", category: "흡입성", minStock: 8 },
  { code: "GRS-01", name: "잔디 꽃가루 혼합", category: "흡입성", minStock: 6 },
  { code: "MLK-01", name: "우유", category: "식품성", minStock: 12 },
  { code: "EGG-01", name: "난백", category: "식품성", minStock: 12 },
  { code: "PNT-01", name: "땅콩", category: "식품성", minStock: 10 },
  { code: "SHR-01", name: "새우", category: "식품성", minStock: 8 },
  { code: "WHT-01", name: "밀가루", category: "식품성", minStock: 10 }
];

const lotSeeds = [
  { code: "HDM-D1", lotNo: "LOT-2501-HDM1-A", initialQuantity: 18, currentQuantity: 18, receivedDate: "2025-01-15", expirationDate: "2027-03-15" },
  { code: "HDM-D1", lotNo: "LOT-2501-HDM1-B", initialQuantity: 8, currentQuantity: 4, receivedDate: "2025-01-20", expirationDate: "2026-07-25" },
  { code: "HDM-D2", lotNo: "LOT-2502-HDM2-A", initialQuantity: 12, currentQuantity: 0, receivedDate: "2025-02-10", expirationDate: "2026-12-10" },
  { code: "DOG-01", lotNo: "LOT-2503-DOG-A", initialQuantity: 30, currentQuantity: 22, receivedDate: "2025-03-05", expirationDate: "2027-06-20" },
  { code: "CAT-01", lotNo: "LOT-2503-CAT-A", initialQuantity: 10, currentQuantity: 3, receivedDate: "2025-03-10", expirationDate: "2026-07-18" },
  { code: "GRS-01", lotNo: "LOT-2504-GRS-A", initialQuantity: 6, currentQuantity: 0, receivedDate: "2025-04-15", expirationDate: "2026-06-15" },
  { code: "MLK-01", lotNo: "LOT-2505-MLK-A", initialQuantity: 30, currentQuantity: 28, receivedDate: "2025-05-20", expirationDate: "2027-09-01" },
  { code: "EGG-01", lotNo: "LOT-2508-EGG-B", initialQuantity: 20, currentQuantity: 6, receivedDate: "2026-07-03", expirationDate: "2026-09-15" },
  { code: "PNT-01", lotNo: "LOT-2506-PNT-A", initialQuantity: 10, currentQuantity: 2, receivedDate: "2025-06-10", expirationDate: "2026-08-05" },
  { code: "SHR-01", lotNo: "LOT-2506-SHR-A", initialQuantity: 24, currentQuantity: 14, receivedDate: "2025-06-29", expirationDate: "2027-05-22" },
  { code: "WHT-01", lotNo: "LOT-2507-WHT-A", initialQuantity: 12, currentQuantity: 5, receivedDate: "2025-07-15", expirationDate: "2026-07-30" }
];

const warehouseSeeds = [
  { code: "FINISHED_GOODS", name: "완제품" },
  { code: "SAMPLE", name: "검체" },
  { code: "RETURNED", name: "반품" },
  { code: "NONCONFORMING", name: "부적합" },
  { code: "DISPOSAL", name: "폐기" }
];

const clientSeeds = [
  { name: "서울대학교병원", region: "서울 종로구", managerName: "김정호", deliveryDepartment: "진단검사의학과", memo: "평일 오전 납품 요청" },
  { name: "삼성서울병원", region: "서울 강남구", managerName: "이수진", deliveryDepartment: "알레르기내과", memo: "수령 전 담당자 연락" },
  { name: "서울아산병원", region: "서울 송파구", managerName: "박민재", deliveryDepartment: "소아청소년과", memo: "월·수 정기 납품" },
  { name: "세브란스병원", region: "서울 서대문구", managerName: "최동훈", deliveryDepartment: "호흡기내과", memo: "냉장 보관 확인 필요" },
  { name: "고려대학교의료원", region: "서울 성북구", managerName: "정하늘", deliveryDepartment: "진단검사의학과", memo: "오후 3시 이전 납품" },
  { name: "분당서울대학교병원", region: "경기 성남시", managerName: "윤서연", deliveryDepartment: "알레르기내과", memo: "신규 거래처 예시" },
  { name: "인하대학교병원", region: "인천 미추홀구", managerName: "한지민", deliveryDepartment: "소아청소년과", memo: "수령 확인서 동봉" }
];

const userSeed = {
  loginId: "admin",
  email: null,
  name: "관리자",
  role: "ADMIN"
};

const orderSeeds = [
  {
    orderNo: "ORD-20260709-001",
    clientName: "서울대학교병원",
    status: "RECEIVED",
    memo: "",
    createdAt: "2026-07-09",
    items: [
      { code: "HDM-D1", quantity: 5 },
      { code: "EGG-01", quantity: 3 }
    ]
  },
  {
    orderNo: "ORD-20260709-002",
    clientName: "세브란스병원",
    status: "RECEIVED",
    memo: "긴급",
    createdAt: "2026-07-09",
    items: [
      { code: "EGG-01", quantity: 5 },
      { code: "HDM-D2", quantity: 4 }
    ]
  },
  {
    orderNo: "ORD-20260708-001",
    clientName: "삼성서울병원",
    status: "READY_TO_SHIP",
    memo: "",
    createdAt: "2026-07-08",
    items: [
      { code: "CAT-01", quantity: 4 },
      { code: "PNT-01", quantity: 6 }
    ]
  },
  {
    orderNo: "ORD-20260707-001",
    clientName: "서울아산병원",
    status: "SHIPPED",
    memo: "",
    createdAt: "2026-07-07",
    items: [
      { code: "MLK-01", quantity: 10 },
      { code: "WHT-01", quantity: 5 }
    ]
  },
  {
    orderNo: "ORD-20260703-001",
    clientName: "고려대학교의료원",
    status: "CANCELLED",
    memo: "거래처 요청",
    createdAt: "2026-07-03",
    items: [
      { code: "GRS-01", quantity: 12 }
    ]
  }
];

const movementSeeds = [
  { lotNo: "LOT-2501-HDM1-A", type: "OUT", quantity: 5, reason: "ORD-20260709-001", createdAt: "2026-07-09" },
  { lotNo: "LOT-2501-HDM1-B", type: "IN", quantity: 8, reason: "정기 입고", createdAt: "2026-07-08" },
  { lotNo: "LOT-2503-CAT-A", type: "OUT", quantity: 4, reason: "ORD-20260708-001", createdAt: "2026-07-08" },
  { lotNo: "LOT-2505-MLK-A", type: "OUT", quantity: 10, reason: "ORD-20260707-001", createdAt: "2026-07-07" },
  { lotNo: "LOT-2504-GRS-A", type: "DISPOSE", quantity: 6, reason: "유통기한 만료", createdAt: "2026-07-05" },
  { lotNo: "LOT-2506-PNT-A", type: "ADJUST", quantity: 2, reason: "실사 차이 보정", createdAt: "2026-07-01" }
];

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  ).toString("hex");

  return `pbkdf2:${PASSWORD_DIGEST}:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isLegacySeedPasswordHash(passwordHash) {
  return fingerprint(passwordHash) === LEGACY_SEED_HASH_FINGERPRINT;
}

function requiredSeedAdminPassword() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  const normalizedPassword = password?.trim().toLowerCase() ?? "";
  const looksLikePlaceholder =
    normalizedPassword.includes("replace-with") ||
    (normalizedPassword.startsWith("<") && normalizedPassword.endsWith(">"));
  const reusesLegacyPassword = password
    ? fingerprint(password) === LEGACY_SEED_PASSWORD_FINGERPRINT
    : false;

  if (
    !password ||
    password.length < SEED_PASSWORD_MIN_LENGTH ||
    looksLikePlaceholder ||
    reusesLegacyPassword
  ) {
    throw new Error(
      `A non-placeholder SEED_ADMIN_PASSWORD (at least ${SEED_PASSWORD_MIN_LENGTH} characters and different from the legacy seed password) is required.`
    );
  }

  return password;
}

async function replaceLegacySeedAdmin(existing) {
  const password = requiredSeedAdminPassword();

  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: {
        id: existing.id
      }
    });

    if (!current || !isLegacySeedPasswordHash(current.passwordHash)) {
      const replacement = await tx.user.findUnique({
        where: {
          loginId: userSeed.loginId
        }
      });

      if (replacement && !isLegacySeedPasswordHash(replacement.passwordHash)) {
        return replacement;
      }

      throw new Error("LEGACY_SEED_ADMIN_CHANGED_DURING_ROTATION");
    }

    await tx.user.update({
      where: {
        id: current.id
      },
      data: {
        loginId: `retired-legacy-admin-${current.id}`,
        passwordHash: hashPassword(randomBytes(32).toString("hex")),
        isActive: false,
        sessionVersion: { increment: 1 },
        mustChangePassword: true
      }
    });

    const replacement = await tx.user.create({
      data: {
        ...userSeed,
        passwordHash: hashPassword(password),
        mustChangePassword: true,
        isActive: true
      }
    });

    await tx.auditLog.create({
      data: {
        action: "LEGACY_SEED_ADMIN_REPLACED",
        entityType: "USER",
        entityId: replacement.id,
        description: `Retired vulnerable legacy seed administrator ${current.id} and created a replacement account.`,
        actorId: replacement.id
      }
    });

    return replacement;
  });
}

async function seedAdminUser() {
  const existing = await prisma.user.findUnique({
    where: {
      loginId: userSeed.loginId
    }
  });

  if (existing) {
    if (isLegacySeedPasswordHash(existing.passwordHash)) {
      return replaceLegacySeedAdmin(existing);
    }

    return existing;
  }

  const password = requiredSeedAdminPassword();

  return prisma.user.create({
    data: {
      ...userSeed,
      passwordHash: hashPassword(password),
      mustChangePassword: true,
      isActive: true
    }
  });
}

async function main() {
  if (rotateLegacyAdminOnly) {
    const existing = await prisma.user.findUnique({
      where: {
        loginId: userSeed.loginId
      }
    });

    if (!existing || !isLegacySeedPasswordHash(existing.passwordHash)) {
      console.log("No active legacy seed administrator credential was found; no change was made.");
      return;
    }

    await replaceLegacySeedAdmin(existing);
    console.log("Legacy seed administrator retired and replacement administrator created.");
    return;
  }

  // Resolve the administrator before writing sample operational data so a missing
  // initial password fails before the rest of the seed mutates the database.
  const user = await seedAdminUser();
  const allergensByCode = new Map();
  const clientsByName = new Map();
  const lotsByNo = new Map();

  for (const warehouse of warehouseSeeds) {
    await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: { name: warehouse.name, isActive: true },
      create: { ...warehouse, isActive: true }
    });
  }

  for (const seed of allergenSeeds) {
    const allergen = await prisma.allergen.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        category: seed.category,
        minStock: seed.minStock,
        isActive: true
      },
      create: {
        code: seed.code,
        name: seed.name,
        category: seed.category,
        minStock: seed.minStock,
        isActive: true
      }
    });

    allergensByCode.set(seed.code, allergen);
  }

  for (const seed of lotSeeds) {
    const allergen = allergensByCode.get(seed.code);

    const lot = await prisma.reagentLot.upsert({
      where: {
        allergenId_lotNo_expirationDate: {
          allergenId: allergen.id,
          lotNo: seed.lotNo,
          expirationDate: date(seed.expirationDate)
        }
      },
      update: {
        receivedDate: date(seed.receivedDate),
        initialQuantity: seed.initialQuantity,
        isActive: true
      },
      create: {
        allergenId: allergen.id,
        lotNo: seed.lotNo,
        receivedDate: date(seed.receivedDate),
        expirationDate: date(seed.expirationDate),
        initialQuantity: seed.initialQuantity,
        isActive: true
      }
    });

    await prisma.warehouseStock.upsert({
      where: {
        reagentLotId_warehouse: {
          reagentLotId: lot.id,
          warehouse: "FINISHED_GOODS"
        }
      },
      update: { quantity: seed.currentQuantity },
      create: {
        reagentLotId: lot.id,
        warehouse: "FINISHED_GOODS",
        quantity: seed.currentQuantity
      }
    });

    lotsByNo.set(seed.lotNo, lot);
  }

  for (const seed of clientSeeds) {
    const existing = await prisma.client.findFirst({
      where: {
        name: seed.name
      }
    });

    if (existing) {
      const client = await prisma.client.update({
        where: {
          id: existing.id
        },
        data: {
          region: seed.region,
          managerName: seed.managerName,
          deliveryDepartment: seed.deliveryDepartment,
          memo: seed.memo,
          isActive: true
        }
      });
      clientsByName.set(seed.name, client);
    } else {
      const client = await prisma.client.create({
        data: {
          name: seed.name,
          region: seed.region,
          managerName: seed.managerName,
          deliveryDepartment: seed.deliveryDepartment,
          memo: seed.memo,
          isActive: true
        }
      });
      clientsByName.set(seed.name, client);
    }
  }

  for (const seed of orderSeeds) {
    const client = clientsByName.get(seed.clientName);

    const order = await prisma.order.upsert({
      where: {
        orderNo: seed.orderNo
      },
      update: {
        clientId: client.id,
        status: seed.status,
        memo: seed.memo,
        createdBy: user.id,
        createdAt: date(seed.createdAt)
      },
      create: {
        orderNo: seed.orderNo,
        clientId: client.id,
        status: seed.status,
        memo: seed.memo,
        createdBy: user.id,
        createdAt: date(seed.createdAt)
      }
    });

    await prisma.orderItem.deleteMany({
      where: {
        orderId: order.id
      }
    });

    for (const item of seed.items) {
      const allergen = allergensByCode.get(item.code);

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          allergenId: allergen.id,
          quantity: item.quantity
        }
      });
    }
  }

  for (const seed of movementSeeds) {
    const lot = lotsByNo.get(seed.lotNo);

    if (!lot) {
      continue;
    }

    const movementRefId = `${lot.id}:${seed.type}:${seed.createdAt}`;
    const existingMovement = await prisma.stockMovement.findFirst({
      where: {
        reagentLotId: lot.id,
        type: seed.type,
        quantity: seed.quantity,
        reason: seed.reason,
        createdAt: date(seed.createdAt),
        OR: [
          {
            refType: "SAMPLE_SEED",
            refId: movementRefId
          },
          {
            refType: null,
            refId: null
          }
        ]
      }
    });

    const data = {
      reagentLotId: lot.id,
      type: seed.type,
      quantity: seed.quantity,
      warehouse: "FINISHED_GOODS",
      reason: seed.reason,
      refType: "SAMPLE_SEED",
      refId: movementRefId,
      createdBy: user.id,
      createdAt: date(seed.createdAt)
    };

    if (existingMovement) {
      await prisma.stockMovement.update({
        where: {
          id: existingMovement.id
        },
        data
      });
    } else {
      await prisma.stockMovement.create({ data });
    }
  }

  console.log(
    `Seeded ${allergenSeeds.length} allergens, ${lotSeeds.length} reagent lots, ${clientSeeds.length} clients, ${orderSeeds.length} orders, and ${movementSeeds.length} stock movements.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
