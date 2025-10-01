"use client";

import { useEffect, useState, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form as UIForm, FormControl, FormMessage, FormItem, FormField, FormDescription, FormLabel } from "@/components/ui/form";
import { PlusCircle, Trash2, GripVertical, Loader2, ArrowLeft, Save, Users, Search, Settings, Wrench, CalendarIcon, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getForm, updateForm } from "@/lib/firebase/formService";
import type { Form as FormType, Mohallah, User } from "@/types";
import { Separator } from "@/components/ui/separator";
import { getMohallahs } from "@/lib/firebase/mohallahService";
import { getUniqueTeamNames, getUsers } from "@/lib/firebase/userService";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";


const formQuestionSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Question text cannot be empty."),
  type: z.enum(['text', 'textarea', 'checkbox', 'radio', 'select', 'rating', 'number', 'date']),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string().min(1, "Option cannot be empty.") })).optional(),
  conditional: z.object({
    questionId: z.string(),
    value: z.string(),
  }).optional(),
});

const formBuilderSchema = z.object({
  title: z.string().min(1, "Form title cannot be empty."),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  questions: z.array(formQuestionSchema).min(1, "A form must have at least one question."),
  eligibilityType: z.enum(['groups', 'specific_members']).default('groups'),
  mohallahIds: z.array(z.string()).optional().default([]),
  teams: z.array(z.string()).optional().default([]),
  eligibleItsIds: z.array(z.string()).optional().default([]),
  endDate: z.date().optional().nullable(),
});

type FormBuilderValues = z.infer<typeof formBuilderSchema>;

export default function EditFormPage() {
    const router = useRouter();
    const params = useParams();
    const formId = params.formId as string;
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [availableMohallahs, setAvailableMohallahs] = useState<Mohallah[]>([]);
    const [availableTeams, setAvailableTeams] = useState<string[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [memberSearchTerm, setMemberSearchTerm] = useState("");
    const [isLoadingData, setIsLoadingData] = useState(true);

    const formBuilder = useForm<FormBuilderValues>({
        resolver: zodResolver(formBuilderSchema),
        defaultValues: {
            title: "",
            description: "",
            imageUrl: "",
            questions: [],
            eligibilityType: "groups",
            mohallahIds: [],
            teams: [],
            eligibleItsIds: [],
            endDate: null,
        },
    });
    
    const { fields, append, remove, move } = useFieldArray({
        control: formBuilder.control,
        name: "questions",
    });
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const mohallahsPromise = new Promise<Mohallah[]>((resolve, reject) => getMohallahs(resolve));
                const teamsPromise = getUniqueTeamNames();
                const usersPromise = getUsers();
                const [mohallahs, teams, users] = await Promise.all([mohallahsPromise, teamsPromise, usersPromise]);
                setAvailableMohallahs(mohallahs);
                setAvailableTeams(teams);
                setAllUsers(users);
            } catch (error) {
                toast({ title: "Error", description: "Could not load data for eligibility rules.", variant: "destructive" });
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, [toast]);

    const allQuestions = formBuilder.watch('questions');
    const eligibilityType = formBuilder.watch("eligibilityType");
    const imageUrl = formBuilder.watch("imageUrl");
    
    useEffect(() => {
        if (!formId) return;
        const fetchFormData = async () => {
            setIsLoading(true);
            try {
                const formToEdit = await getForm(formId);
                if (formToEdit) {
                    let type: 'groups' | 'specific_members' = 'groups';
                    if (formToEdit.eligibleItsIds && formToEdit.eligibleItsIds.length > 0) {
                        type = 'specific_members';
                    }

                    formBuilder.reset({
                        title: formToEdit.title,
                        description: formToEdit.description || "",
                        imageUrl: formToEdit.imageUrl || "",
                        questions: formToEdit.questions.map(q => ({
                            id: q.id,
                            label: q.label,
                            type: q.type,
                            required: q.required,
                            options: q.options ? q.options.map(opt => ({ value: opt })) : [],
                            conditional: q.conditional
                        })),
                        eligibilityType: type,
                        mohallahIds: formToEdit.mohallahIds || [],
                        teams: formToEdit.teams || [],
                        eligibleItsIds: formToEdit.eligibleItsIds || [],
                        endDate: formToEdit.endDate ? new Date(formToEdit.endDate) : null,
                    });
                } else {
                    toast({ title: "Error", description: "Form not found.", variant: "destructive" });
                    router.push('/dashboard/forms');
                }
            } catch (error) {
                
                toast({ title: "Error", description: "Could not load the form for editing.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchFormData();
    }, [formId, formBuilder, router, toast]);

    const handleUpdateFormSubmit = async (values: FormBuilderValues) => {
        const editorId = typeof window !== "undefined" ? localStorage.getItem('userItsId') : null;
        if (!editorId) {
            toast({ title: "Error", description: "Could not identify editor. Please log in again.", variant: "destructive" });
            return;
        }

        try {
            const updatedFormPayload = {
                title: values.title,
                description: values.description || "",
                imageUrl: values.imageUrl || "",
                questions: values.questions.map(q => {
                    const { conditional, ...restOfQuestion } = q;
                    const questionPayload: any = {
                        ...restOfQuestion,
                        options: restOfQuestion.options?.map(opt => opt.value),
                    };
                    if (conditional && conditional.questionId && conditional.value) {
                        questionPayload.conditional = conditional;
                    }
                    return questionPayload;
                }),
                updatedBy: editorId,
                mohallahIds: values.eligibilityType === 'groups' ? (values.mohallahIds || []) : [],
                teams: values.eligibilityType === 'groups' ? (values.teams || []) : [],
                eligibleItsIds: values.eligibilityType === 'specific_members' ? (values.eligibleItsIds || []) : [],
                endDate: values.endDate ? values.endDate.toISOString() : null,
            };

            await updateForm(formId, updatedFormPayload);
            
            toast({ title: "Form Updated!", description: `"${values.title}" has been successfully updated.` });
            router.push('/dashboard/forms');
        } catch (error) {
            
            toast({ title: "Error", description: "Failed to save the updated form.", variant: "destructive" });
        }
    };
    
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 700 * 1024) { // ~700KB limit
            toast({
                title: "Image too large",
                description: "Please upload an image smaller than 700KB.",
                variant: "destructive",
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            formBuilder.setValue("imageUrl", reader.result as string);
        };
        reader.onerror = () => {
             toast({
                title: "Error reading file",
                description: "Could not process the selected image.",
                variant: "destructive",
            });
        };
        reader.readAsDataURL(file);
    };

    const filteredUsers = allUsers.filter(user => {
      if (!memberSearchTerm) return true;
      return user.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || user.itsId.includes(memberSearchTerm);
    });

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-muted p-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <UIForm {...formBuilder}>
            <form onSubmit={formBuilder.handleSubmit(handleUpdateFormSubmit)}>
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b mb-6">
                    <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
                        <h2 className="text-lg font-semibold hidden md:block">
                            Form Editor
                        </h2>
                        <Button type="button" variant="outline" onClick={() => router.push('/dashboard/forms')} className="w-auto">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>
                         <div className="flex-grow"></div>
                        <Button type="submit" disabled={formBuilder.formState.isSubmitting} className="w-auto">
                            {formBuilder.formState.isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </div>

                <div className="container mx-auto px-4 space-y-6 pb-12">
                     <Tabs defaultValue="builder" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="builder"><Wrench className="mr-2 h-4 w-4" />Form Builder</TabsTrigger>
                            <TabsTrigger value="eligibility"><Settings className="mr-2 h-4 w-4" />Eligibility & Settings</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="builder" className="mt-6">
                             <div className="space-y-6">
                                <Card className="overflow-hidden">
                                    <div className="bg-primary/10 p-6 border-b-4 border-primary">
                                        <FormControl>
                                            <Input placeholder="Form Title" {...formBuilder.register("title")} className="text-3xl font-bold h-auto p-2 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent" />
                                        </FormControl>
                                        {formBuilder.formState.errors.title && <p className="text-sm text-destructive mt-2">{formBuilder.formState.errors.title.message}</p>}
                                        <FormControl>
                                            <Textarea placeholder="Form description (optional)" {...formBuilder.register("description")} className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 p-2 mt-2 bg-transparent" />
                                        </FormControl>
                                    </div>
                                     <CardContent className="p-6">
                                         <FormField
                                                control={formBuilder.control}
                                                name="imageUrl"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-sm">Cover Image (Optional)</FormLabel>
                                                    <FormControl>
                                                    <div className="flex items-center gap-4">
                                                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                                            <Upload className="mr-2 h-4 w-4"/>
                                                            Upload Image
                                                        </Button>
                                                        <Input
                                                            type="file"
                                                            className="hidden"
                                                            ref={fileInputRef}
                                                            onChange={handleImageUpload}
                                                            accept="image/png, image/jpeg, image/gif, image/webp"
                                                        />
                                                        {imageUrl && (
                                                            <div className="flex items-center gap-2">
                                                                <Image src={imageUrl} alt="Preview" width={40} height={40} className="rounded-md object-cover h-10 w-10"/>
                                                                <Button type="button" variant="ghost" size="icon" onClick={() => formBuilder.setValue("imageUrl", "")}>
                                                                    <X className="h-4 w-4 text-destructive"/>
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    </FormControl>
                                                    <FormDescription className="text-xs">Upload an image to display at the top of your form. Recommended size: under 700KB.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                    </CardContent>
                                </Card>

                                <div className="space-y-4">
                                    {fields.map((field, index) => {
                                        const questionType = formBuilder.watch(`questions.${index}.type`);
                                        return (
                                            <Card key={field.id} className="p-4 relative bg-card">
                                                <div className="flex gap-2 sm:gap-4 items-start">
                                                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0 mt-2" />
                                                    <div className="flex-grow space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <FormControl>
                                                                <Input placeholder={`Question ${index + 1}`} {...formBuilder.register(`questions.${index}.label`)} className="font-semibold text-base h-auto p-2 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                                                            </FormControl>
                                                            <div className="flex items-center gap-4">
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
                                                                                <SelectItem value="rating">Rating (1-5)</SelectItem>
                                                                                <SelectItem value="number">Number</SelectItem>
                                                                                <SelectItem value="date">Date</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    )}
                                                                />
                                                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
                                                                    <Trash2 className="h-5 w-5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        {formBuilder.formState.errors.questions?.[index]?.label && <p className="text-sm text-destructive">{formBuilder.formState.errors.questions?.[index]?.label?.message}</p>}


                                                        {(questionType === "radio" || questionType === "checkbox" || questionType === "select") && (
                                                            <OptionsArray control={formBuilder.control} nestIndex={index} />
                                                        )}
                                                        
                                                        <Separator />
                                                        <div className="flex items-center justify-end gap-4">
                                                            <ConditionalLogic
                                                                control={formBuilder.control}
                                                                watch={formBuilder.watch}
                                                                setValue={formBuilder.setValue}
                                                                index={index}
                                                                allQuestions={allQuestions}
                                                            />
                                                            <div className="flex items-center space-x-2">
                                                                <Label htmlFor={`required-${index}`}>Required</Label>
                                                                <Controller
                                                                    control={formBuilder.control}
                                                                    name={`questions.${index}.required`}
                                                                    render={({ field }) => (
                                                                        <Switch id={`required-${index}`} checked={field.value} onCheckedChange={field.onChange} />
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        )
                                    })}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => append({ id: crypto.randomUUID(), label: "", type: 'text', required: false, options: [] })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Question
                                    </Button>
                                </div>
                             </div>
                        </TabsContent>
                        <TabsContent value="eligibility" className="mt-6">
                             <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>Eligibility</CardTitle>
                                    <CardDescription>Define who can see and respond to this form. Leave all options blank to make it available to everyone.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                     <FormField control={formBuilder.control} name="endDate" render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <Label>End Date (Optional)</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full md:w-1/2 justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                                            </Popover>
                                            <FormDescription className="text-xs">The form will automatically close and stop accepting responses after this date.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                     )}/>

                                    <Separator />
                                    <FormField control={formBuilder.control} name="eligibilityType" render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
                                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="groups" /></FormControl><Label className="font-normal">By Group (Mohallah/Team)</Label></FormItem>
                                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="specific_members" /></FormControl><Label className="font-normal">By Specific Members</Label></FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}/>

                                    {isLoadingData ? <Loader2 className="animate-spin my-4"/> : (
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {eligibilityType === 'groups' && (
                                            <>
                                            <FormField control={formBuilder.control} name="mohallahIds" render={() => (
                                                <FormItem><Label>Mohallahs</Label>
                                                    <ScrollArea className="rounded-md border p-3 h-48">
                                                        {availableMohallahs.map((mohallah) => (
                                                        <FormField key={mohallah.id} control={formBuilder.control} name="mohallahIds" render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 mb-2">
                                                            <FormControl><Checkbox checked={field.value?.includes(mohallah.id)} onCheckedChange={(checked) => {
                                                                return checked ? field.onChange([...(field.value || []), mohallah.id]) : field.onChange(field.value?.filter((value) => value !== mohallah.id));
                                                            }} /></FormControl>
                                                            <Label className="font-normal text-sm">{mohallah.name}</Label>
                                                            </FormItem>
                                                        )}/>
                                                        ))}
                                                    </ScrollArea>
                                                    <FormDescription className="text-xs">Select Mohallahs. Leave empty for all.</FormDescription><FormMessage /></FormItem>
                                                )}/>
                                            <FormField control={formBuilder.control} name="teams" render={() => (
                                                <FormItem><Label>Teams</Label>
                                                    <ScrollArea className="rounded-md border p-3 h-48">
                                                        {availableTeams.map((team) => (
                                                        <FormField key={team} control={formBuilder.control} name="teams" render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 mb-2">
                                                            <FormControl><Checkbox checked={field.value?.includes(team)} onCheckedChange={(checked) => {
                                                                return checked ? field.onChange([...(field.value || []), team]) : field.onChange(field.value?.filter((value) => value !== team));
                                                            }} /></FormControl>
                                                            <Label className="font-normal text-sm">{team}</Label>
                                                            </FormItem>
                                                        )}/>
                                                        ))}
                                                    </ScrollArea>
                                                    <FormDescription className="text-xs">Select Teams. Leave empty for all.</FormDescription><FormMessage /></FormItem>
                                                )}/>
                                            </>
                                        )}
                                        {eligibilityType === 'specific_members' && (
                                            <div className="md:col-span-2">
                                            <FormField control={formBuilder.control} name="eligibleItsIds" render={() => (
                                                <FormItem>
                                                    <Label>Eligible Members</Label>
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Search by name or ITS ID..."
                                                            value={memberSearchTerm}
                                                            onChange={(e) => setMemberSearchTerm(e.target.value)}
                                                            className="pl-8 mb-2"
                                                        />
                                                    </div>
                                                    <ScrollArea className="rounded-md border p-3 h-60">
                                                    {filteredUsers.map((user) => (
                                                        <FormField key={user.id} control={formBuilder.control} name="eligibleItsIds" render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 mb-2">
                                                            <FormControl><Checkbox checked={field.value?.includes(user.itsId)} onCheckedChange={(checked) => {
                                                                return checked ? field.onChange([...(field.value || []), user.itsId]) : field.onChange(field.value?.filter((value) => value !== user.itsId));
                                                            }} /></FormControl>
                                                            <Label className="font-normal text-sm">{user.name} ({user.itsId})</Label>
                                                            </FormItem>
                                                        )}/>
                                                    ))}
                                                    {filteredUsers.length === 0 && <p className="text-center text-sm text-muted-foreground py-2">No members found.</p>}
                                                    </ScrollArea>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                            </div>
                                        )}
                                    </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
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
        <div className="space-y-3 pt-2">
            {fields.map((item, k) => (
                <div key={item.id} className="flex items-center gap-2">
                    <Input
                        {...control.register(`questions.${nestIndex}.options.${k}.value`)}
                        placeholder={`Option ${k + 1}`}
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => remove(k)}>
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


function ConditionalLogic({ control, watch, setValue, index, allQuestions }: { control: any, watch: any, setValue: any, index: number, allQuestions: any[] }) {
    const isConditional = !!watch(`questions.${index}.conditional`);

    const potentialParentQuestions = allQuestions
        .slice(0, index)
        .filter(q => (q.type === 'radio' || q.type === 'select') && q.options && q.options.length > 0);

    const selectedParentQuestionId = watch(`questions.${index}.conditional.questionId`);
    const parentQuestion = allQuestions.find(q => q.id === selectedParentQuestionId);

    const handleToggleConditional = (checked: boolean) => {
        if (checked) {
            setValue(`questions.${index}.conditional`, { questionId: '', value: '' });
        } else {
            setValue(`questions.${index}.conditional`, undefined);
        }
    };
    
    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <Label htmlFor={`conditional-switch-${index}`}>
                    Logic
                </Label>
                <Switch
                    id={`conditional-switch-${index}`}
                    checked={isConditional}
                    onCheckedChange={handleToggleConditional}
                />
            </div>
            {isConditional && potentialParentQuestions.length === 0 && <FormDescription className="text-xs text-amber-600">Add a 'Radio' or 'Dropdown' question with options *before* this one to use logic.</FormDescription>}

            {isConditional && (
                <div className="p-4 border rounded-md bg-background space-y-4 animate-in fade-in-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <Controller
                            name={`questions.${index}.conditional.questionId`}
                            control={control}
                            render={({ field }) => (
                                <FormItem>
                                    <Label>Show this question when...</Label>
                                    <Select onValueChange={(value) => {
                                        field.onChange(value);
                                        setValue(`questions.${index}.conditional.value`, ''); // Reset value when parent changes
                                    }} value={field.value} disabled={potentialParentQuestions.length === 0}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a question..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {potentialParentQuestions.map(q => (
                                                <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <Controller
                            name={`questions.${index}.conditional.value`}
                            control={control}
                            render={({ field }) => (
                                <FormItem>
                                    <Label>...equals</Label>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!parentQuestion}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={!parentQuestion ? "Select question first" : "Select an answer..."} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {parentQuestion?.options?.map((opt: {value: string}, optIndex: number) => (
                                                <SelectItem key={`${opt.value}-${optIndex}`} value={opt.value}>
                                                    {opt.value}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
