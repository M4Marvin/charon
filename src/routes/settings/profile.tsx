import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/settings/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: session } = authClient.useSession();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) {
      setError("All fields are required.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("New passwords don't match.");
      return;
    }
    if (newPw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { error: apiErr } = await authClient.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
        revokeOtherSessions: true,
      });
      if (apiErr) {
        setError(apiErr.message ?? "Failed to change password");
        return;
      }
      toast.success("Password changed");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-title">Profile</h2>
      <div className="rounded-lg border p-4">
        <Label className="text-xs text-2">Username</Label>
        <p className="text-sm mt-0.5">{session?.user?.username ?? session?.user?.name ?? "—"}</p>
      </div>
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-headline">Change Password</h3>
        <p className="text-2 text-sm">Changing your password signs you out of all other devices.</p>
        {error ? <ErrorBanner message={error} /> : null}
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="cpw">Current password</Label>
            <Input
              id="cpw"
              type={showPassword ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              minLength={1}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="npw">New password</Label>
            <Input
              id="npw"
              type={showPassword ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpw2">Confirm new password</Label>
            <Input
              id="cpw2"
              type={showPassword ? "text" : "password"}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 gap-1.5"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              {showPassword ? "Hide passwords" : "Show passwords"}
            </Button>
            <Button type="submit" disabled={saving} className="h-10">
              {saving ? "Saving…" : "Change Password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
