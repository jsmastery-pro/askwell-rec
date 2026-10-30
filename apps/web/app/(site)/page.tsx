import {
  Footer,
  Hero,
  HowItWorks,
  InstallSnippet,
  LiveDemo,
  Pricing,
} from "../../components/landing";

export default function Home() {
  return (
    <div data-theme="dark" className="overflow-x-clip bg-surface text-fg">
      <main>
        <Hero />
        <HowItWorks />
        <LiveDemo />
        <Pricing />
        <InstallSnippet />
      </main>
      <Footer />
    </div>
  );
}
