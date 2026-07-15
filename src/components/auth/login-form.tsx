"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  getUserByItsOrBgkId,
  updateUserLastLogin,
} from "@/lib/firebase/userService";
import {
  requiresPasswordAndOtp,
  verifyPassword,
  setUserPassword,
} from "@/lib/firebase/authService";
import {
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Mail,
  Eye,
  EyeOff,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import type { User } from "@/types";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Schemas ──────────────────────────────────────────────────────────────────

const itsSchema = z.object({
  identityId: z
    .string()
    .min(1, "ITS ID / BGK ID is required.")
    .max(20, "ID too long."),
});

const passwordSchema = z.object({
  password: z.string().min(1, "Password is required."),
});

const setPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters.")
      .max(64, "Password is too long."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, "OTP must be exactly 6 digits.")
    .regex(/^\d+$/, "OTP must be numeric."),
});

type Stage = "its-id" | "set-password" | "password" | "otp";

// ── Component ─────────────────────────────────────────────────────────────────

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("its-id");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0); // seconds remaining

  // ── Forms ──────────────────────────────────────────────────────────────────

  const itsForm = useForm<z.infer<typeof itsSchema>>({
    resolver: zodResolver(itsSchema),
    defaultValues: { identityId: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  const setPasswordForm = useForm<z.infer<typeof setPasswordSchema>>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  // ── OTP Cooldown Timer ────────────────────────────────────────────────────

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const proceedToLogin = useCallback(
    async (u: User) => {
      const sessionId = `${u.itsId}-${Date.now()}`;
      await updateUserLastLogin(u, sessionId);

      if (typeof window !== "undefined") {
        localStorage.setItem("userRole", u.role);
        localStorage.setItem("userName", u.name);
        localStorage.setItem("userItsId", u.itsId);
        localStorage.setItem("userMohallahId", u.mohallahId || "");
        localStorage.setItem("userBgkId", u.bgkId || "");
        localStorage.setItem("userTeam", u.team || "");
        localStorage.setItem("userDesignation", u.designation || "Member");
        localStorage.setItem(
          "userPageRights",
          JSON.stringify(u.pageRights || [])
        );
        localStorage.setItem("unreadNotificationCount", "0");
        localStorage.setItem("sessionId", sessionId);
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }

      toast({
        title: "Login Successful",
        description: `Welcome, ${u.name}!`,
      });

      setTimeout(() => {
        let redirectUrl = "/dashboard";
        if (typeof window !== "undefined") {
          const match = window.location.search.match(/[?&]redirect=([^&]*)/);
          if (match) {
            redirectUrl = decodeURIComponent(match[1]);
          }
        }
        window.location.href = redirectUrl;
      }, 800);
    },
    [router, toast]
  );

  const sendOtp = useCallback(
    async (u: User) => {
      if (!u.email) {
        toast({
          variant: "destructive",
          title: "No Email Found",
          description:
            "Your account has no email address. Please contact an admin.",
        });
        return false;
      }

      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          userItsId: u.itsId,
          userName: u.name,
          email: u.email,
          mohallahId: u.mohallahId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "OTP Error",
          description: data.error || "Failed to send OTP.",
        });
        return false;
      }

      setMaskedEmail(data.maskedEmail || u.email);
      setOtpCooldown(60);
      toast({
        title: "OTP Sent",
        description: `A 6-digit OTP has been sent to ${data.maskedEmail}.`,
      });
      return true;
    },
    [toast]
  );

  // ── Stage 1: ITS ID ───────────────────────────────────────────────────────

  async function onItsSubmit(data: z.infer<typeof itsSchema>) {
    setIsLoading(true);
    try {
      const foundUser = await getUserByItsOrBgkId(data.identityId.trim());

      if (!foundUser || !foundUser.role) {
        toast({
          variant: "destructive",
          title: "User Not Found",
          description: "Invalid ID or user not found in the system.",
        });
        return;
      }

      setUser(foundUser);

      // Does this user need password + OTP?
      if (requiresPasswordAndOtp(foundUser)) {
        const pref = foundUser.loginPreference || "both";
        if (pref === "otp") {
          const sent = await sendOtp(foundUser);
          if (sent) {
            setStage("otp");
            otpForm.reset();
          }
        } else {
          if (!foundUser.password) {
            // First-time login → must set a password
            setStage("set-password");
          } else {
            // Has password → enter it
            setStage("password");
          }
        }
      } else {
        // Regular member → direct login
        await proceedToLogin(foundUser);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Stage 2: Set Password (first time) ────────────────────────────────────

  async function onSetPasswordSubmit(data: z.infer<typeof setPasswordSchema>) {
    if (!user) return;
    setIsLoading(true);
    try {
      await setUserPassword(user, data.newPassword);
      toast({
        title: "Password Set Successfully",
        description:
          "Your password has been created. Please log in again with your new password.",
      });
      // Reset back to ITS ID stage for re-login
      setStage("its-id");
      setUser(null);
      itsForm.reset();
      setPasswordForm.reset();
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to set password. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Stage 3: Password ─────────────────────────────────────────────────────

  async function onPasswordSubmit(data: z.infer<typeof passwordSchema>) {
    if (!user) return;
    setIsLoading(true);
    try {
      const valid = await verifyPassword(data.password, user.password!, user);

      if (!valid) {
        toast({
          variant: "destructive",
          title: "Incorrect Password",
          description: "The password you entered is incorrect.",
        });
        return;
      }

      const pref = user.loginPreference || "both";
      if (pref === "password") {
        // Password only → login directly
        await proceedToLogin(user);
      } else {
        // both
        const sent = await sendOtp(user);
        if (sent) {
          setStage("otp");
          otpForm.reset();
        }
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Password verification failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Stage 4: OTP ──────────────────────────────────────────────────────────

  async function onOtpSubmit(data: z.infer<typeof otpSchema>) {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, otp: data.otp }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "OTP Verification Failed",
          description: result.error || "Invalid or expired OTP.",
        });
        return;
      }

      // All checks passed — log in
      await proceedToLogin(user);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "OTP verification failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!user || otpCooldown > 0) return;
    setIsLoading(true);
    await sendOtp(user);
    setIsLoading(false);
    otpForm.reset();
  }

  function handleBack() {
    if (stage === "otp") {
      if (user?.loginPreference === "otp") {
        setStage("its-id");
        setUser(null);
        otpForm.reset();
      } else {
        setStage("password");
        passwordForm.reset();
      }
    } else if (stage === "password" || stage === "set-password") {
      setStage("its-id");
      setUser(null);
      passwordForm.reset();
      setPasswordForm.reset();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stage indicator */}
      {stage !== "its-id" && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {stage === "set-password" && <Lock className="h-4 w-4" />}
            {stage === "password" && <Lock className="h-4 w-4" />}
            {stage === "otp" && <ShieldCheck className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {user?.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {stage === "set-password" && "Create your password"}
              {stage === "password" && "Enter your password"}
              {stage === "otp" && `OTP sent to ${maskedEmail}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── STAGE 1: ITS ID ── */}
      {stage === "its-id" && (
        <Form {...itsForm}>
          <form
            onSubmit={itsForm.handleSubmit(onItsSubmit)}
            className="space-y-5"
          >
            <FormField
              control={itsForm.control}
              name="identityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ITS ID / BGK ID</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Enter your ITS or BGK ID"
                        {...field}
                        className="pl-10"
                        disabled={isLoading}
                        autoFocus
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Continue"
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/forgot-password"
                className="font-medium text-primary transition-colors hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          </form>
        </Form>
      )}

      {/* ── STAGE 2: SET PASSWORD (First Login) ── */}
      {stage === "set-password" && (
        <Form {...setPasswordForm}>
          <form
            onSubmit={setPasswordForm.handleSubmit(onSetPasswordSubmit)}
            className="space-y-5"
          >
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <p className="font-semibold">First Login — Create Your Password</p>
              <p className="mt-1 text-xs opacity-80">
                You must set a password before you can log in. Choose a strong,
                unique password.
              </p>
            </div>

            <FormField
              control={setPasswordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Min. 6 characters"
                        {...field}
                        className="pl-10 pr-10"
                        disabled={isLoading}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={setPasswordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Re-enter your password"
                        {...field}
                        className="pl-10"
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Password...
                </>
              ) : (
                "Set Password & Continue"
              )}
            </Button>
          </form>
        </Form>
      )}

      {/* ── STAGE 3: PASSWORD ── */}
      {stage === "password" && (
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="space-y-5"
          >
            <FormField
              control={passwordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        {...field}
                        className="pl-10 pr-10"
                        disabled={isLoading}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify Password
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/forgot-password"
                className="font-medium text-primary transition-colors hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          </form>
        </Form>
      )}

      {/* ── STAGE 4: OTP ── */}
      {stage === "otp" && (
        <Form {...otpForm}>
          <form
            onSubmit={otpForm.handleSubmit(onOtpSubmit)}
            className="space-y-5"
          >
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-primary">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Check your email</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                A 6-digit OTP was sent to{" "}
                <strong className="text-foreground">{maskedEmail}</strong>. It
                expires in 10 minutes.
              </p>
            </div>

            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>One-Time Password (OTP)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Enter 6-digit OTP"
                        {...field}
                        className="pl-10 text-center font-mono text-xl tracking-[0.4em]"
                        maxLength={6}
                        inputMode="numeric"
                        autoFocus
                        disabled={isLoading}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          field.onChange(val);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying OTP...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify & Sign In
                </>
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Didn't receive it?</span>
              {otpCooldown > 0 ? (
                <span className="text-muted-foreground">
                  Resend in{" "}
                  <strong className="text-foreground">{otpCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 font-medium text-primary transition-colors hover:underline disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Resend OTP
                </button>
              )}
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
