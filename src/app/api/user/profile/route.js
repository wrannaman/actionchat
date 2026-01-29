import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const meta = user.user_metadata || {};

  return NextResponse.json({
    first_name: meta.first_name || meta.given_name || "",
    last_name: meta.last_name || meta.family_name || "",
    avatar_url: meta.avatar_url || meta.picture || null,
    email: user.email,
  });
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { first_name, last_name } = body;

  if (typeof first_name !== "string" || typeof last_name !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const trimmedFirst = first_name.trim();
  const trimmedLast = last_name.trim();

  if (trimmedFirst.length > 100 || trimmedLast.length > 100) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      first_name: trimmedFirst,
      last_name: trimmedLast,
    },
  });

  if (updateError) {
    console.error("Profile update error:", updateError);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({
    message: "Profile updated",
    first_name: trimmedFirst,
    last_name: trimmedLast,
  });
}










