
"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "@/types";
import { getFeatureFlags, updateFeatureFlag } from "@/lib/firebase/settingsService";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { Sparkles, ShieldAlert } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [featureFlags, setFeatureFlags] = useState({ isThemeFeatureNew: true });
  const [isLoadingFlags, setIsLoadingFlags] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
    const navItem = findNavItem('/dashboard/settings'); 
    
    if (navItem && navItem.allowedRoles?.includes(role || 'user')) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }, [router]);

  useEffect(() => {
    if (isAuthorized) {
      setIsLoadingFlags(true);
      getFeatureFlags().then(flags => {
        setFeatureFlags(flags);
        setIsLoadingFlags(false);
      }).catch(() => setIsLoadingFlags(false));
    }
  }, [isAuthorized]);

  const handleFlagChange = async (flagName: keyof typeof featureFlags, value: boolean) => {
    setFeatureFlags(prev => ({ ...prev, [flagName]: value }));
    try {
      await updateFeatureFlag(flagName, value);
      toast({ title: "Setting Updated", description: "The feature flag has been changed." });
    } catch (error) {
      toast({ title: "Update Failed", description: "Could not save the setting.", variant: "destructive" });
      setFeatureFlags(prev => ({ ...prev, [flagName]: !value })); // Revert on error
    }
  };

  if (isAuthorized === null || isLoadingFlags) {
    return <div className="flex h-full w-full items-center justify-center"><FunkyLoader size="lg" /></div>;
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Only Super Admins can access this page.</p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Sparkles className="mr-2 h-6 w-6 text-primary" />Feature Flags</CardTitle>
          <CardDescription className="mt-1">Toggle experimental or new features for all users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="theme-badge-switch" className="text-base">Theme Customization Badge</Label>
              <p className="text-sm text-muted-foreground">Show the "New" badge on the theme/appearance feature.</p>
            </div>
            <Switch
              id="theme-badge-switch"
              checked={featureFlags.isThemeFeatureNew}
              onCheckedChange={(checked) => handleFlagChange('isThemeFeatureNew', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
