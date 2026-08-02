import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

import { requirePermission } from "@/lib/api-auth";
import {
  type GetUsersOptions,
  type UsersOrderableField,
  getRegisteredUsers,
  getRegisteredUsersSummary,
} from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";

const ORDERABLE_FIELDS: UsersOrderableField[] = [
  "name",
  "lastName",
  "email",
  "dni",
  "institution",
  "role",
  "createdAt",
];

const isOrderableField = (value: string | null): value is UsersOrderableField =>
  !!value && ORDERABLE_FIELDS.includes(value as UsersOrderableField);

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  try {
    const { error } = await requirePermission("users:manage");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(
      DEFAULT_PAGE,
      Number.parseInt(searchParams.get("page") ?? String(DEFAULT_PAGE), 10),
    );
    const pageSize = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const search = searchParams.get("search") ?? undefined;
    const orderByParam = searchParams.get("orderBy");
    const orderDirectionParam = searchParams.get("orderDirection");

    const options: GetUsersOptions = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search,
      orderBy: isOrderableField(orderByParam) ? orderByParam : undefined,
      orderDirection: orderDirectionParam === "desc" ? "desc" : "asc",
    };

    const [list, summary] = await Promise.all([
      getRegisteredUsers(options),
      getRegisteredUsersSummary(),
    ]);

    const totalPages = list.total > 0 ? Math.ceil(list.total / pageSize) : 0;

    return NextResponse.json(
      serializeJson({
        data: list.users,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalUsers: list.total,
          orderBy: options.orderBy ?? "createdAt",
          orderDirection: options.orderDirection ?? "asc",
          search: search ?? "",
        },
        summary,
      }),
    );
  } catch (error) {
    return apiServerError("admin/users GET", error);
  }
}
