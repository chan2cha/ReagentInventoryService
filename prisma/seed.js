const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
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

const clientSeeds = [
  { name: "서울대학교병원", managerName: "김정호", phone: "02-2072-2114", address: "서울 종로구 대학로 101" },
  { name: "삼성서울병원", managerName: "이수진", phone: "02-3410-2114", address: "서울 강남구 일원로 81" },
  { name: "서울아산병원", managerName: "박민재", phone: "02-3010-3114", address: "서울 송파구 올림픽로43길 88" },
  { name: "세브란스병원", managerName: "최동훈", phone: "02-2228-1004", address: "서울 서대문구 연세로 50-1" },
  { name: "고려대학교의료원", managerName: "정하늘", phone: "02-920-5114", address: "서울 성북구 고려대로 73" }
];

const userSeed = {
  loginId: "admin",
  email: null,
  name: "관리자",
  passwordHash: "pbkdf2:sha256:210000:local-seed-admin-salt:dc49e64451718dfaa829959ef36c7c4f54d5b95c15c851cdfdec0b7f1c9801fe",
  mustChangePassword: false,
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

async function main() {
  const allergensByCode = new Map();
  const clientsByName = new Map();
  const lotsByNo = new Map();

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
        currentQuantity: seed.currentQuantity,
        isActive: true
      },
      create: {
        allergenId: allergen.id,
        lotNo: seed.lotNo,
        receivedDate: date(seed.receivedDate),
        expirationDate: date(seed.expirationDate),
        initialQuantity: seed.initialQuantity,
        currentQuantity: seed.currentQuantity,
        isActive: true
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
          managerName: seed.managerName,
          phone: seed.phone,
          address: seed.address,
          isActive: true
        }
      });
      clientsByName.set(seed.name, client);
    } else {
      const client = await prisma.client.create({
        data: {
          name: seed.name,
          managerName: seed.managerName,
          phone: seed.phone,
          address: seed.address,
          isActive: true
        }
      });
      clientsByName.set(seed.name, client);
    }
  }

  const user = await prisma.user.upsert({
    where: {
      loginId: userSeed.loginId
    },
    update: {
      email: userSeed.email,
      name: userSeed.name,
      passwordHash: userSeed.passwordHash,
      mustChangePassword: userSeed.mustChangePassword,
      role: userSeed.role,
      isActive: true
    },
    create: {
      loginId: userSeed.loginId,
      email: userSeed.email,
      name: userSeed.name,
      passwordHash: userSeed.passwordHash,
      mustChangePassword: userSeed.mustChangePassword,
      role: userSeed.role,
      isActive: true
    }
  });

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

  await prisma.stockMovement.deleteMany({
    where: {
      creator: {
        loginId: userSeed.loginId
      }
    }
  });

  for (const seed of movementSeeds) {
    const lot = lotsByNo.get(seed.lotNo);

    if (!lot) {
      continue;
    }

    await prisma.stockMovement.create({
      data: {
        reagentLotId: lot.id,
        type: seed.type,
        quantity: seed.quantity,
        reason: seed.reason,
        createdBy: user.id,
        createdAt: date(seed.createdAt)
      }
    });
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
