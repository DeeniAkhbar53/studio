
"use client";

import { useState, useEffect } from "react";
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
import { Form as UIForm } from "@/components/ui/form";
import { PlusCircle, FileText, Loader2, ShieldAlert, Trash2, GripVertical, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, Form as FormType, FormQuestion } from "@/types";
import { addForm, getForms } from "@/lib/firebase/formService";
import { format } from "date-fns";

const formQuestionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Question text cannot be empty."),
  type: z.enum(['text', 'textarea', 'checkbox', 'radio', 'select']),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string().min(1, "Option cannot be empty.") })).optional(),
});

const formBuilderSchema = z.object({
  title: z.string().min(1, "Form title cannot be empty."),
  description: z.string().optional(),
  questions: z.array(formQuestionSchema).min(1, "A form must have at least one question."),
});

type FormBuilderValues = z.infer<typeof formBuilderSchema>;

export default function FormsPage() {
    const router = useRouter();
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [forms, setForms] = useState<FormType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

    const formBuilder = useForm<FormBuilderValues>({
        resolver: zodResolver(formBuilderSchema),
        defaultValues: {
            title: "",
            description: "",
            questions: [{ label: "", type: 'text', required: false, options: [] }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: formBuilder.control,
        name: "questions",
    });

    useEffect(() => {
        const role = typeof window !== "undefined" ? localStorage.getItem('userRole') as UserRole : null;
        setCurrentUserRole(role);
        
        const unsubscribe = getForms((fetchedForms) => {
            setForms(fetchedForms);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const canCreateForms = currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'attendance-marker';

    const handleCreateFormSubmit = async (values: FormBuilderValues) => {
        const creatorId = localStorage.getItem('userItsId');
        if (!creatorId) {
            toast({ title: "Error", description: "Could not identify creator. Please log in again.", variant: "destructive" });
            return;
        }

        try {
            const newFormPayload = {
                title: values.title,
                description: values.description || "",
                questions: values.questions.map(q => ({
                    id: crypto.randomUUID(), // Generate a unique ID for each question
                    label: q.label,
                    type: q.type,
                    required: q.required,
                    options: q.options?.map(opt => opt.value)
                })),
                createdBy: creatorId,
            };

            await addForm(newFormPayload);
            
            toast({ title: "Form Created!", description: `"${values.title}" has been successfully created and is now live.` });
            setIsCreateFormOpen(false);
            formBuilder.reset({
                title: "",
                description: "",
                questions: [{ label: "", type: 'text', required: false, options: [] }],
            });
        } catch (error) {
            console.error("Failed to create form:", error);
            toast({ title: "Error", description: "Failed to save the form to the database.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                                <UIForm {...formBuilder}>
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
                                </UIForm>
                                 <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" onClick={formBuilder.handleSubmit(handleCreateFormSubmit)} disabled={formBuilder.formState.isSubmitting}>
                                        {formBuilder.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
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
                        <div className="text-center py-10 space-y-2">
                            <FileText className="h-12 w-12 text-muted-foreground mx-auto"/>
                            <p className="text-lg font-medium text-muted-foreground">No Forms Available</p>
                            <p className="text-sm text-muted-foreground">
                                {canCreateForms ? "Create a new form to get started." : "No forms or surveys have been published yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {forms.map((form) => (
                                <Card key={form.id} className="hover:shadow-md transition-shadow flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{form.title}</CardTitle>
                                        <CardDescription>{form.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p className="flex items-center"><CheckSquare className="mr-2 h-4 w-4"/> {form.questions.length} questions</p>
                                            <p className="flex items-center"><UsersIcon className="mr-2 h-4 w-4"/> {form.responseCount || 0} responses</p>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex-col items-start gap-2 border-t pt-4">
                                        <Button className="w-full" onClick={() => router.push(`/dashboard/forms/${form.id}`)}>
                                            Fill Out Form
                                        </Button>
                                        <p className="text-xs text-muted-foreground self-center">Created on {format(new Date(form.createdAt), "MMM d, yyyy")}</p>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
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
