import { NextResponse } from "next/server";
import { createWishFromForm, errorStatus, isAdminRequest, listWishes } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const wantsAdmin = url.searchParams.get("admin") === "1";

    if (wantsAdmin && !isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await listWishes({ includeHiddenContent: wantsAdmin }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const created = await createWishFromForm(formData);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: errorStatus(error) });
  }
}
