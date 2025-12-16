
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
import {
    updateFeatureFlag,
    updateDuaVideoUrl,
    updateSetting,
} from "@/lib/firebase/settingsService";
import { db } from "@/lib/firebase/firebase";
import { doc, onSnapshot, Unsubscribe } from "firebase/firestore";

import { findNavItem } from "@/components/dashboard/sidebar-nav";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { Sparkles, ShieldAlert, Video, Palette as PaletteIcon, SlidersHorizontal, BookOpen, FileText as FileTextIcon, ScanLine } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function SettingsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // State for all settings
  const [featureFlags, setFeatureFlags] = useState({ isThemeFeatureNew: true, isDuaPageEnabled: true, isFormsEnabled: true, isBarcodeScanningEnabled: true });
  const [duaVideoUrl, setDuaVideoUrl] = useState("");
  const [inactivityTimeout, setInactivityTimeout] = useState(10);
  const [defaultTheme, setDefaultTheme] = useState("blue");

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') as UserRole : null;
    const pageRights = JSON.parse(localStorage.getItem('userPageRights') || '[]');
    const navItem = findNavItem('/dashboard/settings');
    
    if (navItem) {
        const hasRoleAccess = navItem.allowedRoles?.includes(role || 'user');
        const hasPageRight = pageRights.includes(navItem.href);
        if (hasRoleAccess || hasPageRight) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            setTimeout(() => router.replace('/dashboard'), 2000);
        }
    } else {
        setIsAuthorized(false);
        setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }, [router]);

  useEffect(() => {
    if (isAuthorized) {
        setIsLoading(true);
        const unsubscribes: Unsubscribe[] = [];

        const settingsCollectionRef = 'app_settings';
        const featureFlagsDocRef = doc(db, settingsCollectionRef, 'featureFlags');
        const duaPageSettingsDocRef = doc(db, settingsCollectionRef, 'duaPage');
        const appConfigDocRef = doc(db, settingsCollectionRef, 'appConfig');
        
        unsubscribes.push(onSnapshot(featureFlagsDocRef, (docSnap) => {
            const defaultFlags = { isThemeFeatureNew: true, isDuaPageEnabled: true, isFormsEnabled: true, isBarcodeScanningEnabled: true };
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFeatureFlags({
                    isThemeFeatureNew: data.isThemeFeatureNew ?? defaultFlags.isThemeFeatureNew,
                    isDuaPageEnabled: data.isDuaPageEnabled ?? defaultFlags.isDuaPageEnabled,
                    isFormsEnabled: data.isFormsEnabled ?? defaultFlags.isFormsEnabled,
                    isBarcodeScanningEnabled: data.isBarcodeScanningEnabled ?? defaultFlags.isBarcodeScanningEnabled,
                });
            } else {
                setFeatureFlags(defaultFlags);
            }
        }));

        unsubscribes.push(onSnapshot(duaPageSettingsDocRef, (docSnap) => {
             setDuaVideoUrl(docSnap.exists() ? docSnap.data().videoUrl || "" : "");
        }));

        unsubscribes.push(onSnapshot(appConfigDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setInactivityTimeout(data.inactivityTimeout || 10);
                setDefaultTheme(data.defaultTheme || 'blue');
            } else {
                setInactivityTimeout(10);
                setDefaultTheme('blue');
            }
        }));

        // Assume loading is done after initial listeners are set up
        setTimeout(() => setIsLoading(false), 1000); 

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }
  }, [isAuthorized]);

  const handleFlagChange = async (flagName: keyof typeof featureFlags, value: boolean) => {
    try {
      await updateFeatureFlag(flagName, value);
      toast({ title: "Setting Updated", description: "The feature flag has been changed." });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent('featureFlagsUpdated'));
      }
    } catch (error) {
      toast({ title: "Update Failed", description: "Could not save the setting.", variant: "destructive" });
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
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full space-y-6">
            <Card className="shadow-lg">
                <AccordionItem value="item-1" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <CardHeader className="flex-grow">
                        <CardTitle className="flex items-center text-base"><SlidersHorizontal className="mr-2 h-4 w-4 text-primary" />Application Settings</CardTitle>
                        <CardDescription className="text-xs text-left">Manage global settings for the entire application.</CardDescription>
                        </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                        <div className="space-y-6 pt-2">
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
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
            
            <Card className="shadow-lg">
                 <AccordionItem value="item-2" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <CardHeader className="flex-grow">
                            <CardTitle className="flex items-center text-base"><Video className="mr-2 h-4 w-4 text-primary" />Dua Page Management</CardTitle>
                            <CardDescription className="mt-1 text-xs text-left">Control the content displayed on the Dua Recitation page.</CardDescription>
                        </CardHeader>
                    </AccordionTrigger>
                     <AccordionContent className="px-6 pb-6">
                        <div className="space-y-2 pt-2">
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
                    </AccordionContent>
                </AccordionItem>
            </Card>

            <Card className="shadow-lg">
                 <AccordionItem value="item-3" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <CardHeader className="flex-grow">
                        <CardTitle className="flex items-center text-base"><Sparkles className="mr-2 h-4 w-4 text-primary" />Feature Flags & Modules</CardTitle>
                        <CardDescription className="mt-1 text-xs text-left">Toggle experimental or new features for all users.</CardDescription>
                        </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 pt-2">
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
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                <Label htmlFor="scanner-switch" className="text-sm flex items-center gap-2"><ScanLine className="h-4 w-4" />Enable Barcode/QR Scanner</Label>
                                <p className="text-xs text-muted-foreground">Show the QR code scanner button on the dashboard for all users.</p>
                                </div>
                                <Switch
                                id="scanner-switch"
                                checked={featureFlags.isBarcodeScanningEnabled}
                                onCheckedChange={(checked) => handleFlagChange('isBarcodeScanningEnabled', checked)}
                                />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
      </Accordion>
    </div>
  );
}
