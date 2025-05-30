
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
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { KeyRound, Loader2 } from "lucide-react";
import type { User, UserRole } from "@/types";

const loginSchema = z.object({
  identityId: z.string().length(8, { message: "ITS ID must be exactly 8 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
    form.setValue('identityId', data.identityId.trim());
    const { identityId } = data;

    try {
      console.log(`Attempting to find user with ID: ${identityId}`);
      const user: User | null = await getUserByItsOrBgkId(identityId);

      if (user && user.role) {
        console.log("User found:", JSON.stringify(user));
        if (typeof window !== "undefined") {
          localStorage.setItem('userRole', user.role);
          localStorage.setItem('userName', user.name);
          localStorage.setItem('userItsId', user.itsId);
          localStorage.setItem('userMohallahId', user.mohallahId || '');
          localStorage.setItem('userPageRights', JSON.stringify(user.pageRights || []));
          localStorage.setItem('unreadNotificationCount', '0');
          window.dispatchEvent(new CustomEvent('notificationsUpdated'));
        }

        toast({
          title: "Login Successful",
          description: `Welcome, ${user.name}! Role: ${user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/-/g, ' ')}`,
        });
        
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);

      } else {
        console.log("User not found in system for ID:", identityId);
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid ID or user not found in the system.",
        });
      }
    } catch (error) {
      console.error("Login error during data lookup:", error);
      toast({
        variant: "destructive",
        title: "Login Error",
        description: `An error occurred: ${error instanceof Error ? error.message : "Please check console for details."}`,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="identityId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ITS ID</FormLabel>
              <FormControl>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Enter your 8-digit ITS ID" {...field} className="pl-10" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing In...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </Form>
  );
}
