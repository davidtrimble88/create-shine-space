const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, email, answers, new_password } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Helper to call Supabase REST API
    const restHeaders = {
      "apikey": supabaseServiceKey,
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
    };

    // Helper to list users via admin API
    const listUsersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      headers: restHeaders,
    });
    const usersData = await listUsersRes.json();
    const users = usersData.users || [];

    if (mode === "get-questions") {
      if (!email) {
        return new Response(JSON.stringify({ error: "email required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetUser = users.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
      
      if (!targetUser) {
        return new Response(JSON.stringify({ questions: [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Query security_questions via REST
      const qRes = await fetch(
        `${supabaseUrl}/rest/v1/security_questions?user_id=eq.${targetUser.id}&order=question_number`,
        { headers: { ...restHeaders, "Accept": "application/json" } }
      );
      const qData = await qRes.json();

      return new Response(JSON.stringify({ questions: (qData ?? []).map((q: any) => q.question) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: verify and reset
    if (!email || !answers || !new_password || !Array.isArray(answers) || answers.length !== 3) {
      return new Response(JSON.stringify({ error: "email, 3 answers, and new_password required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUser = users.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
    
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "Verification failed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qRes = await fetch(
      `${supabaseUrl}/rest/v1/security_questions?user_id=eq.${targetUser.id}&order=question_number`,
      { headers: { ...restHeaders, "Accept": "application/json" } }
    );
    const questions = await qRes.json();

    if (!questions || questions.length < 3) {
      return new Response(JSON.stringify({ error: "Security questions not set up for this account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (let i = 0; i < 3; i++) {
      const stored = questions.find((q: any) => q.question_number === i + 1);
      if (!stored) {
        return new Response(JSON.stringify({ error: "Verification failed" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userAnswer = (answers[i] ?? "").trim().toLowerCase();
      const storedAnswer = (stored.answer ?? "").trim().toLowerCase();
      if (userAnswer !== storedAnswer) {
        return new Response(JSON.stringify({ error: "One or more answers are incorrect" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update password via Admin REST API
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUser.id}`, {
      method: "PUT",
      headers: restHeaders,
      body: JSON.stringify({ password: new_password }),
    });

    if (!updateRes.ok) {
      const errBody = await updateRes.json();
      return new Response(JSON.stringify({ error: errBody.message || "Failed to reset password" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clear must_change_password flag so user isn't forced through onboarding again
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
