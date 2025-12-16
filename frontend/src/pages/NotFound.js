// src/pages/NotFound.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="text-center my-12" style={{ padding: 24 }}>
      <h1 className="text-3xl mb-4" >404 - Page Not Found</h1>
      <p className="text-xl mb-4">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/" className="text-xl">Go to Home</Link>
    </div>
  );
}