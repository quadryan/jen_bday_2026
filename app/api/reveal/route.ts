import { NextResponse } from "next/server";
import { errorStatus, getRevealEnabled, isAdminRequest, setRevealEnabled } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ reveal: await getRevealEnabled() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { reveal?: boolean };
    const reveal = await setRevealEnabled(Boolean(body.reveal));
    return NextResponse.json({ reveal });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: errorStatus(error) });
  }
}
