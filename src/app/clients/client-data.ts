import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { clients } from "../reagent-data";
import { PAGE_SIZE,pageMeta,paginateRows,type PaginatedResult } from "@/lib/pagination";

export type ClientRow = {
  id: string;
  name: string;
  manager: string;
  phone: string;
  region: string;
  address: string;
  memo: string;
  active: boolean;
  orderCount: number;
  source: "database" | "sample";
};

function sampleClientRows(): ClientRow[] {
  return clients.map((client) => ({
    id: String(client.id),
    name: client.name,
    manager: client.manager,
    phone: client.phone,
    region: client.region,
    address: client.region,
    memo: "",
    active: true,
    orderCount: 0,
    source: "sample"
  }));
}

function regionFromAddress(address: string | null) {
  if (!address) {
    return "-";
  }

  return address.split(" ").slice(0, 2).join(" ");
}

export async function getClientRows(page:number, q = ""): Promise<PaginatedResult<ClientRow>> {
  try {
    const where = q ? { OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { managerName: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q, mode: "insensitive" as const } },
      { address: { contains: q, mode: "insensitive" as const } },
      { memo: { contains: q, mode: "insensitive" as const } }
    ] } : {};
    const requestedSkip = (Math.max(1, page) - 1) * PAGE_SIZE;
    const clientQuery = {
      where,
      include: {
        _count: {
          select: {
            orders: true
          }
        }
      },
      orderBy: {
        name: "asc"
      },skip:requestedSkip,take:PAGE_SIZE
    } satisfies Prisma.ClientFindManyArgs;
    const [total, initialClients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany(clientQuery)
    ]);
    const meta=pageMeta(page,total);
    const dbClients = meta.skip === requestedSkip
      ? initialClients
      : await prisma.client.findMany({ ...clientQuery, skip: meta.skip });

    return {...meta,rows:dbClients.map((client) => ({
      id: client.id,
      name: client.name,
      manager: client.managerName ?? "-",
      phone: client.phone ?? "-",
      region: regionFromAddress(client.address),
      address: client.address ?? "",
      memo: client.memo ?? "",
      active: client.isActive,
      orderCount: client._count.orders,
      source: "database"
    }))};
  } catch (error) {
    return handleDataSourceError("clients", error,()=>paginateRows(sampleClientRows(),page));
  }
}

export function clientSourceLabel(rows: ClientRow[]) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}
