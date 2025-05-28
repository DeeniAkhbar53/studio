
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image"; // Import next/image

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Image
              src="https://app.burhaniguards.org/images/logo.png"
              alt="BGK Attendance Logo"
              width={40} 
              height={40} 
              className="h-10 w-10" 
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
    </main>
  );
}
