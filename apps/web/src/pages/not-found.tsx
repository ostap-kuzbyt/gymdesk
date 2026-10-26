import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <section className="flex max-w-md flex-col gap-2">
      <h1>Page not found</h1>
      <p className="text-muted-foreground">
        There is nothing at this address.{" "}
        <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to Today
        </Link>
      </p>
    </section>
  );
}
