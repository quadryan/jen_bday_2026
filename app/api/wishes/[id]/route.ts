import { NextResponse } from "next/server";
import { deleteWish, errorStatus, isAdminRequest, updateWishFromForm } from "@/lib/store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const admin = isAdminRequest(request);
    const editToken = typeof formData.get("editToken") === "string" ? String(formData.get("editToken")) : undefined;
    const updated = await updateWishFromForm(id, formData, { admin, editToken });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    await deleteWish(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: errorStatus(error) });
  }
}
