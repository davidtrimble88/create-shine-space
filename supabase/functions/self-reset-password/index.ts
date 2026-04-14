import { createClient } from "npm:@supabase/supabase-js@2";

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
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (mode === "get-questions") {
      // Return just question texts for an email
      if (!email) {
        return new Response(JSON.stringify({ error: "email required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find user by email
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const targetUser = users?.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
      
      if (!targetUser) {
        return new Response(JSON.stringify({ questions: [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: qData } = await adminClient
        .from("security_questions")
        .select("question, question_number")
        .eq("user_id", targetUser.id)
        .order("question_number");

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

    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const targetUser = users?.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
    
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "Verification failed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questions } = await adminClient
      .from("security_questions")
      .select("*")
      .eq("user_id", targetUser.id)
      .order("question_number");

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

    const { error: resetError } = await adminClient.auth.admin.updateUser(targetUser.id, {
      password: new_password,
    });

    if (resetError) {
      return new Response(JSON.stringify({ error: resetError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
