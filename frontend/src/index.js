import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { Toaster } from "sonner";

const rootElement = document.getElementById("root");

// Support for react-snap pre-rendering
// If the root has children (pre-rendered HTML), hydrate instead of render
if (rootElement.hasChildNodes()) {
  ReactDOM.hydrateRoot(
    rootElement,
    <React.StrictMode>
      <App />
      <Toaster position="top-right" richColors />
    </React.StrictMode>
  );
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
      <Toaster position="top-right" richColors />
    </React.StrictMode>
  );
}
