"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authApi } from "@/lib/api";

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    let isMounted = true;

    const completeLogin = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error || !data?.session || !data.session.user) {
        setMessage("Google sign-in failed. Please try again.");
        return;
      }

      const { session } = data;
      const user = session.user;
      if (!user) {
        setMessage("Google sign-in failed. Please try again.");
        return;
      }
      authApi.saveAuth(session.access_token, {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email,
        role: user.user_metadata?.role || "Contributor",
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      });

      await authApi.syncProfile();

      router.replace("/dashboard");
    };

    completeLogin();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
