
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image"; // Import next/image

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-20">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Image
              src="/logo.png"
              alt="BGK Attendance Logo"
              width={64}
              height={64}
              className="h-16 w-16"
            />
          </div>
          <CardTitle>
            <h3 className="text-3xl font-bold text-foreground">BGK Attendance</h3>
          </CardTitle>
          <CardDescription className="text-muted-foreground pt-1">
            Sign in with your ITS ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
