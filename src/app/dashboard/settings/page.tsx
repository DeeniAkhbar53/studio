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
import { 
  Sparkles, 
  ShieldAlert, 
  Video, 
  Palette as PaletteIcon, 
  SlidersHorizontal, 
  BookOpen, 
  FileText as FileTextIcon, 
  ScanLine, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  ChevronRight, 
  HelpCircle,
  Clock,
  Calendar,
  Layers,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "general" | "dua" | "flags" | "sheets";

export default function SettingsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("general");

  // State for all settings
  const [featureFlags, setFeatureFlags] = useState({ 
    isThemeFeatureNew: true, 
    isDuaPageEnabled: true, 
    isFormsEnabled: true, 
    isBarcodeScanningEnabled: true 
  });
  const [duaVideoUrl, setDuaVideoUrl] = useState("");
  const [inactivityTimeout, setInactivityTimeout] = useState(10);
  const [defaultTheme, setDefaultTheme] = useState("blue");
  const [googleSheetsAppsScriptUrl, setGoogleSheetsAppsScriptUrl] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeYear, setActiveYear] = useState("1448H");
  const [availableYears, setAvailableYears] = useState<string[]>(["1447H", "1448H"]);
  const [newYearInput, setNewYearInput] = useState("");

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
                setGoogleSheetsAppsScriptUrl(data.googleSheetsAppsScriptUrl || "");
                setActiveYear(data.activeYear || "1448H");
                setAvailableYears(data.availableYears || ["1447H", "1448H"]);
            } else {
                setInactivityTimeout(10);
                setDefaultTheme('blue');
                setGoogleSheetsAppsScriptUrl("");
                setActiveYear("1448H");
                setAvailableYears(["1447H", "1448H"]);
            }
        }));

        setTimeout(() => setIsLoading(false), 800); 

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
        
        if (settingName === 'defaultTheme') {
            if (typeof window !== 'undefined') {
                localStorage.setItem("colorTheme", value);
                localStorage.removeItem("colorThemeCustom");
                const allThemeClasses = ['theme-blue', 'theme-purple', 'theme-indigo', 'theme-teal', 'theme-emerald', 'theme-rose', 'theme-amber', 'theme-gray'];
                document.body.classList.remove(...allThemeClasses);
                if (value !== "blue") {
                    document.body.classList.add(`theme-${value}`);
                }
                window.dispatchEvent(new CustomEvent('colorThemeUpdated', { detail: value }));
            }
        }
    } catch (error) {
        toast({ title: "Update Failed", description: "Could not save the setting.", variant: "destructive" });
    }
  };

  const handleActiveYearUpdate = async () => {
    if (!activeYear || activeYear.trim() === "") {
        toast({ title: "Invalid Input", description: "Active year cannot be empty.", variant: "destructive" });
        return;
    }
    try {
        await updateSetting('activeYear', activeYear.trim());
        document.cookie = `active_year=${activeYear.trim()}; path=/; max-age=31536000; SameSite=Lax`;
        toast({ title: "Active Year Updated", description: `The active year has been changed to ${activeYear}. Reloading page...` });
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        toast({ title: "Update Failed", description: "Could not save the active year.", variant: "destructive" });
    }
  };

  const handleAddYear = async () => {
    const trimmed = newYearInput.trim();
    if (!trimmed) {
        toast({ title: "Invalid Input", description: "Year name cannot be empty.", variant: "destructive" });
        return;
    }
    if (availableYears.includes(trimmed)) {
        toast({ title: "Duplicate Year", description: "This year already exists.", variant: "destructive" });
        return;
    }
    try {
        const updatedYears = [...availableYears, trimmed];
        await updateSetting('availableYears', updatedYears);
        toast({ title: "Year Added", description: `Year ${trimmed} was successfully added.` });
        setNewYearInput("");
    } catch (error) {
        toast({ title: "Update Failed", description: "Could not add the year.", variant: "destructive" });
    }
  };

  if (isAuthorized === null || isLoading) {
    return <div className="flex h-full w-full items-center justify-center"><FunkyLoader size="lg">Loading Preferences...</FunkyLoader></div>;
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

  const menuItems = [
    { id: "general", label: "General Config", icon: SlidersHorizontal, desc: "System timeout, defaults, Hijri years" },
    { id: "dua", label: "Dua Recitation", icon: Video, desc: "YouTube video configuration" },
    { id: "flags", label: "Feature Flags", icon: Sparkles, desc: "Toggle app modules & toggles" },
    { id: "sheets", label: "Sheets Integration", icon: FileSpreadsheet, desc: "Sync responses to Google Sheets" }
  ] as const;

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-3.5">
          <Settings className="h-8 w-8 text-primary animate-[spin_10s_linear_infinite]" />
          System Preferences
        </h1>
        <p className="text-sm text-muted-foreground">Configure system timeouts, active Hijri year data collections, video assets, and spreadsheet webhooks.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Sidebar Tabs */}
        <nav className="md:col-span-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b md:border-b-0 border-border/40">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center text-left gap-3.5 px-4 py-3.5 rounded-xl border text-sm transition-all duration-300 shrink-0 select-none md:w-full",
                  isActive
                    ? "bg-primary/5 text-primary border-primary/20 shadow-[0_2px_10px_rgba(var(--primary),0.03)] font-semibold"
                    : "bg-card/40 hover:bg-card/80 text-muted-foreground border-transparent hover:border-border/30"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg transition-colors duration-300",
                  isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className={cn(isActive ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                  <span className="text-[10px] text-muted-foreground/75 font-normal line-clamp-1">{item.desc}</span>
                </div>
                {isActive && <ChevronRight className="hidden md:block ml-auto h-4 w-4 text-primary animate-[translateX_0.2s_ease-out]" />}
              </button>
            );
          })}
        </nav>

        {/* Tab Content Panel */}
        <div className="md:col-span-8 space-y-6">
          
          {/* GENERAL CONFIG */}
          {activeTab === "general" && (
            <Card className="border-border/60 shadow-lg bg-card/40 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/20">
                <CardTitle className="text-lg flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" />General Configurations</CardTitle>
                <CardDescription className="text-xs">Adjust inactivity timeout thresholds, global color schemas, and calendar years.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {/* Timeout */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="inactivity-timeout" className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Inactivity Lockout
                    </Label>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Automatic</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={inactivityTimeout.toString()} onValueChange={(val) => setInactivityTimeout(Number(val))}>
                      <SelectTrigger className="w-full sm:w-[200px] bg-background">
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
                    <Button onClick={() => handleSettingUpdate('inactivityTimeout', inactivityTimeout)} className="w-full sm:w-auto">Update Timeout</Button>
                  </div>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">Automatically logs out dashboard users if no clicks or keyboard activities are detected within this duration.</p>
                </div>

                <div className="border-t border-border/20" />

                {/* Default Theme */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="default-theme" className="text-sm font-semibold flex items-center gap-2">
                      <PaletteIcon className="h-4 w-4 text-primary" />
                      Default Registration Theme
                    </Label>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={defaultTheme} onValueChange={setDefaultTheme}>
                      <SelectTrigger className="w-full sm:w-[200px] bg-background">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blue">Blue (Default)</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                        <SelectItem value="indigo">Indigo</SelectItem>
                        <SelectItem value="teal">Teal</SelectItem>
                        <SelectItem value="emerald">Emerald</SelectItem>
                        <SelectItem value="rose">Rose</SelectItem>
                        <SelectItem value="amber">Amber</SelectItem>
                        <SelectItem value="gray">Slate (Gray)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => handleSettingUpdate('defaultTheme', defaultTheme)} className="w-full sm:w-auto">Save Theme</Button>
                  </div>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">Specifies the appearance color palette dynamically assigned to new profiles upon their registration.</p>
                </div>

                <div className="border-t border-border/20" />

                {/* Hijri Year */}
                <div className="space-y-4">
                  <Label htmlFor="active-year" className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Active Hijri Year Space
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={activeYear} onValueChange={setActiveYear}>
                      <SelectTrigger className="w-full sm:w-[200px] bg-background">
                        <SelectValue placeholder="Select active year" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map(year => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleActiveYearUpdate} className="w-full sm:w-auto">Change Year Space</Button>
                  </div>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    Updates the database namespace. Toggling this scopes all Miqaat records, logs, attendance charts, and forms to the chosen Hijri year. Global entities (Mohallahs, members) are shared across years.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3">
                    <Input 
                      placeholder="Add year (e.g. 1449H)" 
                      value={newYearInput} 
                      onChange={(e) => setNewYearInput(e.target.value)}
                      className="w-full sm:w-[200px] bg-background font-mono text-xs"
                    />
                    <Button variant="outline" onClick={handleAddYear} className="w-full sm:w-auto bg-background hover:bg-muted">Add New Hijri Year</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DUA PAGE MANAGEMENT */}
          {activeTab === "dua" && (
            <Card className="border-border/60 shadow-lg bg-card/40 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/20">
                <CardTitle className="text-lg flex items-center gap-2"><Video className="h-5 w-5 text-primary" />Dua Recitation Video</CardTitle>
                <CardDescription className="text-xs">Update the YouTube streaming asset loaded inside the Dua player.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="dua-video-url" className="text-sm font-semibold flex items-center gap-2">
                    YouTube Stream Asset
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="dua-video-url"
                      value={duaVideoUrl}
                      onChange={(e) => setDuaVideoUrl(e.target.value)}
                      placeholder="e.g., LXb3EKWsInQ or full YouTube URL"
                      className="flex-1 bg-background font-mono text-xs"
                    />
                    <Button onClick={handleDuaUrlUpdate} className="w-full sm:w-auto">Update Video</Button>
                  </div>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    Paste the 11-character YouTube video identifier (e.g., <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">LXb3EKWsInQ</code>) or the full watch URL. The player will automatically extract the ID and update it.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FEATURE FLAGS */}
          {activeTab === "flags" && (
            <Card className="border-border/60 shadow-lg bg-card/40 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/20">
                <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Modules & Flags</CardTitle>
                <CardDescription className="text-xs">Turn experimental layout modules or specific feature badges on/off globally.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {/* Theme Flag */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-4 transition-all duration-200 hover:border-border">
                    <div className="space-y-1 pr-4">
                      <Label htmlFor="theme-badge-switch" className="text-sm font-semibold flex items-center gap-2">
                        <PaletteIcon className="h-4.5 w-4.5 text-primary" />
                        Appearance "New" Badge
                      </Label>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">Displays a "New" badge next to the appearance customization links to draw attention.</p>
                    </div>
                    <Switch
                      id="theme-badge-switch"
                      checked={featureFlags.isThemeFeatureNew}
                      onCheckedChange={(checked) => handleFlagChange('isThemeFeatureNew', checked)}
                    />
                  </div>

                  {/* Dua Page Flag */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-4 transition-all duration-200 hover:border-border">
                    <div className="space-y-1 pr-4">
                      <Label htmlFor="dua-page-switch" className="text-sm font-semibold flex items-center gap-2">
                        <BookOpen className="h-4.5 w-4.5 text-primary" />
                        Enable Dua Recitation
                      </Label>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">Adds the Dua audio/video player page to the sidebar navigation for allowed members.</p>
                    </div>
                    <Switch
                      id="dua-page-switch"
                      checked={featureFlags.isDuaPageEnabled}
                      onCheckedChange={(checked) => handleFlagChange('isDuaPageEnabled', checked)}
                    />
                  </div>

                  {/* Forms Flag */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-4 transition-all duration-200 hover:border-border">
                    <div className="space-y-1 pr-4">
                      <Label htmlFor="forms-switch" className="text-sm font-semibold flex items-center gap-2">
                        <FileTextIcon className="h-4.5 w-4.5 text-primary" />
                        Enable Forms & Surveys
                      </Label>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">Activates public or internal questionnaire forms in the primary sidebar navigation.</p>
                    </div>
                    <Switch
                      id="forms-switch"
                      checked={featureFlags.isFormsEnabled}
                      onCheckedChange={(checked) => handleFlagChange('isFormsEnabled', checked)}
                    />
                  </div>

                  {/* QR Scanner Flag */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-4 transition-all duration-200 hover:border-border">
                    <div className="space-y-1 pr-4">
                      <Label htmlFor="scanner-switch" className="text-sm font-semibold flex items-center gap-2">
                        <ScanLine className="h-4.5 w-4.5 text-primary" />
                        Enable QR/Barcode Scanning
                      </Label>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">Shows the camera scanning utility widget directly in the main attendance check-in.</p>
                    </div>
                    <Switch
                      id="scanner-switch"
                      checked={featureFlags.isBarcodeScanningEnabled}
                      onCheckedChange={(checked) => handleFlagChange('isBarcodeScanningEnabled', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* GOOGLE SHEETS WEBHOOK */}
          {activeTab === "sheets" && (
            <Card className="border-border/60 shadow-lg bg-card/40 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/20">
                <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Google Sheets Integration</CardTitle>
                <CardDescription className="text-xs">Configure the Apps Script webhook endpoint to push data reports directly to spreadsheets.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="sheets-webhook-url" className="text-sm font-semibold">
                    Apps Script Web App Endpoint URL
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="sheets-webhook-url"
                      value={googleSheetsAppsScriptUrl}
                      onChange={(e) => setGoogleSheetsAppsScriptUrl(e.target.value)}
                      placeholder="e.g., https://script.google.com/macros/s/.../exec"
                      className="flex-1 bg-background font-mono text-xs"
                    />
                    <Button onClick={() => handleSettingUpdate('googleSheetsAppsScriptUrl', googleSheetsAppsScriptUrl)} className="w-full sm:w-auto">Update URL</Button>
                  </div>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    Form submissions and reports will trigger POST requests to this URL to write directly to your designated spreadsheet ID.
                  </p>
                </div>

                <div className="border-t border-border/20" />

                {/* Setup Instructions */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <HelpCircle className="h-4.5 w-4.5 text-primary" />
                    How to Set Up Apps Script Webhook
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground/90 bg-background/30 rounded-xl p-4 border border-border/40">
                    <div className="space-y-2.5">
                      <div className="flex gap-2.5 items-start">
                        <span className="font-bold text-primary bg-primary/10 rounded-full h-5 w-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                        <span>Open a new or existing Google Sheet.</span>
                      </div>
                      <div className="flex gap-2.5 items-start">
                        <span className="font-bold text-primary bg-primary/10 rounded-full h-5 w-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                        <span>Navigate to <strong>Extensions &gt; Apps Script</strong>.</span>
                      </div>
                      <div className="flex gap-2.5 items-start">
                        <span className="font-bold text-primary bg-primary/10 rounded-full h-5 w-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                        <span>Replace default script with the block code on the right.</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2.5">
                      <div className="flex gap-2.5 items-start">
                        <span className="font-bold text-primary bg-primary/10 rounded-full h-5 w-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">4</span>
                        <span>Deploy as a **Web App** (Deploy &gt; New deployment).</span>
                      </div>
                      <div className="flex gap-2.5 items-start">
                        <span className="font-bold text-primary bg-primary/10 rounded-full h-5 w-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">5</span>
                        <span>Execute as: <strong>"Me"</strong>, Access: <strong>"Anyone"</strong>.</span>
                      </div>
                      <div className="flex gap-2.5 items-start">
                        <span className="font-bold text-primary bg-primary/10 rounded-full h-5 w-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">6</span>
                        <span>Paste the generated Web App URL above and click Update.</span>
                      </div>
                    </div>
                  </div>

                  {/* Code Snippet Container */}
                  <div className="relative mt-2 rounded-xl border border-border/60 bg-zinc-950 p-4 font-mono text-[10px] leading-relaxed max-h-56 overflow-y-auto shadow-inner text-zinc-300">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-3 h-8 w-8 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                      onClick={() => {
                        const code = `function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetId = data.sheetId;
    const sheetName = data.sheetName || "Sheet1";
    const rows = data.rows;

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (data.action === "replace") {
      sheet.clearContents();
      if (rows && rows.length > 0) {
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      }
    } else {
      if (rows && rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
          sheet.appendRow(rows[i]);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
                        navigator.clipboard.writeText(code);
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 2000);
                        toast({ title: "Copied", description: "Apps Script template copied to clipboard." });
                      }}
                    >
                      {copiedScript ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <pre className="text-left overflow-x-auto whitespace-pre font-mono text-zinc-300 pr-10">{`function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetId = data.sheetId;
    const sheetName = data.sheetName || "Sheet1";
    const rows = data.rows;

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (data.action === "replace") {
      sheet.clearContents();
      if (rows && rows.length > 0) {
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      }
    } else {
      if (rows && rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
          sheet.appendRow(rows[i]);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
