import { NextRequest, NextResponse } from "next/server";
import { fetchApolloEmployeesForCompany } from "@/services/apolloEmployeesService";

/**
 * Pobiera pracowników firmy z Apollo
 * GET /api/company-selection/apollo/employees?companyId=123
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");

    if (!companyId || isNaN(parseInt(companyId))) {
      return NextResponse.json({ error: "companyId jest wymagane" }, { status: 400 });
    }

    const result = await fetchApolloEmployeesForCompany(parseInt(companyId));
    return NextResponse.json(result);
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      {
        error: "Błąd pobierania pracowników z Apollo",
        details: errorObj.message,
      },
      { status: 500 }
    );
  }
}

