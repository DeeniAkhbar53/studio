
import type { Metadata } from 'next';
import { getForm } from "@/lib/firebase/formService";
import ViewResponsesClientPage from './client-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ formId: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const form = await getForm(resolvedParams.formId);
  const title = form ? `Responses for ${form.title}` : "Form Responses";
  return {
    title: title,
    description: `View and manage responses for the form: ${form?.title || 'Unknown Form'}`,
  };
}

export default function ViewResponsesPage() {
    return <ViewResponsesClientPage />;
}
