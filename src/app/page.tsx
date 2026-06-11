
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image"; // Import next/image

export default function LoginPage() {
  return (
    <main className="premium-shell flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      <div className="flex items-center justify-center w-full max-w-md my-8">
        <Card className="w-full overflow-hidden border-white/70 shadow-2xl dark:border-white/10">
          <CardHeader className="relative px-8 pb-5 pt-8 text-center">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-amber-400 to-teal-500" />
            <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-lg border border-white/60 bg-white/45 text-primary shadow-xl shadow-primary/10 backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
              <Image
                src="/logo.png"
                alt="BGK Attendance Logo"
                width={80}
                height={80}
                className="h-20 w-20"
              />
            </div>
            <CardTitle>
              <h3 className="text-3xl font-bold text-foreground">BGK Attendance</h3>
            </CardTitle>
            <CardDescription className="pt-1 text-muted-foreground">
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

