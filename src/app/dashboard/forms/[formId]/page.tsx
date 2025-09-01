
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
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
import { Loader2, FileWarning, ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Form as FormType } from "@/types";
import { getForm, addFormResponse } from "@/lib/firebase/formService";
import { Separator } from "@/components/ui/separator";

export default function FillFormPage({ params }: { params: { formId: string } }) {
    const router = useRouter();
    const { formId } = params;
    const { toast } = useToast();
    const [form, setForm] = useState<FormType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { formSchema, defaultValues } = useMemo(() => {
        if (!form) return { formSchema: z.object({}), defaultValues: {} };

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
                    fieldSchema = z.any();
            }
            shape[q.id] = fieldSchema;
        });

        return {
            formSchema: z.object(shape),
            defaultValues: defaults,
        };
    }, [form]);

    const responseForm = useForm({
        resolver: zodResolver(formSchema),
        defaultValues,
    });

    useEffect(() => {
        if (!formId) {
            setError("Form ID is missing.");
            setIsLoading(false);
            return;
        }

        const fetchForm = async () => {
            setIsLoading(true);
            try {
                const fetchedForm = await getForm(formId);
                if (fetchedForm) {
                    setForm(fetchedForm);
                    responseForm.reset(defaultValues);
                } else {
                    setError("This form could not be found or may have been deleted.");
                }
            } catch (err) {
                console.error(err);
                setError("An error occurred while loading the form.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchForm();
    }, [formId, defaultValues, responseForm]);


    const handleResponseSubmit = async (values: z.infer<typeof formSchema>) => {
        const submitterId = localStorage.getItem('userItsId');
        if (!submitterId || !form) {
            toast({ title: "Submission Failed", description: "Cannot identify the user. Please log in again.", variant: "destructive" });
            return;
        }

        try {
            await addFormResponse(form.id, {
                formId: form.id,
                submittedBy: submitterId,
                responses: values,
            });
            toast({ title: "Response Submitted", description: "Thank you for filling out the form!" });
            router.push('/dashboard/forms');
        } catch (error) {
            console.error("Failed to submit response:", error);
            toast({ title: "Error", description: "Could not submit your response. Please try again.", variant: "destructive" });
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading Form...</p>
            </div>
        );
    }
    
    if (error) {
         return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
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
        return null; // Should be handled by error state, but as a fallback
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            <Button variant="ghost" onClick={() => router.push('/dashboard/forms')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Forms
            </Button>
            <Card className="shadow-lg border-primary/20 bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold">{form.title}</CardTitle>
                    {form.description && <CardDescription className="text-md mt-2">{form.description}</CardDescription>}
                </CardHeader>
                <Separator />
                <UIForm {...responseForm}>
                    <form onSubmit={responseForm.handleSubmit(handleResponseSubmit)}>
                        <CardContent className="py-6 px-4 md:px-8 space-y-8">
                            {form.questions.map((question, index) => (
                                 <FormField
                                    key={question.id}
                                    control={responseForm.control}
                                    name={question.id}
                                    render={({ field }) => (
                                        <FormItem className="p-6 rounded-lg border bg-background shadow-sm">
                                            <FormLabel className="text-lg font-semibold flex items-baseline gap-2">
                                                <span>{index + 1}.</span>
                                                {question.label} 
                                                {question.required && <span className="text-destructive text-sm font-normal">* required</span>}
                                            </FormLabel>
                                            <FormControl className="pt-4">
                                                <div>
                                                    {question.type === 'text' && <Input {...field} />}
                                                    {question.type === 'textarea' && <Textarea {...field} rows={4} />}
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
                                                                    control={responseForm.control}
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
                            ))}
                        </CardContent>
                        <CardFooter>
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

