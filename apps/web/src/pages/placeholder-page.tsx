export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h1>{title}</h1>
      <p className="text-muted-foreground">This page is being built.</p>
    </section>
  );
}
