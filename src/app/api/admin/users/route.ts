import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/db/adminReservations";
import {
    type GetUsersOptions,
    type UsersOrderableField,
    getUsers,
    getUsersSummary,
} from "@/lib/db/users";

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
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const admin = await isAdminUser(session.userId);
    if (!admin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(
      DEFAULT_PAGE,
      Number.parseInt(searchParams.get("page") ?? String(DEFAULT_PAGE), 10)
    );
    const pageSize = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
          10
        )
      )
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
      getUsers(options),
      getUsersSummary(),
    ]);

    const totalPages = list.total > 0 ? Math.ceil(list.total / pageSize) : 0;

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Error fetching admin users", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}


