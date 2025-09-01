
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Form as UIForm, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, FileText, Loader2, ShieldAlert, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, Form as FormType, FormField as FormFieldType } from "@/types";

// Schema for a single question
const formQuestionSchema = z.object({
  id: z.string().optional(), // for potential future use
  label: z.string().min(1, "Question text cannot be empty."),
  type: z.enum(['text', 'textarea', 'checkbox', 'radio', 'select']),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string().min(1, "Option cannot be empty.") })).optional(),
});

// Schema for the entire form builder
const formBuilderSchema = z.object({
  title: z.string().min(1, "Form title cannot be empty."),
  description: z.string().optional(),
  questions: z.array(formQuestionSchema),
});

type FormBuilderValues = z.infer<typeof formBuilderSchema>;

// Placeholder data - in the future this would come from Firestore
const MOCK_FORMS: FormType[] = [
    { id: "1", title: "Annual Event Feedback", description: "Share your feedback on this year's annual event.", createdBy: "10101010", createdAt: new Date().toISOString(), questions: [
        { id: "q1", label: "What was your favorite part?", type: 'text', required: true},
        { id: "q2", label: "How would you rate the event?", type: 'radio', required: true, options: ['Excellent', 'Good', 'Average', 'Poor']},
        { id: "q3", label: "Any suggestions for next year?", type: 'textarea', required: false},
    ] },
    { id: "2", title: "Volunteer Signup 2024", description: "Sign up to volunteer for upcoming community services.", createdBy: "10101010", createdAt: new Date().toISOString(), questions: [] },
];

export default function FormsPage() {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [forms, setForms] = useState<FormType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
    
    // State for filling out a form
    const [selectedForm, setSelectedForm] = useState<FormType | null>(null);
    const [isFillFormOpen, setIsFillFormOpen] = useState(false);


    const formBuilder = useForm<FormBuilderValues>({
        resolver: zodResolver(formBuilderSchema),
        defaultValues: {
            title: "",
            description: "",
            questions: [],
        },
    });

    const { fields, append, remove, move } = useFieldArray({
        control: formBuilder.control,
        name: "questions",
    });

    useEffect(() => {
        const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
        setCurrentUserRole(role);
        setIsAuthorized(true);
    }, []);

    useEffect(() => {
        setIsLoading(true);
        setTimeout(() => {
            setForms(MOCK_FORMS);
            setIsLoading(false);
        }, 1000);
    }, []);

    const canCreateForms = currentUserRole === 'admin' || currentUserRole === 'superadmin';

    const handleCreateFormSubmit = (values: FormBuilderValues) => {
        console.log("Form Created:", values);
        // In the future, this will save to Firestore
        const newForm: FormType = {
            id: String(Date.now()), // temporary ID
            ...values,
            questions: values.questions.map((q, index) => ({...q, id: String(Math.random()), options: q.options ? q.options.map(opt => opt.value) : undefined })),
            createdBy: localStorage.getItem('userItsId') || 'unknown',
            createdAt: new Date().toISOString(),
        };
        setForms(prev => [newForm, ...prev]);
        toast({ title: "Form Created!", description: `"${values.title}" has been created.` });
        setIsCreateFormOpen(false);
        formBuilder.reset();
    };

    const handleOpenFillForm = (formToFill: FormType) => {
        setSelectedForm(formToFill);
        setIsFillFormOpen(true);
    };
    
    if (isAuthorized === null) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (isAuthorized === false) {
        return (
           <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground mt-2">
              You do not have the required permissions to view this page.
            </p>
          </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center">
                            <FileText className="mr-2 h-5 w-5 text-primary"/>
                            Forms & Surveys
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Fill out available forms or create new ones if you have permission.
                        </CardDescription>
                    </div>
                    {canCreateForms && (
                        <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Form
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>Create a New Form</DialogTitle>
                                    <DialogDescription>
                                        Build your form by adding a title, description, and questions.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={formBuilder.handleSubmit(handleCreateFormSubmit)} className="flex-1 overflow-y-auto space-y-6 pr-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="form-title">Form Title</Label>
                                        <Input id="form-title" {...formBuilder.register("title")} placeholder="e.g., Annual Event Feedback" />
                                        {formBuilder.formState.errors.title && <p className="text-sm text-destructive">{formBuilder.formState.errors.title.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="form-description">Description</Label>
                                        <Textarea id="form-description" {...formBuilder.register("description")} placeholder="Provide a brief description for your form..." />
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold">Questions</h3>
                                        {fields.map((field, index) => {
                                            const questionType = formBuilder.watch(`questions.${index}.type`);
                                            return (
                                                <Card key={field.id} className="p-4 bg-muted/50 relative">
                                                    <div className="flex gap-4">
                                                         <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0 mt-1" />
                                                        <div className="flex-grow space-y-4">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="font-semibold">Question {index + 1}</Label>
                                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Question Type</Label>
                                                                    <Controller
                                                                        control={formBuilder.control}
                                                                        name={`questions.${index}.type`}
                                                                        render={({ field }) => (
                                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="text">Text (Single Line)</SelectItem>
                                                                                    <SelectItem value="textarea">Text Area (Multi-line)</SelectItem>
                                                                                    <SelectItem value="radio">Radio Buttons</SelectItem>
                                                                                    <SelectItem value="checkbox">Checkboxes</SelectItem>
                                                                                    <SelectItem value="select">Dropdown</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        )}
                                                                    />
                                                                </div>
                                                                 <div className="space-y-2 flex flex-col justify-end">
                                                                    <div className="flex items-center space-x-2">
                                                                         <Controller
                                                                            control={formBuilder.control}
                                                                            name={`questions.${index}.required`}
                                                                            render={({ field }) => (
                                                                                 <Switch id={`required-${index}`} checked={field.value} onCheckedChange={field.onChange} />
                                                                            )}
                                                                        />
                                                                        <Label htmlFor={`required-${index}`}>Required</Label>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label>Question Label</Label>
                                                                <Input {...formBuilder.register(`questions.${index}.label`)} placeholder="e.g., What is your name?" />
                                                                {formBuilder.formState.errors.questions?.[index]?.label && <p className="text-sm text-destructive">{formBuilder.formState.errors.questions?.[index]?.label?.message}</p>}
                                                            </div>

                                                            {(questionType === "radio" || questionType === "checkbox" || questionType === "select") && (
                                                                <OptionsArray control={formBuilder.control} nestIndex={index} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </Card>
                                            )
                                        })}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => append({ label: "", type: 'text', required: false, options: [] })}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Question
                                        </Button>
                                    </div>

                                </form>
                                 <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" onClick={formBuilder.handleSubmit(handleCreateFormSubmit)}>
                                        Save Form
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-2 text-muted-foreground">Loading forms...</p>
                        </div>
                    ) : forms.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No forms or surveys are available at this time.</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {forms.map((form) => (
                                <Card key={form.id} className="hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{form.title}</CardTitle>
                                        <CardDescription>{form.description}</CardDescription>
                                    </CardHeader>
                                    <CardFooter>
                                        <Button className="w-full" onClick={() => handleOpenFillForm(form)}>
                                            Fill Out Form
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

             {selectedForm && (
                <FillFormDialog
                    isOpen={isFillFormOpen}
                    onClose={() => setIsFillFormOpen(false)}
                    form={selectedForm}
                />
            )}
        </div>
    );
}

function OptionsArray({ control, nestIndex }: { control: any, nestIndex: number }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `questions.${nestIndex}.options`
    });

    return (
        <div className="space-y-3 pt-2 pl-6 border-l-2 ml-2">
            <Label className="font-semibold">Options</Label>
            {fields.map((item, k) => (
                <div key={item.id} className="flex items-center gap-2">
                    <Input
                        {...control.register(`questions.${nestIndex}.options.${k}.value`)}
                        placeholder={`Option ${k + 1}`}
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(k)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ value: "" })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Option
            </Button>
        </div>
    );
}

// Dialog for filling out a form
function FillFormDialog({ isOpen, onClose, form }: { isOpen: boolean, onClose: () => void, form: FormType | null }) {
    const { toast } = useToast();

    // Dynamically build the Zod schema and default values from the form questions
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
                        fieldSchema = fieldSchema.optional();
                    }
                    defaults[q.id] = "";
                    break;
                case 'checkbox':
                     fieldSchema = z.array(z.string());
                     if (q.required) {
                        fieldSchema = fieldSchema.nonempty(`${q.label} is required.`);
                     } else {
                        fieldSchema = fieldSchema.optional();
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
        defaultValues: defaultValues,
    });

     useEffect(() => {
        responseForm.reset(defaultValues);
    }, [form, defaultValues, responseForm]);


    if (!form) return null;

    const handleResponseSubmit = (values: z.infer<typeof formSchema>) => {
        console.log("Form Response Submitted:", {
            formId: form.id,
            submittedBy: localStorage.getItem('userItsId') || 'unknown',
            responses: values,
        });
        toast({ title: "Response Submitted", description: "Thank you for filling out the form!" });
        onClose();
        responseForm.reset();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{form.title}</DialogTitle>
                    <DialogDescription>{form.description}</DialogDescription>
                </DialogHeader>
                <UIForm {...responseForm}>
                    <form onSubmit={responseForm.handleSubmit(handleResponseSubmit)} className="flex-1 overflow-y-auto space-y-6 pr-6">
                        {form.questions.map(question => (
                             <FormField
                                key={question.id}
                                control={responseForm.control}
                                name={question.id}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold">{question.label} {question.required && <span className="text-destructive">*</span>}</FormLabel>
                                        <FormControl>
                                            <div>
                                                {question.type === 'text' && <Input {...field} />}
                                                {question.type === 'textarea' && <Textarea {...field} />}
                                                {question.type === 'radio' && (
                                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
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
                                                        <SelectTrigger><SelectValue placeholder={`Select an option`} /></SelectTrigger>
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
                                                                    return (
                                                                        <FormItem key={option} className="flex flex-row items-start space-x-3 space-y-0">
                                                                            <FormControl>
                                                                                <Checkbox
                                                                                    checked={(checkboxField.value as string[] | undefined)?.includes(option)}
                                                                                    onCheckedChange={(checked) => {
                                                                                        const currentValue = (checkboxField.value as string[] | undefined) || [];
                                                                                        return checked
                                                                                            ? checkboxField.onChange([...currentValue, option])
                                                                                            : checkboxField.onChange(currentValue.filter(v => v !== option));
                                                                                    }}
                                                                                />
                                                                            </FormControl>
                                                                            <FormLabel className="text-sm font-normal">{option}</FormLabel>
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
                    </form>
                </UIForm>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" onClick={responseForm.handleSubmit(handleResponseSubmit)}>
                        Submit Response
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    