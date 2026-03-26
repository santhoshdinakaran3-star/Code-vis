import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { Terminal } from 'lucide-react';

const OutputPanel: React.FC = () => {
    const { steps, currentStep, output, status, error } = useSelector(
        (s: RootState) => s.visualization
    );
    const bottomRef = useRef<HTMLDivElement>(null);

    // Accumulate stdout up to current step
    const accumulatedOutput = React.useMemo(() => {
        if (steps.length === 0) return '';
        const lines: string[] = [];
        for (let i = 0; i <= currentStep; i++) {
            const step = steps[i];
            if (step?.stdout) lines.push(step.stdout);
        }
        return lines.join('');
    }, [steps, currentStep]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [accumulatedOutput]);

    const displayOutput = status === 'idle' ? '' : (steps.length > 0 ? accumulatedOutput : output);

    return (
        <div className="flex flex-col h-full bg-[#0d0d1a] border border-gray-700/50 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#13132b] border-b border-gray-700/50">
                <Terminal size={14} className="text-green-400" />
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Output</span>
                {displayOutput && (
                    <span className="ml-auto text-[10px] text-gray-500 font-mono">
                        {displayOutput.split('\n').filter(Boolean).length} line(s)
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto p-3 font-mono text-sm">
                {error && status === 'error' ? (
                    <div className="text-red-400 whitespace-pre-wrap">
                        <span className="text-red-500 font-bold">Error: </span>{error}
                    </div>
                ) : displayOutput ? (
                    <pre className="text-green-300 whitespace-pre-wrap leading-relaxed">
                        {displayOutput}
                    </pre>
                ) : (
                    <p className="text-gray-600 italic text-xs">
                        {status === 'loading' ? 'Running...' : 'Run code to see output here'}
                    </p>
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default OutputPanel;
