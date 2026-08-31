import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"; if (!rateLimit(`location:${ip}`, 10)) return NextResponse.json({ error: "Too many location requests." }, { status: 429 });
  try { const response = await fetch("https://ipapi.co/json/", { next: { revalidate: 86400 } }); if (!response.ok) throw new Error(); const data = await response.json(); return NextResponse.json({ city: data.city || "Ahmedabad", region: data.region || "Gujarat", country: data.country_name || "India", latitude: data.latitude, longitude: data.longitude, timezone: data.timezone }); } catch { return NextResponse.json({ city: "Ahmedabad", region: "Gujarat", country: "India", latitude: 23.02, longitude: 72.57, timezone: "Asia/Kolkata" }); }
}
