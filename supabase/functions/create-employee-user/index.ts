import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an admin/owner
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const callerRoles = roles?.map((r: any) => r.role) || [];
    if (!callerRoles.includes("owner") && !callerRoles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password } = await req.json();

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      const alreadyExists =
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        (error as any).code === "email_exists";

      if (alreadyExists) {
        // Find existing user by email and return their id so the caller
        // can link/update profile + roles instead of failing.
        let existingId: string | null = null;
        let page = 1;
        const target = String(email).toLowerCase();
        while (page <= 20 && !existingId) {
          const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({
            page,
            perPage: 200,
          });
          if (listErr) break;
          const found = list.users.find((u: any) => (u.email || "").toLowerCase() === target);
          if (found) existingId = found.id;
          if (!list.users.length || list.users.length < 200) break;
          page++;
        }

        if (existingId) {
          return new Response(
            JSON.stringify({ user_id: existingId, already_existed: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user_id: data.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
