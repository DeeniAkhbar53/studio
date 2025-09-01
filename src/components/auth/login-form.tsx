
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
import { KeyRound, Loader2, Lock } from "lucide-react";
import type { User, UserRole } from "@/types";
import { useState } from "react";

const loginSchema = z.object({
  identityId: z.string().length(8, { message: "ITS ID must be exactly 8 characters." }),
  password: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [userToAuthenticate, setUserToAuthenticate] = useState<User | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identityId: "",
      password: "",
    },
  });

  const proceedToLogin = (user: User) => {
    if (typeof window !== "undefined") {
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userItsId', user.itsId);
      localStorage.setItem('userMohallahId', user.mohallahId || '');
      localStorage.setItem('userBgkId', user.bgkId || '');
      localStorage.setItem('userTeam', user.team || '');
      localStorage.setItem('userDesignation', user.designation || 'Member');
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
  };

  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    form.setValue('identityId', data.identityId.trim());
    const { identityId, password } = data;

    try {
      // If we are in the password stage
      if (requiresPassword && userToAuthenticate) {
        if (userToAuthenticate.password === password) {
          proceedToLogin(userToAuthenticate);
        } else {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: "Incorrect password provided.",
          });
          setIsSubmitting(false);
        }
        return;
      }

      // First stage: check ITS ID
      console.log(`Attempting to find user with ID: ${identityId}`);
      const user: User | null = await getUserByItsOrBgkId(identityId);

      if (user && user.role) {
        console.log("User found:", JSON.stringify(user));
        
        // Check if user is admin/superadmin and requires a password
        if ((user.role === 'admin' || user.role === 'superadmin') && user.password) {
          setUserToAuthenticate(user);
          setRequiresPassword(true);
          setIsSubmitting(false);
        } else {
          // If not admin/superadmin or no password is set, log them in directly
          proceedToLogin(user);
        }

      } else {
        console.log("User not found in system for ID:", identityId);
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid ID or user not found in the system.",
        });
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Login error during data lookup:", error);
      toast({
        variant: "destructive",
        title: "Login Error",
        description: `An error occurred: ${error instanceof Error ? error.message : "Please check console for details."}`,
      });
      setIsSubmitting(false);
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
                  <Input 
                    placeholder="Enter your 8-digit ITS ID" 
                    {...field} 
                    className="pl-10" 
                    disabled={isSubmitting || requiresPassword}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {requiresPassword && (
           <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                     <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      type="password"
                      placeholder="Enter your password" 
                      {...field} 
                      className="pl-10"
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing In...
            </>
          ) : (
            requiresPassword ? "Verify Password" : "Sign In"
          )}
        </Button>
      </form>
    </Form>
  );
}
