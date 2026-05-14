"use client";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Focus, Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md"
    >
      <div className="flex flex-col items-center gap-3 pb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-brand-600)] text-white shadow-xl shadow-blue-900/40"
        >
          <Focus size={28} strokeWidth={2.4} />
        </motion.div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          QC Vision
        </h1>
        <p className="text-sm text-slate-400">
          AI-Powered Quality Control Platform
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl shadow-black/40"
      >
        <h2 className="text-xl font-semibold text-slate-900">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to your account to continue
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">
              Email address
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@qcvision.com"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--color-brand-500)] focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-500)]/30 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--color-brand-500)] focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-500)]/30 focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[var(--color-brand-600)] focus:ring-[var(--color-brand-500)]/30"
              />
              Remember me
            </label>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
            >
              Forgot password?
            </a>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            <AlertCircle size={16} className="mt-0.5 flex-none" />
            {error}
          </motion.div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-600)] text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-[var(--color-brand-700)] active:translate-y-px disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in to Dashboard"
          )}
        </button>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
          <span className="font-medium">Administrator</span>
          <span className="mx-2 text-slate-300">•</span>
          <span className="font-medium">QA Operator</span>
          <span className="mx-2 text-slate-300">•</span>
          <span className="font-medium">Production Manager</span>
        </div>
      </motion.form>

      <p className="mt-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} QC Vision. Enterprise Quality Control
        Platform
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <main className="qc-auth-bg flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
