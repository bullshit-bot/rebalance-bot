import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, Key, AlertTriangle, Zap } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }
    setLoading(true);
    try {
      const ok = await login(apiKey.trim());
      if (ok) {
        navigate("/", { replace: true });
      } else {
        setError("Invalid API key. Check your key and try again.");
      }
    } catch {
      setError("Cannot connect to backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 brutal-card px-5 py-3 bg-primary text-primary-foreground mb-6">
            <Zap size={22} strokeWidth={2.5} />
            <span className="text-xl font-black tracking-tight">RBBot</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground leading-tight">
            Operator Console
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Personal rebalancing control panel
          </p>
        </div>

        {/* Login Card */}
        <form onSubmit={handleSubmit} className="brutal-card p-6 space-y-5">
          <div>
            <label className="stat-label mb-1.5 block">API Key</label>
            <div className="relative">
              <Key
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="brutal-input w-full pl-9"
                placeholder="Enter your API key"
                autoFocus
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border-[2px] border-destructive rounded-md px-3 py-2">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="brutal-btn-primary w-full text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Lock size={15} />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Rebalance Bot v3.1.0 · Secured personal access
        </p>
      </div>
    </div>
  );
}
