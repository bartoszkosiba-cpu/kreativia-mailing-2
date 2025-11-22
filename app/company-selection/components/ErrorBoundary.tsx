"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary dla modułu company-selection
 * Przechwytuje błędy w komponentach React i wyświetla przyjazny komunikat
 */
export class CompanySelectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Loguj błąd do konsoli (w produkcji można wysłać do serwisu logowania)
    console.error("Company Selection Error Boundary:", error, errorInfo);
    
    // Wywołaj callback jeśli jest dostępny
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: "2rem",
            maxWidth: "800px",
            margin: "2rem auto",
            backgroundColor: "white",
            borderRadius: "0.75rem",
            border: "1px solid #FCA5A5",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#FEE2E2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              ⚠️
            </div>
            <div>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: "#B91C1C",
                  margin: 0,
                }}
              >
                Wystąpił błąd
              </h2>
              <p style={{ color: "#6B7280", margin: "0.25rem 0 0 0" }}>
                Coś poszło nie tak w module wyboru leadów
              </p>
            </div>
          </div>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#F9FAFB",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                overflow: "auto",
                maxHeight: "200px",
              }}
            >
              <strong style={{ color: "#B91C1C" }}>Błąd:</strong>
              <pre style={{ margin: "0.5rem 0 0 0", color: "#374151" }}>
                {this.state.error.toString()}
              </pre>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={this.handleReset}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#2563EB",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Spróbuj ponownie
            </button>
            <a
              href="/company-selection"
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#F3F4F6",
                color: "#374151",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
                textDecoration: "none",
                display: "inline-block",
                fontWeight: 500,
              }}
            >
              Wróć do głównej strony
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

