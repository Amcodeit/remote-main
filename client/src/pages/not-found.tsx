import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl border-border/50">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
          </div>

          <p className="mt-4 text-muted-foreground">
            The page you are looking for doesn't exist or has been moved.
          </p>

          <div className="mt-6 flex justify-end">
            <Link href="/">
              <Button>Return Home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
