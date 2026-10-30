export function UnlinkedNotice({ subject }: { subject: string }) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-1 border-l-4 border-plate-yellow bg-plate-yellow-soft px-4 py-3"
    >
      <span className="font-medium">Your account is not linked to a coach profile yet.</span>
      <span className="text-sm">
        Until it is, your schedule and member list stay empty. Ask an admin to add this account ID
        to your coach profile:{" "}
        <code className="rounded-sm bg-card px-1.5 py-0.5 font-mono text-xs select-all">
          {subject}
        </code>
      </span>
    </div>
  );
}
