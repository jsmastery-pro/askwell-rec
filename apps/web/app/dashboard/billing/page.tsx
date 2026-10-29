import { EmptyState } from "../../../components/ui";

export default function BillingPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Billing</h1>
      <EmptyState
        title="Billing is not set up yet"
        text="Your plan and invoices will appear here. Billing comes in Phase 5."
      />
    </>
  );
}
