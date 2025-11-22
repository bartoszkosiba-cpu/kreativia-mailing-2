import { CompanySelectionErrorBoundary } from "./components/ErrorBoundary";

export default function CompanySelectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CompanySelectionErrorBoundary>{children}</CompanySelectionErrorBoundary>;
}

