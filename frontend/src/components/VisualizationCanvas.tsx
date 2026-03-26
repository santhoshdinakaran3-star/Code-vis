import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { Layers, MemoryStick, Hash, AlignLeft, Box, List } from 'lucide-react';

// ── Type badge colours ──────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    int: { bg: 'bg-blue-900/60', text: 'text-blue-300', border: 'border-blue-700' },
    float: { bg: 'bg-cyan-900/60', text: 'text-cyan-300', border: 'border-cyan-700' },
    number: { bg: 'bg-blue-900/60', text: 'text-blue-300', border: 'border-blue-700' },
    str: { bg: 'bg-green-900/60', text: 'text-green-300', border: 'border-green-700' },
    string: { bg: 'bg-green-900/60', text: 'text-green-300', border: 'border-green-700' },
    bool: { bg: 'bg-orange-900/60', text: 'text-orange-300', border: 'border-orange-700' },
    boolean: { bg: 'bg-orange-900/60', text: 'text-orange-300', border: 'border-orange-700' },
    list: { bg: 'bg-purple-900/60', text: 'text-purple-300', border: 'border-purple-700' },
    array: { bg: 'bg-purple-900/60', text: 'text-purple-300', border: 'border-purple-700' },
    dict: { bg: 'bg-pink-900/60', text: 'text-pink-300', border: 'border-pink-700' },
    object: { bg: 'bg-pink-900/60', text: 'text-pink-300', border: 'border-pink-700' },
    null: { bg: 'bg-gray-800', text: 'text-gray-400', border: 'border-gray-600' },
    None: { bg: 'bg-gray-800', text: 'text-gray-400', border: 'border-gray-600' },
    undefined: { bg: 'bg-gray-800', text: 'text-gray-400', border: 'border-gray-600' },
};

const DEFAULT_COLOR = { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600' };

function getTypeIcon(type: string) {
    switch (type) {
        case 'int': case 'float': case 'number': return <Hash size={10} />;
        case 'str': case 'string': return <AlignLeft size={10} />;
        case 'bool': case 'boolean': return <Box size={10} />;
        case 'list': case 'array': return <List size={10} />;
        case 'dict': case 'object': return <MemoryStick size={10} />;
        default: return <Box size={10} />;
    }
}

function formatValue(value: any, type: string): string {
    if (value === null || value === undefined) return String(value);
    if (type === 'str' || type === 'string') return `"${String(value)}"`;
    if (Array.isArray(value)) {
        const items = value.slice(0, 6).map(v => typeof v === 'string' ? `"${v}"` : String(v));
        const suffix = value.length > 6 ? `, …+${value.length - 6}` : '';
        return `[${items.join(', ')}${suffix}]`;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value).slice(0, 4);
        const inner = entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
        const suffix = Object.keys(value).length > 4 ? ', …' : '';
        return `{${inner}${suffix}}`;
    }
    return String(value);
}

// ── Variable Card ───────────────────────────────────────────────
interface VarCardProps {
    name: string;
    value: any;
    type: string;
    changed: boolean;
}

const VarCard: React.FC<VarCardProps> = ({ name, value, type, changed }) => {
    const colors = TYPE_COLORS[type] ?? DEFAULT_COLOR;
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{
                opacity: 1, y: 0, scale: 1,
                boxShadow: changed ? '0 0 0 2px #f59e0b' : '0 0 0 1px rgba(255,255,255,0.05)',
            }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`relative rounded-xl border p-3 ${colors.bg} ${colors.border} overflow-hidden`}
        >
            {/* Changed pulse */}
            {changed && (
                <motion.div
                    className="absolute inset-0 rounded-xl"
                    animate={{ opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 0.8, repeat: 1 }}
                    style={{ background: 'rgba(245,158,11,0.15)' }}
                />
            )}

            {/* Type badge */}
            <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-bold tracking-wider uppercase ${colors.text} flex items-center gap-1`}>
                    {getTypeIcon(type)} {type}
                </span>
                {changed && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                        CHANGED
                    </span>
                )}
            </div>

            {/* Variable name */}
            <div className="text-white font-mono font-bold text-sm truncate">{name}</div>

            {/* Value */}
            <div className={`font-mono text-xs mt-1 ${colors.text} break-all line-clamp-3`}>
                {formatValue(value, type)}
            </div>
        </motion.div>
    );
};

// ── Call Stack Frame ─────────────────────────────────────────────
interface FrameProps { funcName: string; line: number; isTop: boolean; }

const StackFrame: React.FC<FrameProps> = ({ funcName, line, isTop }) => (
    <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono border ${isTop
                ? 'bg-blue-900/50 border-blue-600/60 text-blue-200'
                : 'bg-gray-800/60 border-gray-700/40 text-gray-400'
            }`}
    >
        <span className="font-semibold truncate">{funcName}()</span>
        <span className="text-[10px] opacity-60 ml-2">line {line}</span>
    </motion.div>
);

// ── Main Component ───────────────────────────────────────────────
const VisualizationCanvas: React.FC = () => {
    const { steps, currentStep, status } = useSelector((s: RootState) => s.visualization);

    const currentVars = useMemo(() => {
        if (currentStep < 0 || !steps[currentStep]) return {};
        return steps[currentStep].variables ?? {};
    }, [steps, currentStep]);

    const prevVars = useMemo(() => {
        if (currentStep <= 0 || !steps[currentStep - 1]) return {};
        return steps[currentStep - 1].variables ?? {};
    }, [steps, currentStep]);

    const callStack = useMemo(() => {
        if (currentStep < 0 || !steps[currentStep]) return [];
        return steps[currentStep].callStack ?? [];
    }, [steps, currentStep]);

    const changedKeys = useMemo(() => {
        const changed = new Set<string>();
        for (const key of Object.keys(currentVars)) {
            const prev = prevVars[key];
            const curr = currentVars[key];
            if (!prev || JSON.stringify(prev.value) !== JSON.stringify(curr.value)) {
                changed.add(key);
            }
        }
        return changed;
    }, [currentVars, prevVars]);

    // Empty state
    if (status === 'idle' || (steps.length === 0 && status !== 'loading')) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Layers size={28} className="text-white" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-lg">Visualization Canvas</h3>
                    <p className="text-gray-500 text-sm mt-1">
                        Write code and click <strong className="text-blue-400">Run</strong> to visualize execution step by step
                    </p>
                </div>
                <div className="flex gap-3 mt-2 text-xs text-gray-600">
                    <span className="px-2 py-1 bg-gray-800 rounded-full">Variables</span>
                    <span className="px-2 py-1 bg-gray-800 rounded-full">Call Stack</span>
                    <span className="px-2 py-1 bg-gray-800 rounded-full">Line Traces</span>
                </div>
            </div>
        );
    }

    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent"
                />
                <p className="text-gray-400 text-sm">Running code…</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-3 overflow-hidden p-3">

            {/* ── Variable Memory Panel ── */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2">
                    <MemoryStick size={13} className="text-purple-400" />
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Variable Memory
                    </span>
                    <span className="ml-auto text-[10px] text-gray-600 font-mono">
                        {Object.keys(currentVars).length} variable(s)
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                    {Object.keys(currentVars).length === 0 ? (
                        <p className="text-gray-600 text-xs italic text-center mt-6">
                            No variables in scope yet
                        </p>
                    ) : (
                        <motion.div layout className="grid grid-cols-1 gap-2">
                            <AnimatePresence mode="popLayout">
                                {Object.entries(currentVars).map(([name, varInfo]) => (
                                    <VarCard
                                        key={name}
                                        name={name}
                                        value={varInfo.value}
                                        type={varInfo.type}
                                        changed={changedKeys.has(name)}
                                    />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ── Call Stack Panel ── */}
            {callStack.length > 0 && (
                <div className="shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                        <Layers size={13} className="text-blue-400" />
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Call Stack
                        </span>
                        <span className="ml-auto text-[10px] text-gray-600 font-mono">
                            depth: {callStack.length}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                        <AnimatePresence>
                            {[...callStack].reverse().map((frame, i) => (
                                <StackFrame
                                    key={`${frame.funcName}-${i}`}
                                    funcName={frame.funcName}
                                    line={frame.line}
                                    isTop={i === 0}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisualizationCanvas;
