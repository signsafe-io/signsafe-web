export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            SignSafe
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            AI-powered contract risk analysis
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
