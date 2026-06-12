
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image"; // Import next/image

export default function LoginPage() {
  return (
    <main className="premium-shell flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      <div className="flex items-center justify-center w-full max-w-md my-8">
        <Card className="w-full overflow-hidden glass-surface border-white/20 shadow-md">
          <CardHeader className="relative px-8 pb-5 pt-8 text-center">
            <div className="mx-auto mb-4 flex justify-center items-center">
              <Image
                src="/logo.png"
                alt="BGK Attendance Logo"
                width={64}
                height={64}
                className="h-16 w-16"
              />
            </div>
            <CardTitle>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">BGK Attendance</h3>
            </CardTitle>
            <CardDescription className="pt-1 text-muted-foreground text-xs">
              Sign in with your ITS ID
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

