
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form as UIForm, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, FileWarning, ArrowLeft, Send, User as UserIcon, CheckCircle2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Form as FormType, FormResponse } from "@/types";
import { getForm, addFormResponse, checkIfUserHasResponded } from "@/lib/firebase/formService";
import { Separator } from "@/components/ui/separator";

// Helper function to generate schema and defaults
const generateFormSchemaAndDefaults = (form: FormType | null) => {
    if (!form) {
        return { formSchema: z.object({}), defaultValues: {} };
    }

    const shape: { [key: string]: z.ZodType<any, any> } = {};
    const defaults: { [key: string]: any } = {};

    form.questions.forEach(q => {
        let fieldSchema: z.ZodType<any, any>;

        switch (q.type) {
            case 'text':
            case 'textarea':
            case 'radio':
            case 'select':
                fieldSchema = z.string();
                if (q.required) {
                    fieldSchema = fieldSchema.min(1, `${q.label} is required.`);
                } else {
                    fieldSchema = fieldSchema.optional().default("");
                }
                defaults[q.id] = "";
                break;
            case 'checkbox':
                fieldSchema = z.array(z.string());
                if (q.required) {
                    fieldSchema = fieldSchema.nonempty({ message: `Please select at least one option for ${q.label}.` });
                } else {
                    fieldSchema = fieldSchema.optional().default([]);
                }
                defaults[q.id] = [];
                break;
            default:
                fieldSchema = z.any().optional();
        }
        shape[q.id] = fieldSchema;
    });

    return {
        formSchema: z.object(shape),
        defaultValues: defaults,
    };
};

// Component to render a question, with conditional logic check
const QuestionRenderer = ({ question, index, control, responseData }: { question: FormType['questions'][0], index: number, control: any, responseData: any }) => {
    
    if (question.conditional) {
        const parentQuestionValue = responseData[question.conditional.questionId];
        if (parentQuestionValue !== question.conditional.value) {
            return null; // Don't render this question
        }
    }

    return (
        <FormField
            key={question.id}
            control={control}
            name={question.id}
            render={({ field }) => (
                <FormItem className="p-4 md:p-6 rounded-lg border bg-background shadow-sm animate-in fade-in-0 duration-500">
                    <FormLabel className="text-lg font-semibold flex items-baseline gap-2">
                        <span>{index + 1}.</span>
                        {question.label}
                        {question.required && <span className="text-destructive text-sm font-normal">* required</span>}
                    </FormLabel>
                    <FormControl className="pt-4">
                        <div>
                            {question.type === 'text' && <Input {...field} value={field.value || ''} />}
                            {question.type === 'textarea' && <Textarea {...field} value={field.value || ''} rows={4} />}
                            {question.type === 'radio' && (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2">
                                    {question.options?.map(option => (
                                        <FormItem key={option} className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                                <RadioGroupItem value={option} />
                                            </FormControl>
                                            <FormLabel className="font-normal">{option}</FormLabel>
                                        </FormItem>
                                    ))}
                                </RadioGroup>
                            )}
                            {question.type === 'select' && (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                                    <SelectContent>
                                        {question.options?.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {question.type === 'checkbox' && (
                                <div className="space-y-2">
                                    {question.options?.map(option => (
                                        <FormField
                                            key={option}
                                            control={control}
                                            name={question.id}
                                            render={({ field: checkboxField }) => {
                                                const currentValues = (checkboxField.value as string[] | undefined) || [];
                                                return (
                                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={currentValues.includes(option)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? checkboxField.onChange([...currentValues, option])
                                                                        : checkboxField.onChange(currentValues.filter(v => v !== option));
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">{option}</FormLabel>
                                                    </FormItem>
                                                );
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
};


export default function FillFormPage() {
    const router = useRouter();
    const params = useParams();
    const formId = params.formId as string;
    const { toast } = useToast();
    const [form, setForm] = useState<FormType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<{name: string, itsId: string, bgkId?: string} | null>(null);
    
    const [hasAlreadyResponded, setHasAlreadyResponded] = useState<boolean | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    // Generate schema and defaults based on the current form state
    const { formSchema, defaultValues } = useMemo(() => generateFormSchemaAndDefaults(form), [form]);
    
    // Initialize useForm
    const responseForm = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });

    const watchedResponses = responseForm.watch();

    useEffect(() => {
        if (typeof window !== "undefined") {
            const userName = localStorage.getItem('userName');
            const userItsId = localStorage.getItem('userItsId');
            const userBgkId = localStorage.getItem('userBgkId');
            if (userName && userItsId) {
                setCurrentUser({ name: userName, itsId: userItsId, bgkId: userBgkId || undefined });
            } else {
                setError("Cannot verify user identity. Please log in again.");
                setIsLoading(false);
            }
        }
    }, []);
    
    useEffect(() => {
        if (!formId || !currentUser) {
            return;
        }

        const fetchFormData = async () => {
            setIsLoading(true); 
            try {
                const [fetchedForm, userHasResponded] = await Promise.all([
                    getForm(formId),
                    checkIfUserHasResponded(formId, currentUser.itsId)
                ]);

                if (fetchedForm) {
                    setForm(fetchedForm);
                    if (fetchedForm.status === 'closed' && !userHasResponded) {
                         setError("This form is currently closed and not accepting new responses.");
                    }
                    setHasAlreadyResponded(userHasResponded);
                } else {
                    setError("This form could not be found or may have been deleted.");
                }
            } catch (err) {
                console.error(err);
                setError("An error occurred while loading the form data.");
                toast({
                    title: "Loading Error",
                    description: "There was a problem fetching the form. Please try again.",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchFormData();
    }, [formId, currentUser, toast]);

    // This effect now correctly resets the form with new defaults when the form data changes.
    useEffect(() => {
        if (form) {
            const { defaultValues: newDefaults } = generateFormSchemaAndDefaults(form);
            responseForm.reset(newDefaults);
        }
    }, [form, responseForm]);


    const handleResponseSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!currentUser?.itsId || !form) {
            toast({ title: "Submission Failed", description: "Cannot identify the user or form. Please log in again.", variant: "destructive" });
            return;
        }
        if (form.status === 'closed') {
            toast({ title: "Submission Failed", description: "This form is closed and no longer accepting responses.", variant: "destructive" });
            return;
        }

        const responsePayload: Omit<FormResponse, 'id' | 'submittedAt'> = {
            formId: form.id,
            submittedBy: currentUser.itsId,
            submitterName: currentUser.name,
            responses: values,
            submitterBgkId: currentUser.bgkId,
        };

        try {
            await addFormResponse(form.id, responsePayload);
            setHasSubmitted(true);
        } catch (error) {
            console.error("Failed to submit response:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not submit your response. Please try again.";
            toast({ title: "Error", description: errorMessage, variant: "destructive" });
        }
    };
    
    if (isLoading || hasAlreadyResponded === null) {
        return (
            <div className="flex h-screen items-center justify-center p-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (error) {
         return (
            <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
                <FileWarning className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-2xl font-bold text-destructive">Form Not Available</h1>
                <p className="text-muted-foreground mt-2">{error}</p>
                 <Button variant="outline" onClick={() => router.back()} className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        );
    }

    if (!form) {
        return (
             <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
                <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold text-muted-foreground">Form Not Loaded</h1>
                <p className="text-muted-foreground mt-2">The form could not be loaded. Please try again.</p>
                 <Button variant="outline" onClick={() => router.back()} className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        );
    }

    if (hasSubmitted || hasAlreadyResponded) {
        return (
             <div className="flex flex-col h-screen items-center justify-center bg-background p-4">
                 <Card className="w-full max-w-2xl shadow-lg border-primary/20 bg-gradient-to-br from-card to-muted/20">
                     <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
                         <CheckCircle2 className="h-20 w-20 text-green-500 mb-6" />
                         <h1 className="text-3xl font-bold text-foreground">
                            {hasSubmitted ? "Thank You!" : "Response Recorded"}
                         </h1>
                         <p className="text-lg text-muted-foreground mt-2">
                             {hasSubmitted ? "Your response has been successfully submitted." : "You have already filled out this form."}
                         </p>
                          <Button variant="outline" onClick={() => router.push('/dashboard/forms')} className="mt-8">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to All Forms
                        </Button>
                     </CardContent>
                 </Card>
             </div>
        );
    }

    if (form.status === 'closed') {
        return (
             <div className="flex flex-col h-screen items-center justify-center bg-background p-4">
                 <Card className="w-full max-w-2xl shadow-lg border-destructive/20">
                     <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
                         <Lock className="h-20 w-20 text-destructive mb-6" />
                         <h1 className="text-3xl font-bold text-destructive">Form Closed</h1>
                         <p className="text-lg text-muted-foreground mt-2">
                            This form is not accepting new responses at this time.
                         </p>
                          <Button variant="outline" onClick={() => router.push('/dashboard/forms')} className="mt-8">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to All Forms
                        </Button>
                     </CardContent>
                 </Card>
             </div>
        );
    }


    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            <Card className="shadow-lg border-primary/20 bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="text-left p-4 md:p-6">
                    <CardTitle className="text-2xl md:text-3xl font-bold">{form.title}</CardTitle>
                    {form.description && <CardDescription className="text-md mt-2">{form.description}</CardDescription>}
                </CardHeader>
                <Separator />
                
                <UIForm {...responseForm}>
                    <form onSubmit={responseForm.handleSubmit(handleResponseSubmit)}>
                        {currentUser && (
                            <CardContent className="py-6 px-4 md:px-8">
                                <Card className="bg-primary/5 border-primary/20">
                                    <CardHeader>
                                        <CardTitle className="text-xl flex items-center gap-3">
                                            <UserIcon className="h-6 w-6 text-primary" />
                                            Your Information
                                        </CardTitle>
                                        <CardDescription>This information is automatically recorded with your submission.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <FormLabel>Full Name</FormLabel>
                                            <Input value={currentUser.name} readOnly disabled className="mt-1 bg-muted/50 cursor-default" />
                                        </div>
                                        <div>
                                            <FormLabel>ITS ID</FormLabel>
                                            <Input value={currentUser.itsId} readOnly disabled className="mt-1 bg-muted/50 cursor-default" />
                                        </div>
                                         <div>
                                            <FormLabel>BGK ID</FormLabel>
                                            <Input value={currentUser.bgkId || "N/A"} readOnly disabled className="mt-1 bg-muted/50 cursor-default" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </CardContent>
                        )}

                        <CardContent className="pt-0 pb-6 px-4 md:px-8 space-y-8">
                           {form.questions.map((question, index) => (
                                <QuestionRenderer
                                    key={question.id}
                                    question={question}
                                    index={index}
                                    control={responseForm.control}
                                    responseData={watchedResponses}
                                />
                            ))}
                        </CardContent>
                        <CardFooter className="p-4 md:p-6">
                            <Button type="submit" className="w-full md:w-auto" disabled={responseForm.formState.isSubmitting}>
                                {responseForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                <Send className="mr-2 h-4 w-4" />
                                Submit Response
                            </Button>
                        </CardFooter>
                    </form>
                </UIForm>
            </Card>
        </div>
    );
}
