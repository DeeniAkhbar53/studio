
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image"; // Import next/image

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            {/* Replace Lucide icon with Image component */}
            <Image
              src="https://app.burhaniguards.org/images/logo.png"
              alt="BGK Attendance Logo"
              width={40} // Adjust width as needed
              height={40} // Adjust height as needed
              className="h-10 w-10" // Ensure consistent sizing
            />
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">BGK Attendance</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in with your ITS or BGK ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
      <footer className="mt-8 border-t bg-card py-4 px-6 text-center text-sm text-muted-foreground w-full max-w-md">
        <p>Designed and Managed by Shabbir Shakir &copy; {new Date().getFullYear()} BGK Attendance. All rights reserved.</p>
      </footer>
    </main>
  );
}
