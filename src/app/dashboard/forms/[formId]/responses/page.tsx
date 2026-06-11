
import type { Metadata } from 'next';
import { getForm } from "@/lib/firebase/formService";
import ViewResponsesClientPage from './client-page';

export async function generateMetadata({ params }: { params: { formId: string } }): Promise<Metadata> {
  const form = await getForm(params.formId);
  const title = form ? `Responses for ${form.title}` : "Form Responses";
  return {
    title: title,
    description: `View and manage responses for the form: ${form?.title || 'Unknown Form'}`,
  };
}

export default function ViewResponsesPage() {
    return <ViewResponsesClientPage />;
}
