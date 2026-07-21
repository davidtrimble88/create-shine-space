// Self-service password reset via security questions.
// Security posture:
//  - "get-questions" returns a FIXED set of placeholder questions regardless of
//    whether the email exists, so attackers cannot enumerate accounts or learn
//    a real user's configured questions.
//  - "verify" checks the submitted answers via a SECURITY DEFINER RPC that
//    compares bcrypt hashes; plaintext answers are never stored.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLACEHOLDER_QUESTIONS = [
  "Answer the security question set on your account (1 of 3)",
  "Answer the security question set on your account (2 of 3)",
  "Answer the security question set on your account (3 of 3)",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, email, answers, new_password } = body ?? {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const restHeaders = {
      "apikey": supabaseServiceKey,
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
    };

    if (mode === "get-questions") {
      // Always return the same generic questions — do not disclose whether the
      // account exists or which questions were configured.
      return new Response(JSON.stringify({ questions: PLACEHOLDER_QUESTIONS }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: verify and reset
    if (!email || !answers || !new_password || !Array.isArray(answers) || answers.length !== 3) {
      return new Response(JSON.stringify({ error: "email, 3 answers, and new_password required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof new_password !== "string" || new_password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const listUsersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      headers: restHeaders,
    });
    const usersData = await listUsersRes.json();
    const users = usersData.users || [];
    const targetUser = users.find(
      (u: any) => u.email?.toLowerCase() === String(email).trim().toLowerCase()
    );

    // Generic failure message — do not disclose whether the account exists.
    const genericFail = () =>
      new Response(JSON.stringify({ error: "Verification failed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (!targetUser) return genericFail();

    // Verify answers via SECURITY DEFINER RPC that compares bcrypt hashes.
    const verifyRes = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_security_answers`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify({ _user_id: targetUser.id, _answers: answers.map((a: any) => String(a ?? "")) }),
    });
    const ok = await verifyRes.json();
    if (verifyRes.status !== 200 || ok !== true) {
      return genericFail();
    }

    // Update password via Admin REST API
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUser.id}`, {
      method: "PUT",
      headers: restHeaders,
      body: JSON.stringify({ password: new_password }),
    });

    if (!updateRes.ok) {
      const errBody = await updateRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: errBody.message || "Failed to reset password" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await fetch(
      `${supabaseUrl}/rest/v1/employees?user_id=eq.${targetUser.id}`,
      {
        method: "PATCH",
        headers: { ...restHeaders, "Accept": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ must_change_password: false }),
      }
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
