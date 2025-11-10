import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_PAGE_SIZE = 200;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const selectionId = Number(params.id);
    if (!Number.isFinite(selectionId)) {
      return NextResponse.json(
        { success: false, error: "Niepoprawne ID selekcji" },
        { status: 400 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
      MAX_PAGE_SIZE
    );
    const statusFilter = searchParams.get("status")?.toUpperCase() || "";
    const search = searchParams.get("search")?.trim();

    const selection = await db.companySelection.findUnique({
      where: { id: selectionId },
    });

    if (!selection) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono selekcji" },
        { status: 404 }
      );
    }

    const membershipWhere: any = {
      selectionId,
    };

    if (statusFilter && statusFilter !== "ALL") {
      membershipWhere.status = statusFilter;
    }

    if (search) {
      membershipWhere.company = {
        OR: [
          { name: { contains: search } },
          { industry: { contains: search } },
          { classificationClass: { contains: search } },
          { classificationSubClass: { contains: search } },
        ],
      };
    }

    const [memberships, total, stats] = await Promise.all([
      db.companySelectionCompany.findMany({
        where: membershipWhere,
        orderBy: [
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              industry: true,
              market: true,
              classificationClass: true,
              classificationSubClass: true,
              verificationStatus: true,
              verificationScore: true,
              importBatch: {
                select: {
                  id: true,
                  name: true,
                  language: true,
                  market: true,
                },
              },
            },
          },
        },
      }),
      db.companySelectionCompany.count({
        where: membershipWhere,
      }),
      db.companySelectionCompany.groupBy({
        by: ["status"],
        where: { selectionId },
        _count: {
          _all: true,
        },
      }),
    ]);

    const statusSummary = stats.map((item) => ({
      status: item.status,
      count: item._count._all,
    }));

    return NextResponse.json({
      success: true,
      selection: {
        id: selection.id,
        name: selection.name,
        description: selection.description,
        market: selection.market,
        language: selection.language,
        totalCompanies: selection.totalCompanies,
        activeCompanies: selection.activeCompanies,
        createdBy: selection.createdBy,
        createdAt: selection.createdAt,
        updatedAt: selection.updatedAt,
      },
      companies: memberships.map((membership) => ({
        id: membership.id,
        companyId: membership.companyId,
        status: membership.status,
        score: membership.score,
        reason: membership.reason,
        verifiedAt: membership.verifiedAt,
        updatedAt: membership.updatedAt,
        notes: membership.notes,
        company: membership.company,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: statusSummary,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      {
        success: false,
        error: "Nie udało się pobrać szczegółów selekcji",
        details: err.message,
      },
      { status: 500 }
    );
  }
}


