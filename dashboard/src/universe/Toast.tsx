import { useEffect, useState } from "preact/hooks";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2400);
    return () => window.clearTimeout(t);
  }, [message]);

  return {
    message,
    showToast: (msg: string) => setMessage(msg),
  };
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div
      class={`universe-toast${message ? " show" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message ?? ""}
    </div>
  );
}
