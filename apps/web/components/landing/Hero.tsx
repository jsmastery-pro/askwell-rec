import { APP_NAME } from "@askwell/shared";
import { Button } from "../ui";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-24 sm:pt-32"
    >
      <p className="motion-enter rounded-full border border-line bg-glass px-3 py-1 text-xs text-fg-muted backdrop-blur-glass">
        {APP_NAME}: AI support chat for any website
      </p>
      <h1
        id="hero-title"
        className="motion-enter mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl"
        style={{ "--motion-delay": "80ms" } as React.CSSProperties}
      >
        Answer your visitors&apos; questions before they ask your team
      </h1>
      <p
        className="motion-enter mt-6 max-w-xl text-base text-fg-muted sm:text-lg"
        style={{ "--motion-delay": "160ms" } as React.CSSProperties}
      >
        Upload your docs, paste one script tag, and {APP_NAME} answers from what you wrote. It says
        &quot;I don&apos;t know&quot; when the answer isn&apos;t there.
      </p>
      <div
        className="motion-enter mt-10 flex flex-col gap-3 sm:flex-row"
        style={{ "--motion-delay": "240ms" } as React.CSSProperties}
      >
        <Button href="/sign-up">Start free</Button>
        <Button href="#how-it-works" variant="secondary">
          See how it works
        </Button>
      </div>
    </section>
  );
}
