
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
import { KeyRound } from "lucide-react";

const loginSchema = z.object({
  identityId: z.string().min(5, { message: "ID must be at least 5 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const testUserRoles: { [key: string]: 'user' | 'admin' | 'superadmin' } = {
  "11111111": "user",
  "22222222": "admin",
  "33333333": "superadmin",
};

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identityId: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    const role = testUserRoles[data.identityId] || 'user'; // Default to 'user' if ID not found

    if (typeof window !== "undefined") {
      localStorage.setItem('userRole', role);
    }

    toast({
      title: "Login Successful",
      description: `Welcome, ${data.identityId}! Role: ${role}`,
    });
    
    setTimeout(() => {
      router.push("/dashboard");
    }, 1000);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="identityId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ITS / BGK ID</FormLabel>
              <FormControl>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Enter your ID (e.g., 11111111)" {...field} className="pl-10" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing In..." : "Sign In"}
        </Button>
      </form>
    </Form>
  );
}
