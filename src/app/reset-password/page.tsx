"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

const schema = z
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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"loading" | "idle" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid or missing reset token. Please request a new reset link.");
      return;
    }

    async function verifyToken() {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${token}`);
        const result = await res.json();
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(result.error || "This reset link is invalid or has expired.");
        } else {
          setStatus("idle");
        }
      } catch {
        setStatus("error");
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    }
    verifyToken();
  }, [token]);

  async function onSubmit(data: z.infer<typeof schema>) {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });

      const result = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(result.error || "Failed to reset password.");
        return;
      }

      setStatus("success");
      setTimeout(() => router.push("/"), 3000);
    } catch {
      setStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="premium-shell flex min-h-screen flex-col items-center justify-between p-4 md:p-8">
      <div className="flex-1 flex items-center justify-center w-full max-w-md my-8">
        <Card className="w-full overflow-hidden glass-surface border-white/20 shadow-md">
          <CardHeader className="relative px-8 pb-5 pt-8 text-center">
            <div className="mx-auto mb-4 flex justify-center items-center">
              <Image
                src="/logo.png"
                alt="BGK Attendance Logo"
                width={64}
                height={64}
                className="h-16 w-16"
              />
            </div>
            <CardTitle>
              <h1 className="text-2xl font-bold text-foreground">
                Reset Password
              </h1>
            </CardTitle>
            <CardDescription className="pt-1 text-muted-foreground text-xs">
              Set a new password for your BGK Attendance account.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            {status === "loading" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Validating reset link...</p>
              </div>
            )}

            {status === "success" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Password Reset Successfully!
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your password has been updated. Redirecting you to login...
                  </p>
                </div>
                <Link
                  href="/"
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Go to Login
                </Link>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Link Invalid</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {errorMessage}
                  </p>
                </div>
                <Link
                  href="/forgot-password"
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Request a new reset link
                </Link>
              </div>
            )}

            {status === "idle" && (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-5"
                >
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Min. 6 characters"
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

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
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

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting Password...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>

                  <Link
                    href="/"
                    className="flex items-center justify-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Back to Login
                  </Link>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
