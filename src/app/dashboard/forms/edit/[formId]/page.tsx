
"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form as UIForm } from "@/components/ui/form";
import { PlusCircle, Trash2, GripVertical, Loader2, ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getForm, updateForm } from "@/lib/firebase/formService";
import type { Form as FormType } from "@/types";

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

export default function EditFormPage() {
    const router = useRouter();
    const params = useParams();
    const formId = params.formId as string;
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);

    const formBuilder = useForm<FormBuilderValues>({
        resolver: zodResolver(formBuilderSchema),
        defaultValues: {
            title: "",
            description: "",
            questions: [],
        },
    });

    useEffect(() => {
        if (!formId) return;
        const fetchFormData = async () => {
            setIsLoading(true);
            try {
                const formToEdit = await getForm(formId);
                if (formToEdit) {
                    formBuilder.reset({
                        title: formToEdit.title,
                        description: formToEdit.description || "",
                        questions: formToEdit.questions.map(q => ({
                            id: q.id,
                            label: q.label,
                            type: q.type,
                            required: q.required,
                            options: q.options ? q.options.map(opt => ({ value: opt })) : []
                        }))
                    });
                } else {
                    toast({ title: "Error", description: "Form not found.", variant: "destructive" });
                    router.push('/dashboard/forms');
                }
            } catch (error) {
                console.error("Failed to fetch form:", error);
                toast({ title: "Error", description: "Could not load the form for editing.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchFormData();
    }, [formId, formBuilder, router, toast]);

    const { fields, append, remove } = useFieldArray({
        control: formBuilder.control,
        name: "questions",
    });

    const handleUpdateFormSubmit = async (values: FormBuilderValues) => {
        try {
            const updatedFormPayload = {
                title: values.title,
                description: values.description || "",
                questions: values.questions.map(q => ({
                    id: q.id || crypto.randomUUID(), // Keep existing ID or generate new one
                    label: q.label,
                    type: q.type,
                    required: q.required,
                    options: q.options?.map(opt => opt.value)
                })),
            };

            await updateForm(formId, updatedFormPayload);
            
            toast({ title: "Form Updated!", description: `"${values.title}" has been successfully updated.` });
            router.push('/dashboard/forms');
        } catch (error) {
            console.error("Failed to update form:", error);
            toast({ title: "Error", description: "Failed to save the updated form.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading form builder...</p>
            </div>
        );
    }
    
    return (
        <UIForm {...formBuilder}>
            <form onSubmit={formBuilder.handleSubmit(handleUpdateFormSubmit)} className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Button type="button" variant="outline" onClick={() => router.push('/dashboard/forms')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forms
                    </Button>
                    <Button type="submit" disabled={formBuilder.formState.isSubmitting} className="w-full sm:w-auto">
                        {formBuilder.formState.isSubmitting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Changes
                    </Button>
                </div>
                
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Edit Form</CardTitle>
                        <CardDescription>
                            Modify the title, description, and questions for your form.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="form-title">Form Title</Label>
                            <Input id="form-title" {...formBuilder.register("title")} />
                            {formBuilder.formState.errors.title && <p className="text-sm text-destructive">{formBuilder.formState.errors.title.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="form-description">Description</Label>
                            <Textarea id="form-description" {...formBuilder.register("description")} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-lg">
                     <CardHeader>
                        <CardTitle>Questions</CardTitle>
                        <CardDescription>
                            Add, remove, or edit the questions for your form.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {fields.map((field, index) => {
                            const questionType = formBuilder.watch(`questions.${index}.type`);
                            return (
                                <Card key={field.id} className="p-4 bg-muted/50 relative">
                                    <div className="flex gap-2 sm:gap-4">
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
                                                <Input {...formBuilder.register(`questions.${index}.label`)} />
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
                    </CardContent>
                </Card>
            </form>
        </UIForm>
    );
}

function OptionsArray({ control, nestIndex }: { control: any, nestIndex: number }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `questions.${nestIndex}.options`
    });

    return (
        <div className="space-y-3 pt-2 pl-2 sm:pl-6 border-l-2 ml-2">
            <Label className="font-semibold">Options</Label>
            {fields.map((item, k) => (
                <div key={item.id} className="flex items-center gap-2">
                    <Input
                        {...control.register(`questions.${nestIndex}.options.${k}.value`)}
                        placeholder={`Option ${k + 1}`}
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(k)}>
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
