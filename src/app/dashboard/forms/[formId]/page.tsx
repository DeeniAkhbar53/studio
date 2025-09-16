
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form as UIForm, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileWarning, ArrowLeft, Send, User as UserIcon, CheckCircle2, Lock, Star, Calendar as CalendarIcon, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Form as FormType, FormResponse, User } from "@/types";
import { getForm, addFormResponse, checkIfUserHasResponded } from "@/lib/firebase/formService";
import { getUserByItsOrBgkId } from "@/lib/firebase/userService";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FunkyLoader } from "@/components/ui/funky-loader";

// Helper function to generate schema based on current form values for conditional logic
const generateDynamicFormSchema = (form: FormType, getValues: () => any) => {
  if (!form) {
    return z.object({});
  }

  const shape: { [key: string]: z.ZodType<any, any> } = {};

  form.questions.forEach(q => {
    let isConditionMet = true;
    if (q.conditional) {
      const parentValue = getValues()[q.conditional.questionId];
      if (parentValue !== q.conditional.value) {
        isConditionMet = false;
      }
    }

    let fieldSchema: z.ZodType<any, any>;

    switch (q.type) {
      case 'text':
      case 'textarea':
      case 'radio':
      case 'select':
      case 'date':
        fieldSchema = z.string();
        if (q.required && isConditionMet) {
          fieldSchema = fieldSchema.min(1, `${q.label} is required.`);
        } else {
          fieldSchema = fieldSchema.optional().default("");
        }
        break;
      case 'number':
        fieldSchema = z.string().refine(val => !(q.required && isConditionMet) || val, { message: `${q.label} is required.` })
          .refine(val => !val || /^-?\d*\.?\d+$/.test(val), { message: "Must be a valid number." });
        break;
      case 'rating':
        fieldSchema = z.number();
        if (q.required && isConditionMet) {
            fieldSchema = fieldSchema.min(1, {message: 'Rating is required.'});
        } else {
            fieldSchema = fieldSchema.optional().nullable().default(null) as any;
        }
        break;
      case 'checkbox':
        fieldSchema = z.array(z.string());
        if (q.required && isConditionMet) {
          fieldSchema = fieldSchema.nonempty({ message: `Please select at least one option for ${q.label}.` });
        } else {
          fieldSchema = fieldSchema.optional().default([]);
        }
        break;
      default:
        fieldSchema = z.any().optional();
    }
    shape[q.id] = fieldSchema;
  });

  return z.object(shape);
};

// Helper to generate default values
const generateFormDefaults = (form: FormType | null) => {
    if (!form) {
        return {};
    }
    const defaults: { [key: string]: any } = {};
    form.questions.forEach(q => {
        switch (q.type) {
            case 'text':
            case 'textarea':
            case 'radio':
            case 'select':
            case 'date':
            case 'number':
                defaults[q.id] = "";
                break;
            case 'rating':
                 defaults[q.id] = q.required ? 1 : null;
                 break;
            case 'checkbox':
                defaults[q.id] = [];
                break;
            default:
                defaults[q.id] = undefined;
        }
    });
    return defaults;
};


const StarRating = ({ field, max = 5 }: { field: any, max?: number }) => {
    return (
        <div className="flex items-center gap-2">
            {[...Array(max)].map((_, i) => {
                const ratingValue = i + 1;
                return (
                    <Star
                        key={ratingValue}
                        className={cn(
                            "h-8 w-8 cursor-pointer transition-colors",
                            ratingValue <= (field.value || 0)
                                ? "text-primary fill-primary"
                                : "text-muted-foreground/50"
                        )}
                        onClick={() => field.onChange(ratingValue)}
                    />
                );
            })}
        </div>
    );
};

// Component to render a question, with conditional logic check
const QuestionRenderer = ({ question, index, control, setValue }: { question: FormType['questions'][0], index: number, control: any, setValue: any }) => {
    
    // Watch the value of the parent question if this question is conditional
    const parentQuestionValue = useWatch({
        control,
        name: question.conditional ? question.conditional.questionId : '',
        disabled: !question.conditional,
    });

    if (question.conditional) {
        if (parentQuestionValue !== question.conditional.value) {
            return null; // Don't render this question
        }
    }


    return (
        <Card className="p-4 md:p-6 rounded-lg border bg-background shadow-sm animate-in fade-in-0 duration-500">
            <FormField
                key={question.id}
                control={control}
                name={question.id}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-base font-semibold flex items-baseline gap-2">
                            {question.label}
                            {question.required && <span className="text-destructive text-sm font-normal">* required</span>}
                        </FormLabel>
                        <FormControl className="pt-4">
                            <div>
                                {question.type === 'text' && <Input {...field} value={field.value || ''} />}
                                {question.type === 'textarea' && <Textarea {...field} value={field.value || ''} rows={4} />}
                                {question.type === 'number' && <Input type="number" {...field} value={field.value || ''} />}
                                {question.type === 'date' && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ? new Date(field.value) : undefined}
                                            onSelect={(date) => setValue(question.id, date ? format(date, "yyyy-MM-dd") : "")}
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                )}
                                {question.type === 'rating' && <StarRating field={field} />}
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
        </Card>
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
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    
    const [hasAlreadyResponded, setHasAlreadyResponded] = useState<boolean | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isEligible, setIsEligible] = useState<boolean | null>(null);

    const defaultValues = useMemo(() => generateFormDefaults(form), [form]);
    
    const responseForm = useForm({
      resolver: (data, context, options) => {
        const schema = generateDynamicFormSchema(form!, () => responseForm.getValues());
        return zodResolver(schema)(data, context, options);
      },
      defaultValues: defaultValues,
      mode: 'onChange', // Re-validate on change to handle conditional logic
    });


    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (typeof window !== "undefined") {
                const userItsId = localStorage.getItem('userItsId');
                if (userItsId) {
                    try {
                        const user = await getUserByItsOrBgkId(userItsId);
                        setCurrentUser(user);
                    } catch (e) {
                         setError("Could not verify your user details. Please log in again.");
                         setIsLoading(false);
                    }
                } else {
                    setError("Cannot verify user identity. Please log in again.");
                    setIsLoading(false);
                }
            }
        };
        fetchCurrentUser();
    }, []);
    
    useEffect(() => {
        if (!formId || !currentUser) {
            if(!currentUser && !isLoading) { // If user loading is done and no user found
                setError("Cannot verify user identity. Please log in again.");
            }
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

                    // --- NEW ELIGIBILITY CHECK ---
                    const isForEveryone = !fetchedForm.mohallahIds?.length && !fetchedForm.teams?.length && !fetchedForm.eligibleItsIds?.length;
                    
                    if (isForEveryone) {
                        setIsEligible(true);
                    } else {
                        const eligibleById = !!fetchedForm.eligibleItsIds?.includes(currentUser.itsId);
                        const eligibleByTeam = !!currentUser.team && !!fetchedForm.teams?.includes(currentUser.team);
                        const eligibleByMohallah = !!currentUser.mohallahId && !!fetchedForm.mohallahIds?.includes(currentUser.mohallahId);
                        
                        if (eligibleById || eligibleByTeam || eligibleByMohallah) {
                            setIsEligible(true);
                        } else {
                            setIsEligible(false);
                        }
                    }
                    // --- END ELIGIBILITY CHECK ---

                    if (fetchedForm.endDate && new Date() > new Date(fetchedForm.endDate)) {
                        setError("This form is now closed as the deadline has passed.");
                    } else if (fetchedForm.status === 'closed' && !userHasResponded) {
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
            responseForm.reset(generateFormDefaults(form));
        }
    }, [form, responseForm]);


    const handleResponseSubmit = async (values: z.infer<typeof responseForm.formState.defaultValues>) => {
        if (!currentUser?.itsId || !form) {
            toast({ title: "Submission Failed", description: "Cannot identify the user or form. Please log in again.", variant: "destructive" });
            return;
        }
        if (form.status === 'closed' || (form.endDate && new Date() > new Date(form.endDate))) {
            toast({ title: "Submission Failed", description: "This form is closed and no longer accepting responses.", variant: "destructive" });
            return;
        }

        const processedResponses = { ...values };
        form.questions.forEach(q => {
            if (q.type === 'number') {
                const numValue = parseFloat(processedResponses[q.id] as string);
                processedResponses[q.id] = isNaN(numValue) ? undefined : numValue;
            }
        });

        const responsePayload: Omit<FormResponse, 'id' | 'submittedAt'> = {
            formId: form.id,
            submittedBy: currentUser.itsId,
            submitterName: currentUser.name,
            responses: processedResponses,
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
    
    if (isLoading || hasAlreadyResponded === null || !currentUser || isEligible === null) {
        return (
            <div className="flex h-screen items-center justify-center bg-muted p-4">
                <FunkyLoader size="lg">Loading Form...</FunkyLoader>
            </div>
        );
    }
    
    if (error) {
         return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 text-center">
                <Card className="w-full max-w-lg p-8">
                  <FileWarning className="h-16 w-16 text-destructive mx-auto mb-4" />
                  <h1 className="text-2xl font-bold text-destructive">Form Not Available</h1>
                  <p className="text-muted-foreground mt-2">{error}</p>
                   <Button variant="outline" onClick={() => router.back()} className="mt-6">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                  </Button>
                </Card>
            </div>
        );
    }
    
    if (!isEligible) {
         return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 text-center">
                <Card className="w-full max-w-lg p-8">
                  <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
                  <h1 className="text-2xl font-bold text-destructive">Not Eligible</h1>
                  <p className="text-muted-foreground mt-2">You are not eligible to fill out this form.</p>
                   <Button variant="outline" onClick={() => router.back()} className="mt-6">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                  </Button>
                </Card>
            </div>
        );
    }

    if (!form) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 text-center">
                <Card className="w-full max-w-lg p-8">
                  <FileWarning className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h1 className="text-2xl font-bold text-muted-foreground">Form Not Loaded</h1>
                  <p className="text-muted-foreground mt-2">The form could not be loaded. Please try again.</p>
                   <Button variant="outline" onClick={() => router.back()} className="mt-6">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                  </Button>
                </Card>
            </div>
        );
    }

    if (hasSubmitted || hasAlreadyResponded) {
        return (
             <div className="flex flex-col min-h-screen items-center justify-center bg-muted p-4">
                 <div className="w-full max-w-2xl">
                     <Card className="p-8 sm:p-12 text-center">
                         <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-6" />
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
                     </Card>
                 </div>
             </div>
        );
    }

    if (form.status === 'closed' || (form.endDate && new Date() > new Date(form.endDate))) {
        return (
             <div className="flex flex-col min-h-screen items-center justify-center bg-muted p-4">
                 <div className="w-full max-w-2xl">
                     <Card className="p-8 sm:p-12 text-center">
                         <Lock className="h-20 w-20 text-destructive mx-auto mb-6" />
                         <h1 className="text-3xl font-bold text-destructive">Form Closed</h1>
                         <p className="text-lg text-muted-foreground mt-2">
                            {form.endDate && new Date() > new Date(form.endDate)
                                ? "This form is not accepting new responses as the deadline has passed."
                                : "This form is not accepting new responses at this time."
                            }
                         </p>
                          <Button variant="outline" onClick={() => router.push('/dashboard/forms')} className="mt-8">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to All Forms
                        </Button>
                     </Card>
                 </div>
             </div>
        );
    }


    return (
        <div className="min-h-screen bg-muted flex flex-col items-center py-8 md:py-12 px-4">
            <div className="w-full max-w-3xl space-y-6">
                <Card className="overflow-hidden">
                    {form.imageUrl && (
                        <div className="relative w-full h-48 md:h-64">
                            <Image
                                src={form.imageUrl}
                                alt={form.title}
                                layout="fill"
                                objectFit="cover"
                                className="bg-muted"
                            />
                        </div>
                    )}
                    <div className="bg-primary/10 p-6 border-b-4 border-primary">
                        <CardTitle className="text-3xl font-bold">{form.title}</CardTitle>
                        {form.description && <CardDescription className="text-md mt-2">{form.description}</CardDescription>}
                    </div>
                </Card>

                {currentUser && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-3">
                                <UserIcon className="h-5 w-5 text-primary" />
                                Your Information
                            </CardTitle>
                            <CardDescription>This information is automatically recorded with your submission.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <Label>Full Name</Label>
                                <p className="font-medium text-muted-foreground">{currentUser.name}</p>
                            </div>
                            <div>
                                <Label>ITS ID</Label>
                                <p className="font-medium text-muted-foreground">{currentUser.itsId}</p>
                            </div>
                            <div>
                                <Label>BGK ID</Label>
                                <p className="font-medium text-muted-foreground">{currentUser.bgkId || "N/A"}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
                
                <UIForm {...responseForm}>
                    <form onSubmit={responseForm.handleSubmit(handleResponseSubmit)} className="space-y-6">
                       {form.questions.map((question, index) => (
                            <QuestionRenderer
                                key={question.id}
                                question={question}
                                index={index}
                                control={responseForm.control}
                                setValue={responseForm.setValue}
                            />
                        ))}
                        
                        <div className="flex justify-end pt-4">
                            <Button type="submit" size="lg" className="min-w-[150px]" disabled={responseForm.formState.isSubmitting}>
                                {responseForm.formState.isSubmitting && <FunkyLoader size="sm" />}
                                <Send className="mr-2 h-4 w-4" />
                                Submit Response
                            </Button>
                        </div>
                    </form>
                </UIForm>
            </div>
        </div>
    );
}
