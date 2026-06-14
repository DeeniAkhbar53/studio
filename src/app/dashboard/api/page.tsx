"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Key, 
  PlusCircle, 
  Copy, 
  Check, 
  Trash2, 
  Loader2, 
  ShieldAlert, 
  Search, 
  Power, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Play,
  Code2
} from "lucide-react";
import { 
  getApiKeys, 
  createApiKey, 
  toggleApiKeyStatus, 
  deleteApiKey, 
  ApiKey 
} from "@/lib/firebase/apiKeyService";
import { UserRole } from "@/types";
import { format } from "date-fns";
import { FunkyLoader } from "@/components/ui/funky-loader";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const ITEMS_PER_PAGE = 8;

export default function ApiManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Auth state
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  
  // API key list state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Create dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Display generated key dialog
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // API testing state
  const [testApiKey, setTestApiKey] = useState("");
  const [testResponse, setTestResponse] = useState<any | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeCodeLanguage, setActiveCodeLanguage] = useState<'curl' | 'js' | 'python' | 'dart'>('curl');
  const [origin, setOrigin] = useState("http://localhost:9002");

  // Load window origin
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Pre-fill test key when keys are loaded
  useEffect(() => {
    if (apiKeys.length > 0 && !testApiKey) {
      const activeKey = apiKeys.find(k => k.status === 'active');
      if (activeKey) {
        setTestApiKey(activeKey.key);
      }
    }
  }, [apiKeys, testApiKey]);

  // Execute test request
  const handleTestRequest = async () => {
    if (!testApiKey.trim()) {
      toast({
        title: "Test Error",
        description: "Please enter or select an API key to test.",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    setTestResponse(null);
    setTestStatus(null);

    try {
      const res = await fetch("/api/external/v1/data", {
        method: "GET",
        headers: {
          "x-api-key": testApiKey.trim()
        }
      });
      
      const status = res.status;
      setTestStatus(status);
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        data = { error: "Failed to parse JSON response from server." };
      }
      
      setTestResponse(data);
      if (res.ok) {
        toast({
          title: "API Request Successful",
          description: `HTTP ${status}: Retrieved ${data.data?.miqaats?.length || 0} miqaats.`
        });
      } else {
        toast({
          title: "API Request Failed",
          description: `HTTP ${status}: ${data.error || "Request failed."}`,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      setTestStatus(500);
      setTestResponse({ error: "Network request failed.", message: err.message || err });
      toast({
        title: "Network Error",
        description: "Failed to connect to the API server.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 1. Check role authorization (Only superadmin)
  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') as UserRole : null;
    if (role === 'superadmin') {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }, [router]);

  // 2. Fetch API Keys in real-time if authorized
  useEffect(() => {
    if (isAuthorized !== true) return;

    setIsLoading(true);
    const unsubscribe = getApiKeys((keys) => {
      setApiKeys(keys);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthorized]);

  // Handle Generate Key
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both Client Name and Email.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const newKey = await createApiKey(clientName.trim(), clientEmail.trim());
      setGeneratedKey(newKey);
      setIsCreateOpen(false);
      setClientName("");
      setClientEmail("");
      toast({
        title: "API Key Created",
        description: "The developer API key has been generated successfully."
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Generation Failed",
        description: "Failed to generate developer API key.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle status toggle
  const handleToggleStatus = async (keyItem: ApiKey) => {
    try {
      await toggleApiKeyStatus(keyItem.id, keyItem.status);
      toast({
        title: "Status Updated",
        description: `API Key for ${keyItem.clientName} is now ${keyItem.status === 'active' ? 'suspended' : 'active'}.`
      });
    } catch (err) {
      toast({
        title: "Update Failed",
        description: "Failed to update API key status.",
        variant: "destructive"
      });
    }
  };

  // Handle Delete/Revoke
  const handleDeleteKey = async (keyId: string, clientName: string) => {
    try {
      await deleteApiKey(keyId);
      toast({
        title: "API Key Revoked",
        description: `Successfully deleted API Key for ${clientName}.`
      });
    } catch (err) {
      toast({
        title: "Revocation Failed",
        description: "Failed to delete API key.",
        variant: "destructive"
      });
    }
  };

  // Clipboard copy helper
  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    toast({
      title: "Copied to Clipboard",
      description: "API key copied successfully."
    });
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  // Masking function for API keys
  const maskKey = (keyString: string) => {
    if (keyString.length < 15) return keyString;
    return `${keyString.substring(0, 9)}••••••••••••••••${keyString.substring(keyString.length - 4)}`;
  };

  // Filters and Pagination
  const filteredKeys = apiKeys.filter(k => 
    k.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredKeys.length / ITEMS_PER_PAGE);
  const currentKeys = filteredKeys.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Auth Guard Screen
  if (isAuthorized === null) {
    return <FunkyLoader />;
  }

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <ShieldAlert className="h-16 w-16 text-destructive animate-bounce" />
        <h1 className="text-2xl font-black text-foreground">Access Denied</h1>
        <p className="text-muted-foreground max-w-md">
          This page is restricted to <strong>Super Administrator</strong> accounts only. You are being redirected back to your dashboard...
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-4" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Key className="h-8 w-8 text-primary" /> API Key Management
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Generate and manage access tokens for third-party developer integrations.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-2xl gap-2 font-bold shadow-lg shadow-primary/10">
          <PlusCircle className="h-4 w-4" /> Generate API Key
        </Button>
      </div>

      {/* API Endpoint Documentation Hint Card */}
      <Card className="border border-border/80 bg-muted/10 rounded-3xl overflow-hidden shadow-sm">
        <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <span>Developer API Endpoint</span>
              <Badge variant="outline" className="text-[10px] font-mono font-bold tracking-wider">GET</Badge>
            </h3>
            <p className="text-xs text-muted-foreground font-mono bg-muted/80 p-2.5 rounded-xl border select-all w-fit">
              /api/external/v1/data
            </p>
            <p className="text-xs text-muted-foreground font-medium pt-1">
              Include the API key in the header as: <code className="text-foreground font-bold">x-api-key: your_api_key</code>
            </p>
          </div>
          <a 
            href="/api/external/v1/data" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline font-bold flex items-center gap-1.5 border border-primary/20 bg-primary/5 hover:bg-primary/10 px-4 py-2.5 rounded-2xl transition-all"
          >
            Test Endpoint <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      {/* Main Keys List */}
      <Card className="rounded-3xl border border-border/70 bg-card shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-black text-foreground">Active Client Access Keys</CardTitle>
              <CardDescription className="text-xs">
                Monitor usage stats and activate or revoke key authorization states in real-time.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, or key..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 rounded-xl text-xs h-9"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-semibold">Loading access keys...</p>
            </div>
          ) : filteredKeys.length === 0 ? (
            <div className="text-center py-20 space-y-2">
              <p className="text-sm text-muted-foreground font-bold">No API keys found.</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto font-medium">
                {searchQuery ? "Try refining your search queries or clearing filters." : "Create your first API key by clicking 'Generate API Key' above."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop view: Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Contact Email</TableHead>
                      <TableHead>API Key Token</TableHead>
                      <TableHead className="text-center">Usage Requests</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentKeys.map((keyItem) => (
                      <TableRow key={keyItem.id} className="hover:bg-muted/10">
                        <TableCell className="font-bold text-foreground">{keyItem.clientName}</TableCell>
                        <TableCell className="font-medium text-muted-foreground">{keyItem.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-foreground bg-muted/30 px-2 py-1 rounded-md border border-border/20">
                              {maskKey(keyItem.key)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyToClipboard(keyItem.key, keyItem.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
                            >
                              {copiedKeyId === keyItem.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold text-foreground">
                          {keyItem.requestCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={keyItem.status === 'active' ? 'default' : 'destructive'}
                            className="text-[10px] font-bold rounded-full px-2 py-0.5"
                          >
                            {keyItem.status === 'active' ? 'Active' : 'Suspended'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {keyItem.createdAt?.seconds 
                            ? format(new Date(keyItem.createdAt.seconds * 1000), "PPp")
                            : "Just Now"}
                        </TableCell>
                        <TableCell className="text-right space-x-1.5">
                          {/* Toggle Status Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(keyItem)}
                            className="h-8 rounded-xl text-xs gap-1.5 hover:bg-muted/40 font-bold"
                          >
                            <Power className="h-3 w-3" />
                            {keyItem.status === 'active' ? 'Suspend' : 'Activate'}
                          </Button>

                          {/* Revoke API Key AlertDialog */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 rounded-xl text-xs font-bold"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to permanently revoke this access key for <strong className="text-foreground">{keyItem.clientName}</strong>? 
                                  Any application using this token will lose access to the database API immediately. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteKey(keyItem.id, keyItem.clientName)}
                                  className="bg-destructive hover:bg-destructive/90 rounded-xl text-xs font-bold"
                                >
                                  Revoke Key
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View: Stacked Card list */}
              <div className="md:hidden p-4 space-y-4">
                {currentKeys.map((keyItem) => (
                  <div key={keyItem.id} className="p-4 border rounded-2xl bg-muted/5 space-y-3 shadow-sm border-border/60">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-foreground text-sm">{keyItem.clientName}</p>
                        <p className="text-xs text-muted-foreground">{keyItem.email}</p>
                      </div>
                      <Badge variant={keyItem.status === 'active' ? 'default' : 'destructive'}>
                        {keyItem.status === 'active' ? 'Active' : 'Suspended'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-xl border border-border/30">
                      <span className="font-mono text-[11px] truncate flex-1 text-foreground pr-2">
                        {maskKey(keyItem.key)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyToClipboard(keyItem.key, keyItem.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg shrink-0"
                      >
                        {copiedKeyId === keyItem.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-dashed pt-2.5">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Requests</p>
                        <p className="font-mono font-bold text-foreground">{keyItem.requestCount}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Created</p>
                        <p className="text-foreground">
                          {keyItem.createdAt?.seconds 
                            ? format(new Date(keyItem.createdAt.seconds * 1000), "PP")
                            : "Just Now"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(keyItem)}
                        className="flex-1 rounded-xl text-xs gap-1 hover:bg-muted/40 font-bold h-9"
                      >
                        <Power className="h-3 w-3" />
                        {keyItem.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-xl text-xs font-bold h-9"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[calc(100%-1.5rem)] rounded-3xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently revoke this access key for <strong className="text-foreground">{keyItem.clientName}</strong>?
                              Integration apps will lose access immediately.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteKey(keyItem.id, keyItem.clientName)}
                              className="bg-destructive hover:bg-destructive/90 rounded-xl text-xs font-bold"
                            >
                              Revoke Key
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>

        {/* Card Footer pagination */}
        {totalPages > 1 && (
          <CardFooter className="flex justify-between items-center py-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredKeys.length)} of {filteredKeys.length} keys
            </p>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                className="h-8 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-semibold text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
                className="h-8 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* ========== API TESTING AND CODE INTEGRATION CONSOLE ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* API Testing Console Card */}
        <Card className="rounded-3xl border border-border/70 bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="border-b border-border/40 pb-5">
            <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" /> API Interactive Tester
            </CardTitle>
            <CardDescription className="text-xs">
              Test queries directly in the browser. Select or type an active API Key and trigger a test GET request.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-4 flex-grow flex flex-col justify-between">
            <div className="space-y-2">
              <label htmlFor="test-key-input" className="text-xs font-bold text-muted-foreground flex justify-between">
                <span>Select / Paste API Key to Test</span>
                {apiKeys.length > 0 && (
                  <span className="text-primary hover:underline cursor-pointer text-[10px]" onClick={() => {
                    const firstActive = apiKeys.find(k => k.status === 'active');
                    if (firstActive) setTestApiKey(firstActive.key);
                  }}>
                    Use First Active Key
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <Input
                  id="test-key-input"
                  placeholder="bgk_live_..."
                  value={testApiKey}
                  onChange={(e) => setTestApiKey(e.target.value)}
                  className="font-mono text-xs rounded-xl h-10"
                />
                <Button 
                  onClick={handleTestRequest}
                  disabled={isTesting || !testApiKey}
                  className="rounded-xl font-bold gap-1.5 h-10 shrink-0 px-4"
                >
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Send Request
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 flex-grow flex flex-col mt-2">
              <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                <span>Response Console</span>
                {testStatus && (
                  <Badge 
                    variant={testStatus >= 200 && testStatus < 300 ? "default" : "destructive"} 
                    className="font-mono"
                  >
                    Status: {testStatus}
                  </Badge>
                )}
              </div>
              <div className="flex-grow min-h-[200px] max-h-[350px] overflow-y-auto bg-zinc-950 rounded-2xl border p-4 text-[11px] font-mono text-zinc-350 select-all font-semibold mt-1">
                {testResponse ? (
                  <pre className="whitespace-pre-wrap text-emerald-400">
                    {JSON.stringify(testResponse, null, 2)}
                  </pre>
                ) : (
                  <span className="text-zinc-500 italic block text-center py-16">
                    Click "Send Request" above to view response payload.
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Developer Integration Code Snippets Card */}
        <Card className="rounded-3xl border border-border/70 bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="border-b border-border/40 pb-5">
            <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" /> Integration Code Snippets
            </CardTitle>
            <CardDescription className="text-xs">
              Copy these copy-pasteable snippets and share them with developers to configure data synchronization.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 flex flex-col flex-grow">
            {/* Lang Tabs */}
            <div className="flex bg-muted/30 border-b border-border/40 p-1 shrink-0">
              {(['curl', 'js', 'python', 'dart'] as const).map((lang) => (
                <button
                  type="button"
                  key={lang}
                  onClick={() => setActiveCodeLanguage(lang)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all capitalize ${
                    activeCodeLanguage === lang 
                      ? 'bg-background text-foreground shadow-sm font-black' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lang === 'js' ? 'JavaScript' : lang === 'dart' ? 'Dart (Flutter)' : lang}
                </button>
              ))}
            </div>

            {/* Code Block Container */}
            <div className="p-6 flex-grow flex flex-col min-h-[250px] relative justify-between">
              <div className="overflow-x-auto bg-zinc-950 rounded-2xl border p-4 text-[11px] font-mono text-emerald-400 select-all font-semibold max-h-[300px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25">
                {activeCodeLanguage === 'curl' && (
                  <pre className="whitespace-pre">
{`curl -X GET \\
  -H "x-api-key: ${testApiKey || 'YOUR_API_KEY'}" \\
  "${origin}/api/external/v1/data"`}
                  </pre>
                )}
                {activeCodeLanguage === 'js' && (
                  <pre className="whitespace-pre">
{`fetch("${origin}/api/external/v1/data", {
  method: "GET",
  headers: {
    "x-api-key": "${testApiKey || 'YOUR_API_KEY'}"
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error("Error:", err));`}
                  </pre>
                )}
                {activeCodeLanguage === 'python' && (
                  <pre className="whitespace-pre">
{`import requests

url = "${origin}/api/external/v1/data"
headers = {
    "x-api-key": "${testApiKey || 'YOUR_API_KEY'}"
}

try:
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    data = response.json()
    print(data)
except requests.exceptions.RequestException as e:
    print(f"API Request failed: {e}")`}
                  </pre>
                )}
                {activeCodeLanguage === 'dart' && (
                  <pre className="whitespace-pre">
{`import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> fetchMiqaats() async {
  final url = Uri.parse('${origin}/api/external/v1/data');
  try {
    final response = await http.get(
      url,
      headers: {
        'x-api-key': '${testApiKey || 'YOUR_API_KEY'}',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      print('Retrieved miqaats successfully: \${data["data"]["miqaats"].length}');
    } else {
      print('Request failed: \${response.statusCode} - \${response.body}');
    }
  } catch (e) {
    print('Failed to request API: \$e');
  }
}`}
                  </pre>
                )}
              </div>

              {/* Copy Code Button */}
              <div className="mt-4 flex justify-end shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    let codeText = "";
                    if (activeCodeLanguage === 'curl') {
                      codeText = `curl -X GET \\\n  -H "x-api-key: ${testApiKey || 'YOUR_API_KEY'}" \\\n  "${origin}/api/external/v1/data"`;
                    } else if (activeCodeLanguage === 'js') {
                      codeText = `fetch("${origin}/api/external/v1/data", {\n  method: "GET",\n  headers: {\n    "x-api-key": "${testApiKey || 'YOUR_API_KEY'}"\n  }\n})\n.then(res => res.json())\n.then(data => console.log(data))\n.catch(err => console.error("Error:", err));`;
                    } else if (activeCodeLanguage === 'python') {
                      codeText = `import requests\n\nurl = "${origin}/api/external/v1/data"\nheaders = {\n    "x-api-key": "${testApiKey || 'YOUR_API_KEY'}"\n}\n\ntry:\n    response = requests.get(url, headers=headers)\n    response.raise_for_status()\n    data = response.json()\n    print(data)\nexcept requests.exceptions.RequestException as e:\n    print(f"API Request failed: {e}")`;
                    } else if (activeCodeLanguage === 'dart') {
                      codeText = `import 'package:http/http.dart' as http;\nimport 'dart:convert';\n\nFuture<void> fetchMiqaats() async {\n  final url = Uri.parse('${origin}/api/external/v1/data');\n  try {\n    final response = await http.get(\n      url,\n      headers: {\n        'x-api-key': '${testApiKey || 'YOUR_API_KEY'}',\n      },\n    );\n\n    if (response.statusCode == 200) {\n      final data = json.decode(response.body);\n      print('Retrieved miqaats successfully: \\\${data["data"]["miqaats"].length}');\n    } else {\n      print('Request failed: \\\${response.statusCode} - \\\${response.body}');\n    }\n  } catch (e) {\n    print('Failed to request API: \\$e');\n  }\n}`;
                    }
                    handleCopyToClipboard(codeText, "code_snippet");
                  }}
                  className="rounded-xl text-xs gap-1.5 font-bold h-9"
                >
                  {copiedKeyId === "code_snippet" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" /> Copied Code!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy Code Snippet
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ========== DIALOG: GENERATE KEY FORM ========== */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-3xl p-0 overflow-hidden w-[calc(100%-1.5rem)] sm:max-w-md border border-border">
          <form onSubmit={handleGenerateKey}>
            <div className="p-6 space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-foreground">Generate New API Key</DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">
                  Create a new authorization token to allow API clients to fetch public data.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="client-name" className="text-xs font-bold text-muted-foreground">Client/App Name</label>
                  <Input
                    id="client-name"
                    placeholder="e.g., Attendance Watch App"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    className="rounded-xl text-xs h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="client-email" className="text-xs font-bold text-muted-foreground">Developer Contact Email</label>
                  <Input
                    id="client-email"
                    type="email"
                    placeholder="e.g., developer@partner.org"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    required
                    className="rounded-xl text-xs h-10"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 bg-muted/10 border-t flex flex-row justify-end gap-2 shrink-0">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="rounded-xl text-xs">
                  Cancel
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={isGenerating || !clientName || !clientEmail} 
                className="rounded-xl text-xs font-bold"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Token
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========== DIALOG: DISPLAY NEWLY GENERATED KEY ========== */}
      <Dialog open={generatedKey !== null} onOpenChange={(open) => { if(!open) setGeneratedKey(null); }}>
        <DialogContent className="rounded-3xl p-6 w-[calc(100%-1.5rem)] sm:max-w-md border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">API Token Generated</DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">
              Please copy the token below now. For security purposes, this token will not be shown again.
            </DialogDescription>
          </DialogHeader>

          {generatedKey && (
            <div className="space-y-4 my-2">
              <div className="flex items-center justify-between gap-2 bg-muted p-3.5 rounded-2xl border border-border shadow-inner font-mono text-xs select-all text-foreground font-bold break-all">
                <span>{generatedKey}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyToClipboard(generatedKey, "new_key")}
                  className="h-9 w-9 text-muted-foreground hover:text-primary rounded-xl shrink-0"
                >
                  {copiedKeyId === "new_key" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-2.5">
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-[11px] text-destructive font-medium leading-relaxed">
                  <strong>Warning:</strong> Keep this key secure and secret. Do not commit it to github or share it publicly. 
                  If you lose this key, you must generate a new one and update your configuration.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button onClick={() => setGeneratedKey(null)} className="rounded-xl text-xs font-bold w-full sm:w-auto">
              I Have Saved This Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
