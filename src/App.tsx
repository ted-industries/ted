import Editor from "@monaco-editor/react";
import "./App.css";

function App() {
  return (
    <div className="editor-container">
      <Editor
        defaultLanguage="typescript"
        defaultValue="// Welcome to ted"
        theme="vs-dark"
      />
    </div>
  );
}

export default App;
