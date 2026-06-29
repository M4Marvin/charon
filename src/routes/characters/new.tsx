import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { fileToBase64, useImportCharacter } from "@/hooks/useCharacters";

export const Route = createFileRoute("/characters/new")({
  component: NewCharacterPage,
});

function NewCharacterPage() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const isDemo = session?.user?.role !== "admin";

  useEffect(() => {
    if (session && isDemo) {
      void navigate({ to: "/characters" });
    }
  }, [session, isDemo, navigate]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[]>([]);
  const importMutation = useImportCharacter();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setError(null);
    setFieldErrors([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a PNG file.");
      return;
    }
    setError(null);
    setFieldErrors([]);

    let pngBase64: string;
    try {
      pngBase64 = await fileToBase64(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      return;
    }

    const result = await importMutation.mutateAsync({ pngBase64 });
    if (result.ok) {
      void navigate({ to: "/characters" });
    } else {
      if (result.error.kind === "validation") {
        setFieldErrors(result.error.errors);
      } else {
        setError(result.error.message);
      }
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/characters">← Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Character</CardTitle>
          <CardDescription>
            Upload a V2 PNG character card. The avatar and metadata will be extracted automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="png" className="mb-2 block text-sm font-medium">
                Character card PNG
              </label>
              <input
                id="png"
                type="file"
                accept="image/png"
                onChange={handleFileChange}
                disabled={importMutation.isPending}
                className="border-input bg-background text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80 block w-full rounded-md border px-3 py-2"
              />
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            {fieldErrors.length > 0 ? (
              <ul className="text-destructive space-y-1 text-sm">
                {fieldErrors.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{e.field || "(root)"}</span>: {e.message}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button asChild variant="ghost" type="button">
                <Link to="/characters">Cancel</Link>
              </Button>
              <Button type="submit" disabled={!file || importMutation.isPending}>
                {importMutation.isPending ? "Importing..." : "Import"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
