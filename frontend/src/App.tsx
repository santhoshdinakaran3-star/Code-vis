import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Play, Code2, ChevronDown, Zap, BookOpen } from 'lucide-react';
import CodeEditor from './components/CodeEditor';
import VisualizationCanvas from './components/VisualizationCanvas';
import ExecutionControls from './components/ExecutionControls';
import OutputPanel from './components/OutputPanel';
import {
  setSteps, setStatus, setOutput, setError, setLanguage, reset
} from './store/visualizationSlice';
import type { Language } from './store/visualizationSlice';
import { RootState, AppDispatch } from './store/store';

// ── Sample snippets per language ──────────────────────────────
const SAMPLES: Record<Language, Record<string, string>> = {
  javascript: {
    'Hello World': `let message = "Hello, World!";\nconsole.log(message);`,
    'Sum Loop': `let sum = 0;\nfor (let i = 1; i <= 5; i++) {\n  sum = sum + i;\n  console.log("i=" + i + " sum=" + sum);\n}\nconsole.log("Total:", sum);`,
    'Fibonacci': `function fib(n) {\n  if (n <= 1) return n;\n  return fib(n - 1) + fib(n - 2);\n}\nlet result = fib(6);\nconsole.log("fib(6) =", result);`,
    'Bubble Sort': `let arr = [64, 34, 25, 12, 22, 11, 90];\nfor (let i = 0; i < arr.length - 1; i++) {\n  for (let j = 0; j < arr.length - i - 1; j++) {\n    if (arr[j] > arr[j+1]) {\n      let temp = arr[j];\n      arr[j] = arr[j+1];\n      arr[j+1] = temp;\n    }\n  }\n}\nconsole.log("Sorted:", arr.join(", "));`,
  },
  python: {
    'Hello World': `message = "Hello, World!"\nprint(message)`,
    'Sum Loop': `total = 0\nfor i in range(1, 6):\n    total = total + i\n    print(f"i={i} total={total}")\nprint("Total:", total)`,
    'Fibonacci': `def fib(n):\n    if n <= 1:\n        return n\n    return fib(n-1) + fib(n-2)\n\nresult = fib(6)\nprint(f"fib(6) = {result}")`,
    'Bubble Sort': `arr = [64, 34, 25, 12, 22]\nfor i in range(len(arr)-1):\n    for j in range(len(arr)-i-1):\n        if arr[j] > arr[j+1]:\n            arr[j], arr[j+1] = arr[j+1], arr[j]\nprint("Sorted:", arr)`,
    'List Ops': `nums = [3, 1, 4, 1, 5, 9, 2, 6]\nresult = []\nfor n in nums:\n    if n > 3:\n        result.append(n * 2)\nprint(result)`,
  },
  java: {
    'Hello World': `System.out.println("Hello, World!");\nint x = 42;\nSystem.out.println("x = " + x);`,
    'Sum Loop': `int sum = 0;\nfor (int i = 1; i <= 5; i++) {\n    sum += i;\n    System.out.println("i=" + i + " sum=" + sum);\n}\nSystem.out.println("Total: " + sum);`,
    'Fibonacci': `int a = 0, b = 1;\nSystem.out.println(a);\nSystem.out.println(b);\nfor (int i = 0; i < 6; i++) {\n    int c = a + b;\n    System.out.println(c);\n    a = b;\n    b = c;\n}`,
    'Array Sort': `int[] arr = {64, 34, 25, 12, 22};\nfor (int i = 0; i < arr.length - 1; i++) {\n    for (int j = 0; j < arr.length - i - 1; j++) {\n        if (arr[j] > arr[j+1]) {\n            int temp = arr[j];\n            arr[j] = arr[j+1];\n            arr[j+1] = temp;\n        }\n    }\n}\nfor (int x : arr) System.out.print(x + " ");\nSystem.out.println();`,
  },
};

const LANGUAGE_CONFIG: Record<Language, { label: string; color: string; ext: string }> = {
  javascript: { label: 'JavaScript', color: '#f0db4f', ext: '.js' },
  python: { label: 'Python', color: '#4b8bbe', ext: '.py' },
  java: { label: 'Java', color: '#f89820', ext: '.java' },
};

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { status, currentStep, steps, language, errorLine } = useSelector((s: RootState) => s.visualization);
  const [code, setCode] = useState<string>(SAMPLES.javascript['Hello World']);
  const [showSamples, setShowSamples] = useState(false);

  const highlightLine = steps[currentStep]?.line;

  const handleLanguageChange = useCallback((lang: Language) => {
    dispatch(setLanguage(lang));
    const firstSample = Object.values(SAMPLES[lang])[0];
    setCode(firstSample);
    setShowSamples(false);
  }, [dispatch]);

  const handleSampleSelect = useCallback((sampleCode: string) => {
    setCode(sampleCode);
    dispatch(reset());
    setShowSamples(false);
  }, [dispatch]);

  const handleRunCode = useCallback(async () => {
    if (status === 'loading') return;
    dispatch(reset());
    dispatch(setStatus('loading'));

    try {
      const response = await fetch('http://localhost:3000/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await response.json();

      if (data.success) {
        dispatch(setSteps(data.steps ?? []));
        dispatch(setOutput(data.output ?? ''));
        dispatch(setStatus('paused'));
      } else {
        dispatch(setError({ error: data.error ?? 'Unknown error', errorLine: data.errorLine }));
        dispatch(setOutput(data.output ?? ''));
      }
    } catch (err: any) {
      dispatch(setError({
        error: `Cannot connect to backend at localhost:3000.\nMake sure the backend server is running.\n\n${err.message}`,
      }));
    }
  }, [code, language, status, dispatch]);

  const isLoading = status === 'loading';
  const langCfg = LANGUAGE_CONFIG[language];
  const currentSamples = SAMPLES[language];

  return (
    <div className="flex flex-col h-screen bg-[#0d0d1a] text-white overflow-hidden">

      {/* ── Header ──────────────────────────────────── */}
      <header className="h-14 flex items-center px-4 gap-3 border-b border-gray-800/80 bg-[#0f0f23] shrink-0 z-10">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Code2 size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Code-Vis
          </span>
        </div>

        {/* Language selector */}
        <div className="ml-3 flex gap-1 p-1 bg-gray-800/60 rounded-lg border border-gray-700/50">
          {(Object.keys(LANGUAGE_CONFIG) as Language[]).map(lang => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${language === lang
                  ? 'bg-gray-700 text-white shadow-inner'
                  : 'text-gray-400 hover:text-gray-200'
                }`}
              style={language === lang ? { color: LANGUAGE_CONFIG[lang].color } : {}}
            >
              {LANGUAGE_CONFIG[lang].label}
            </button>
          ))}
        </div>

        {/* Sample snippets dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSamples(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-800/60 border border-gray-700/50 hover:bg-gray-700/60 transition-colors"
          >
            <BookOpen size={13} />
            Samples
            <ChevronDown size={12} className={`transition-transform ${showSamples ? 'rotate-180' : ''}`} />
          </button>

          {showSamples && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full mt-1 left-0 bg-[#1a1a35] border border-gray-700/60 rounded-xl shadow-2xl z-50 min-w-[160px] overflow-hidden"
            >
              {Object.entries(currentSamples).map(([name, sampleCode]) => (
                <button
                  key={name}
                  onClick={() => handleSampleSelect(sampleCode)}
                  className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-gray-700/60 hover:text-white transition-colors border-b border-gray-800/50 last:border-0"
                >
                  {name}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Run button */}
        <div className="ml-auto">
          <button
            onClick={handleRunCode}
            disabled={isLoading}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${isLoading
                ? 'bg-gray-700 text-gray-400 cursor-wait'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-blue-500/30 hover:shadow-blue-500/50 active:scale-95'
              }`}
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-white"
                />
                Running…
              </>
            ) : (
              <>
                <Zap size={14} />
                Run Code
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Main workspace ───────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Editor + Output */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-800/60">
          {/* Tab bar */}
          <div className="flex items-center px-3 py-1 bg-[#11112a] border-b border-gray-800/60 text-xs text-gray-400 shrink-0">
            <span className="px-3 py-1.5 bg-[#1e1e3f] text-gray-200 rounded-t-md border-b-2 border-blue-500 font-mono">
              main{langCfg.ext}
            </span>
          </div>

          {/* Monaco editor */}
          <div className="flex-1 min-h-0 p-2">
            <CodeEditor
              code={code}
              onChange={val => setCode(val ?? '')}
              language={language}
              highlightLine={highlightLine}
              errorLine={errorLine}
            />
          </div>

          {/* Output panel */}
          <div className="h-36 shrink-0 px-2 pb-2">
            <OutputPanel />
          </div>

          {/* Execution controls */}
          <ExecutionControls />
        </div>

        {/* RIGHT: Visualization */}
        <div className="w-80 xl:w-96 shrink-0 flex flex-col bg-[#0d0d1f] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#11112a] border-b border-gray-800/60 shrink-0">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Visualization
            </span>
            {steps.length > 0 && (
              <span className="ml-auto text-[10px] text-gray-600 font-mono">
                line {highlightLine ?? '—'}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <VisualizationCanvas />
          </div>
        </div>
      </div>

      {/* ── Status bar ──────────────────────────────── */}
      <footer className="h-6 flex items-center px-4 gap-4 bg-blue-700/80 text-white text-[10px] font-mono shrink-0">
        <span className={`flex items-center gap-1 ${status === 'error' ? 'text-red-300' :
            status === 'done' ? 'text-green-300' :
              status === 'playing' ? 'text-amber-300' :
                'text-white'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'loading' || status === 'playing' ? 'bg-amber-400 animate-pulse' :
              status === 'error' ? 'bg-red-400' :
                status === 'done' ? 'bg-green-400' :
                  'bg-gray-400'
            }`} />
          {status === 'idle' ? 'Ready' :
            status === 'loading' ? 'Executing…' :
              status === 'paused' ? 'Paused' :
                status === 'playing' ? 'Playing' :
                  status === 'done' ? 'Done' :
                    status === 'error' ? 'Error' : status}
        </span>
        <span className="opacity-60">|</span>
        <span>{LANGUAGE_CONFIG[language].label}</span>
        {steps.length > 0 && (
          <>
            <span className="opacity-60">|</span>
            <span>{steps.length} steps traced</span>
          </>
        )}
        <span className="ml-auto opacity-60">Code-Vis v2.0</span>
      </footer>
    </div>
  );
}

export default App;
