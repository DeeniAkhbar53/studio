
"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "@/types";
import { getFeatureFlags, updateFeatureFlag, updateDuaVideoUrl, getDuaVideoUrl, updateSetting, getSettings } from "@/lib/firebase/settingsService";
import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { Sparkles, ShieldAlert, Video, Timer, Palette as PaletteIcon, SlidersHorizontal, BookOpen, FileText as FileTextIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // State for all settings
  const [featureFlags, setFeatureFlags] = useState({ isThemeFeatureNew: true, isDuaPageEnabled: true, isFormsEnabled: true });
  const [duaVideoUrl, setDuaVideoUrl] = useState("");
  const [inactivityTimeout, setInactivityTimeout] = useState(10);
  const [defaultTheme, setDefaultTheme] = useState("blue");

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
      const fetchAllSettings = async () => {
        setIsLoading(true);
        try {
          const [flags, videoUrl, settings] = await Promise.all([
            getFeatureFlags(),
            getDuaVideoUrl(),
            getSettings(),
          ]);
          setFeatureFlags(flags);
          setDuaVideoUrl(videoUrl || "");
          setInactivityTimeout(settings.inactivityTimeout || 10);
          setDefaultTheme(settings.defaultTheme || 'blue');
        } catch (error) {
          toast({ title: "Error", description: "Could not load all settings.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchAllSettings();
    }
  }, [isAuthorized, toast]);

  const handleFlagChange = async (flagName: keyof typeof featureFlags, value: boolean) => {
    const oldFlags = { ...featureFlags };
    setFeatureFlags(prev => ({ ...prev, [flagName]: value }));
    try {
      await updateFeatureFlag(flagName, value);
      toast({ title: "Setting Updated", description: "The feature flag has been changed." });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent('featureFlagsUpdated'));
      }
    } catch (error) {
      toast({ title: "Update Failed", description: "Could not save the setting.", variant: "destructive" });
      setFeatureFlags(oldFlags);
    }
  };

  const handleDuaUrlUpdate = async () => {
    try {
        await updateDuaVideoUrl(duaVideoUrl);
        toast({ title: "Dua Video Updated", description: "The video link has been changed." });
    } catch (error) {
        toast({ title: "Update Failed", description: "Could not save the video link.", variant: "destructive" });
    }
  };

  const handleSettingUpdate = async (settingName: string, value: any) => {
    try {
        await updateSetting(settingName, value);
        toast({ title: "Setting Updated", description: `The ${settingName.replace(/([A-Z])/g, ' $1').toLowerCase()} setting has been saved.` });
    } catch (error) {
        toast({ title: "Update Failed", description: "Could not save the setting.", variant: "destructive" });
    }
  };


  if (isAuthorized === null || isLoading) {
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
          <CardTitle className="flex items-center text-xl"><SlidersHorizontal className="mr-2 h-5 w-5 text-primary" />Application Settings</CardTitle>
          <CardDescription className="mt-1 text-xs">Manage global settings for the entire application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="inactivity-timeout" className="text-sm font-medium">User Inactivity Timeout</Label>
                <div className="flex items-center gap-4">
                    <Select value={inactivityTimeout.toString()} onValueChange={(val) => setInactivityTimeout(Number(val))}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select timeout" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="5">5 Minutes</SelectItem>
                            <SelectItem value="10">10 Minutes</SelectItem>
                            <SelectItem value="15">15 Minutes</SelectItem>
                            <SelectItem value="20">20 Minutes</SelectItem>
                            <SelectItem value="30">30 Minutes</SelectItem>
                            <SelectItem value="60">1 Hour</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={() => handleSettingUpdate('inactivityTimeout', inactivityTimeout)}>Save Timeout</Button>
                </div>
                <p className="text-xs text-muted-foreground">Automatically log out users after a period of inactivity.</p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
                <Label htmlFor="default-theme" className="text-sm font-medium">Default Theme for New Users</Label>
                 <div className="flex items-center gap-4">
                    <Select value={defaultTheme} onValueChange={setDefaultTheme}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select a theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="blue">Blue (Default)</SelectItem>
                            <SelectItem value="purple">Purple</SelectItem>
                            <SelectItem value="gray">Gray</SelectItem>
                        </SelectContent>
                    </Select>
                     <Button onClick={() => handleSettingUpdate('defaultTheme', defaultTheme)}>Save Theme</Button>
                </div>
                 <p className="text-xs text-muted-foreground">Set the initial color theme for all new users upon their first login.</p>
            </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Video className="mr-2 h-5 w-5 text-primary" />Dua Page Management</CardTitle>
          <CardDescription className="mt-1 text-xs">Control the content displayed on the Dua Recitation page.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="space-y-2">
                <Label htmlFor="dua-video-url" className="text-sm font-medium">Dua Video URL / ID</Label>
                <div className="flex items-center gap-4">
                    <Input
                        id="dua-video-url"
                        value={duaVideoUrl}
                        onChange={(e) => setDuaVideoUrl(e.target.value)}
                        placeholder="e.g., LXb3EKWsInQ or full YouTube URL"
                    />
                    <Button onClick={handleDuaUrlUpdate}>Save Video</Button>
                </div>
                 <p className="text-xs text-muted-foreground">Paste the YouTube video ID or full URL.</p>
            </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Sparkles className="mr-2 h-5 w-5 text-primary" />Feature Flags & Modules</CardTitle>
          <CardDescription className="mt-1 text-xs">Toggle experimental or new features for all users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="theme-badge-switch" className="text-sm flex items-center gap-2"><PaletteIcon className="h-4 w-4" />Theme Customization "New" Badge</Label>
              <p className="text-xs text-muted-foreground">Show the "New" badge on the theme/appearance feature.</p>
            </div>
            <Switch
              id="theme-badge-switch"
              checked={featureFlags.isThemeFeatureNew}
              onCheckedChange={(checked) => handleFlagChange('isThemeFeatureNew', checked)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="dua-page-switch" className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" />Enable Dua Page Module</Label>
              <p className="text-xs text-muted-foreground">Show the Dua Recitation page in the sidebar for eligible users.</p>
            </div>
            <Switch
              id="dua-page-switch"
              checked={featureFlags.isDuaPageEnabled}
              onCheckedChange={(checked) => handleFlagChange('isDuaPageEnabled', checked)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="forms-switch" className="text-sm flex items-center gap-2"><FileTextIcon className="h-4 w-4" />Enable Forms / Surveys Module</Label>
              <p className="text-xs text-muted-foreground">Show the Forms & Surveys page in the sidebar for all users.</p>
            </div>
            <Switch
              id="forms-switch"
              checked={featureFlags.isFormsEnabled}
              onCheckedChange={(checked) => handleFlagChange('isFormsEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
