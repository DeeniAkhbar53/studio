
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
import type { UserRole } from "@/types";

const loginSchema = z.object({
  identityId: z.string().min(5, { message: "ID must be at least 5 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const SUPERADMIN_TEMP_ITS_ID = "50487028";
const SUPERADMIN_TEMP_NAME = "Shabbir bhai Murtaza bhai Shakir";

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
    form.setValue('identityId', data.identityId.trim()); // Trim input
    const { identityId } = data;

    let userRole: UserRole | null = null;
    let userName: string | null = null;
    let userItsId: string | null = null;

    form.formState.isSubmitting; // Access to ensure reactivity if needed, though direct set below

    if (identityId === SUPERADMIN_TEMP_ITS_ID) {
      // Temporary superadmin login
      userRole = 'superadmin';
      userName = SUPERADMIN_TEMP_NAME;
      userItsId = SUPERADMIN_TEMP_ITS_ID;
      
      toast({
        title: "Temporary Admin Login",
        description: `Welcome, ${userName}! Role: Super Admin (Temporary).`,
      });

    } else {
      // Regular database lookup
      try {
        const user = await getUserByItsOrBgkId(identityId);

        if (user && user.role) {
          userRole = user.role;
          userName = user.name;
          userItsId = user.itsId;
        }
      } catch (error) {
        console.error("Login error during DB lookup:", error);
        // Error will be handled by the general "Login Failed" toast below if user remains null
      }
    }

    if (userRole && userName && userItsId) {
      if (typeof window !== "undefined") {
        localStorage.setItem('userRole', userRole);
        localStorage.setItem('userName', userName);
        localStorage.setItem('userItsId', userItsId);
      }

      if (identityId !== SUPERADMIN_TEMP_ITS_ID) { // Avoid double toast for temp admin
        toast({
          title: "Login Successful",
          description: `Welcome, ${userName}! Role: ${userRole.charAt(0).toUpperCase() + userRole.slice(1).replace(/-/g, ' ')}`,
        });
      }
      
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);

    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid ID or user not found.",
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
              <FormLabel>ITS / BGK ID</FormLabel>
              <FormControl>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Enter your ID" {...field} className="pl-10" />
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
