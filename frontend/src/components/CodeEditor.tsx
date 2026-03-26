import React, { useCallback, useRef } from 'react';
import { Editor, OnMount, useMonaco } from '@monaco-editor/react';

interface CodeEditorProps {
    code: string;
    onChange: (value: string | undefined) => void;
    language?: string;
    highlightLine?: number;
    errorLine?: number | null;
}

const LANGUAGE_MAP: Record<string, string> = {
    javascript: 'javascript',
    python: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
};

const CodeEditor: React.FC<CodeEditorProps> = ({
    code,
    onChange,
    language = 'javascript',
    highlightLine,
    errorLine,
}) => {
    const editorRef = useRef<any>(null);
    const decorationsRef = useRef<any>(null);
    const monaco = useMonaco();

    const applyDecorations = useCallback(() => {
        const editor = editorRef.current;
        if (!editor || !monaco) return;

        const decorations: any[] = [];

        if (highlightLine && highlightLine > 0) {
            decorations.push({
                range: new monaco.Range(highlightLine, 1, highlightLine, 1),
                options: {
                    isWholeLine: true,
                    className: 'active-line-highlight',
                    glyphMarginClassName: 'active-line-glyph',
                },
            });
        }

        if (errorLine && errorLine > 0) {
            decorations.push({
                range: new monaco.Range(errorLine, 1, errorLine, 1),
                options: {
                    isWholeLine: true,
                    className: 'error-line-highlight',
                },
            });
        }

        if (decorationsRef.current) {
            decorationsRef.current.set(decorations);
        } else if (decorations.length > 0) {
            decorationsRef.current = editor.createDecorationsCollection(decorations);
        }

        if (highlightLine && highlightLine > 0) {
            editor.revealLineInCenterIfOutsideViewport(highlightLine, 0);
        }
    }, [highlightLine, errorLine, monaco]);

    React.useEffect(() => {
        applyDecorations();
    }, [applyDecorations]);

    const handleMount: OnMount = (editor) => {
        editorRef.current = editor;
        applyDecorations();
    };

    return (
        <div className="h-full w-full rounded-lg overflow-hidden border border-gray-700/60 shadow-xl bg-[#1e1e1e]">
            <style>{`
        .active-line-highlight {
          background: rgba(245, 158, 11, 0.15) !important;
          border-left: 3px solid #f59e0b !important;
        }
        .active-line-glyph::before {
          content: "▶";
          color: #f59e0b;
          font-size: 11px;
          margin-left: 2px;
        }
        .error-line-highlight {
          background: rgba(239, 68, 68, 0.18) !important;
          border-left: 3px solid #ef4444 !important;
        }
      `}</style>
            <Editor
                height="100%"
                width="100%"
                language={LANGUAGE_MAP[language] ?? language}
                value={code}
                theme="vs-dark"
                onChange={onChange}
                onMount={handleMount}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineHeight: 22,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                    automaticLayout: true,
                    glyphMargin: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'none',
                    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                    overviewRulerBorder: false,
                }}
            />
        </div>
    );
};

export default CodeEditor;
