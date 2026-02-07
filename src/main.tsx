import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { editorStore } from "./store/editor-store";

// Initialize store settings from disk
editorStore.initialize();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
