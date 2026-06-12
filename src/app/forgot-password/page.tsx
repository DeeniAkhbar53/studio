"use client";

import { useState } from "react";
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
import { KeyRound, Loader2, ArrowLeft, MailCheck } from "lucide-react";

const schema = z.object({
  itsId: z
    .string()
    .min(1, "Please enter your ITS ID.")
    .max(20, "ID too long."),
});

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { itsId: "" },
  });

  async function onSubmit(data: z.infer<typeof schema>) {
    setIsLoading(true);
    try {
      await fetch("/api/auth/send-reset-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itsId: data.itsId.trim() }),
      });
      // Always show success regardless of whether user exists (prevents enumeration)
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Still show success on error
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
                Forgot Password
              </h1>
            </CardTitle>
            <CardDescription className="pt-1 text-muted-foreground text-xs">
              Enter your ITS ID and we'll send a reset link to your registered email.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                  <MailCheck className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Check your email</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    If your ITS ID is registered with an email address, you'll
                    receive a password reset link within a few minutes.
                  </p>
                </div>
                <Link
                  href="/"
                  className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Login
                </Link>
              </div>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-5"
                >
                  <FormField
                    control={form.control}
                    name="itsId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ITS ID / BGK ID</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Enter your 8-digit ITS ID"
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

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Reset Link...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>

                  <Link
                    href="/"
                    className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
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
