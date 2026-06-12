
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
import { Sparkles, ShieldAlert, Video, Palette as PaletteIcon, SlidersHorizontal, BookOpen, FileText as FileTextIcon, ScanLine, FileSpreadsheet, Copy, Check, Database as DatabaseIcon, Loader2 } from "lucide-react";
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
  const [googleSheetsAppsScriptUrl, setGoogleSheetsAppsScriptUrl] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeYear, setActiveYear] = useState("1448H");
  const [isMigrating, setIsMigrating] = useState(false);
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

  const handleMigration = async () => {
     if (!confirm("Are you sure you want to copy all root database collections into the 1447H year subcollection? This should only be done once.")) {
         return;
     }
     setIsMigrating(true);
     try {
         const { transfer1447HData } = await import("@/lib/firebase/migrationService");
         const result = await transfer1447HData();
         if (result.success) {
             toast({ title: "Migration Complete", description: result.message });
         } else {
             toast({ title: "Migration Failed", description: result.message, variant: "destructive" });
         }
     } catch (error: any) {
         toast({ title: "Migration Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
     } finally {
         setIsMigrating(false);
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
                                            <SelectItem value="indigo">Indigo</SelectItem>
                                            <SelectItem value="teal">Teal</SelectItem>
                                            <SelectItem value="emerald">Emerald</SelectItem>
                                            <SelectItem value="rose">Rose</SelectItem>
                                            <SelectItem value="amber">Amber</SelectItem>
                                            <SelectItem value="gray">Slate (Gray)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={() => handleSettingUpdate('defaultTheme', defaultTheme)}>Save Theme</Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Set the initial color theme for all new users upon their first login.</p>
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-2">
                                <Label htmlFor="active-year" className="text-sm font-medium">Active Hijri Year</Label>
                                <div className="flex items-center gap-4">
                                    <Select value={activeYear} onValueChange={setActiveYear}>
                                        <SelectTrigger className="w-[180px] bg-background">
                                            <SelectValue placeholder="Select year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableYears.map(year => (
                                                <SelectItem key={year} value={year}>{year}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleActiveYearUpdate}>Save Active Year</Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Change the active year of the application. This segments operational data (Miqaats, Attendance, Forms, Logs, Notifications) by year. Global data like Mohallahs and Users remains shared.</p>
                                
                                <div className="flex items-center gap-2 pt-4">
                                    <Input 
                                        placeholder="Add new year (e.g. 1449H)" 
                                        value={newYearInput} 
                                        onChange={(e) => setNewYearInput(e.target.value)}
                                        className="w-[180px] bg-background"
                                    />
                                    <Button variant="outline" onClick={handleAddYear}>Add New Year</Button>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">Create a new Hijri year dynamically to start fresh database collections for it.</p>
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

            <Card className="shadow-lg">
                <AccordionItem value="item-4" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <CardHeader className="flex-grow">
                            <CardTitle className="flex items-center text-base">
                                <FileSpreadsheet className="mr-2 h-4 w-4 text-primary" />
                                Google Sheets Sync Settings
                            </CardTitle>
                            <CardDescription className="mt-1 text-xs text-left">
                                Configure the webhook to automatically sync forms responses & reports to Google Sheets.
                            </CardDescription>
                        </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                        <div className="space-y-6 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="sheets-webhook-url" className="text-sm font-medium">Google Apps Script Web App URL</Label>
                                <div className="flex items-center gap-4">
                                    <Input
                                        id="sheets-webhook-url"
                                        value={googleSheetsAppsScriptUrl}
                                        onChange={(e) => setGoogleSheetsAppsScriptUrl(e.target.value)}
                                        placeholder="e.g., https://script.google.com/macros/s/.../exec"
                                        className="font-mono text-xs"
                                    />
                                    <Button onClick={() => handleSettingUpdate('googleSheetsAppsScriptUrl', googleSheetsAppsScriptUrl)}>Save URL</Button>
                                </div>
                                <p className="text-xs text-muted-foreground">The Apps Script URL deployed from your Google account that has edit access to your spreadsheets.</p>
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold">How to setup your Google Apps Script:</h4>
                                <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1.5 pl-1">
                                    <li>Create a new spreadsheet on Google Sheets, or open an existing one.</li>
                                    <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
                                    <li>Delete any default code, and paste the code block below.</li>
                                    <li>Click the <strong>Deploy</strong> button in the top right, and choose <strong>New deployment</strong>.</li>
                                    <li>Click the gear icon next to "Select type" and choose <strong>Web app</strong>.</li>
                                    <li>Set Description as "Sheets Sync", Execute as: <strong>"Me"</strong> (your email), and Who has access: <strong>"Anyone"</strong>.</li>
                                    <li>Click <strong>Deploy</strong>, grant authorizations if prompted, and copy the <strong>Web app URL</strong>.</li>
                                    <li>Paste it in the input field above and click Save.</li>
                                </ol>

                                <div className="relative mt-2 rounded-lg border bg-muted/40 p-4 font-mono text-[10px] leading-relaxed max-h-60 overflow-y-auto">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="absolute right-3 top-3 h-7 w-7"
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
                                        }}
                                    >
                                        {copiedScript ? <Check className="h-4.5 w-4.5 text-green-500" /> : <Copy className="h-4.5 w-4.5" />}
                                    </Button>
                                    <pre className="text-left text-foreground overflow-x-auto whitespace-pre-wrap">{`function doPost(e) {
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
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>

            <Card className="shadow-lg border-yellow-500/20 bg-yellow-500/5">
                <AccordionItem value="item-5" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <CardHeader className="flex-grow">
                            <CardTitle className="flex items-center text-yellow-600 dark:text-yellow-400 text-base">
                                <DatabaseIcon className="mr-2 h-4 w-4" />
                                Database Migration & Maintenance
                            </CardTitle>
                            <CardDescription className="mt-1 text-xs text-left">
                                Run database migration utilities to align your data structure year-by-year.
                            </CardDescription>
                        </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 pt-2">
                            <div className="rounded-lg border border-yellow-500/30 p-4 space-y-3 bg-card">
                                <h4 className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">Transfer 1447H Last Year Data</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Copies your legacy root collections (Miqaats, Forms, Responses, Logs, Notifications, and User attendance histories) into the 1447H database space. This ensures you can access all historic reports when selecting 1447H.
                                </p>
                                <Button 
                                    onClick={handleMigration} 
                                    disabled={isMigrating}
                                    className="bg-yellow-600 text-white hover:bg-yellow-700"
                                >
                                    {isMigrating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Migrating Data...
                                        </>
                                    ) : (
                                        "Transfer 1447H Data"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
      </Accordion>
    </div>
  );
}
