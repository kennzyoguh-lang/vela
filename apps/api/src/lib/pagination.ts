import type { Request } from "express";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Shared across every list endpoint (invoices, clients, transactions, ...) —
// a bare findMany with no limit was returning every row in the org
// regardless of how many existed. Caps pageSize even if the caller asks for
// more, rather than trusting client input for how much the DB should return.
export function parsePageParams(req: Request): PageParams {
  const rawPage = Number(req.query.page);
  const rawPageSize = Number(req.query.pageSize);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function toPage<T>(items: T[], total: number, params: PageParams): Page<T> {
  return { items, total, page: params.page, pageSize: params.pageSize };
}
