"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ConfirmInterestPage({ params }: { params: { notificationId: string } }) {
  const searchParams = useSearchParams();
  const status = searchParams?.get("status");
  
  if (status === "success") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8f9fa",
        fontFamily: "Arial, sans-serif"
      }}>
        <div style={{
          maxWidth: "600px",
          width: "90%",
          padding: "40px",
          backgroundColor: "white",
          borderRadius: "10px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "64px", marginBottom: "20px" }}>✅</div>
          <h1 style={{ fontSize: "28px", color: "#28a745", marginBottom: "20px" }}>
            Dziękuję za potwierdzenie!
          </h1>
          <p style={{ fontSize: "16px", color: "#666" }}>
            Powodzenia z nowym kontaktem 😊
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f8f9fa",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        maxWidth: "600px",
        width: "90%",
        padding: "40px",
        backgroundColor: "white",
        borderRadius: "10px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>⏳</div>
        <h1 style={{ fontSize: "28px", color: "#007bff", marginBottom: "20px" }}>
          Potwierdzanie...
        </h1>
        <p style={{ fontSize: "16px", color: "#666" }}>
          Proszę czekać
        </p>
      </div>
    </div>
  );
}

