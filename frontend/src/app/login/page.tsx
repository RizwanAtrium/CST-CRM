"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Button, Field, Modal } from "@/components/ui";
import { ApiError, ApiUnavailableError, authApi } from "@/lib/api";
import { createDemoSession, getSession, saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    if (getSession()) router.replace("/dashboard");
  }, [router]);

  async function login(formData: FormData) {
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const remember = formData.get("remember") === "on";
    setLoading(true);
    setError("");
    setBackendUnavailable(false);
    try {
      const session = await authApi.login(email, password);
      saveSession(session, remember);
      router.replace("/dashboard");
    } catch (loginError) {
      if (loginError instanceof ApiUnavailableError) {
        setBackendUnavailable(true);
        setError("The Node.js API is unavailable. You can retry or enter clearly labeled demo mode.");
      } else if (loginError instanceof ApiError) {
        setError(loginError.status === 401 ? "Email or password is incorrect." : loginError.message);
      } else {
        setError("Sign-in failed. Please retry.");
      }
    } finally {
      setLoading(false);
    }
  }

  function enterDemoMode() {
    saveSession(createDemoSession(), false);
    router.replace("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand"><div className="brand-mark">C</div><strong>CST CRM</strong></div>
        <div className="login-copy"><h1>Every client.<br /><span>One clear view.</span></h1><p>Run onboarding, retention, billing, and customer success from a single operating system designed around your team.</p></div>
        <div className="login-proof"><div><strong>47</strong><span>Active clients</span></div><div><strong>$28.6K</strong><span>Active MRR</span></div><div><strong>86.4</strong><span>CST score</span></div></div>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" action={login}>
          <h2>Welcome back</h2>
          <p>Sign in to your customer success workspace.</p>
          <Field label="Email address"><div className="input-with-icon"><Mail size={15} /><input name="email" type="email" defaultValue="asad@example.com" autoComplete="email" required /></div></Field>
          <Field label="Password"><div className="input-with-icon"><LockKeyhole size={15} /><input name="password" type="password" autoComplete="current-password" minLength={8} required /></div></Field>
          <div className="login-form-options"><label><input name="remember" type="checkbox" /> Keep me signed in</label><button type="button" onClick={() => setForgotOpen(true)}>Forgot password?</button></div>
          {error && <div className="login-error" role="alert"><AlertCircle size={15} /><span>{error}</span></div>}
          <Button type="submit" data-testid="login-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={16} />Signing in…</> : "Sign in to workspace"}</Button>
          {backendUnavailable && <Button type="button" variant="secondary" onClick={enterDemoMode} data-testid="demo-login">Continue in demo mode</Button>}
          <div className="demo-note"><Info size={15} /> API authentication is attempted first. Demo mode is offered only when the backend cannot be reached.</div>
        </form>
      </section>
      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Password recovery" description="Password reset email delivery is not configured yet." footer={<Button onClick={() => setForgotOpen(false)}>Got it</Button>}>
        <div className="recovery-info"><Info size={19} /><div><strong>Contact your workspace Director</strong><p>Ask a Director to reset your account credentials. No email has been sent from this screen.</p></div></div>
      </Modal>
    </main>
  );
}
