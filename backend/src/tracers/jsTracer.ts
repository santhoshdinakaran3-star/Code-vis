import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import _generate from '@babel/generator';
import * as vm from 'vm';

// ESM/CJS interop fix
const traverse = (_traverse as any).default ?? _traverse;
const generate = (_generate as any).default ?? _generate;

export interface ExecutionStep {
    line: number;
    variables: Record<string, { value: any; type: string }>;
    stdout: string;
    callStack: Array<{ funcName: string; line: number }>;
    event: string;
}

export interface TracerResult {
    success: boolean;
    steps: ExecutionStep[];
    output: string;
    error?: string;
    errorLine?: number;
}

function getType(v: any): string {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
}

function safeSerialize(v: any, depth = 0): any {
    if (depth > 3) return '[deep]';
    if (v === null || v === undefined) return v;
    if (typeof v === 'function') return '[Function]';
    if (typeof v === 'bigint') return v.toString();
    if (Array.isArray(v)) return v.slice(0, 20).map(i => safeSerialize(i, depth + 1));
    if (typeof v === 'object') {
        const out: Record<string, any> = {};
        let count = 0;
        for (const key of Object.keys(v)) {
            if (count++ > 20) { out['...'] = 'truncated'; break; }
            try { out[key] = safeSerialize(v[key], depth + 1); } catch { out[key] = '?'; }
        }
        return out;
    }
    return v;
}

export async function runJsTracer(code: string): Promise<TracerResult> {
    let ast: parser.ParseResult<t.File>;
    try {
        ast = parser.parse(code, {
            sourceType: 'script',
            plugins: [],
            errorRecovery: false,
        });
    } catch (e: any) {
        return { success: false, steps: [], output: '', error: e.message, errorLine: e.loc?.line };
    }

    // Collect all statement line numbers for scope variable finding
    const stmtLines: number[] = [];
    traverse(ast, {
        Statement(path: any) {
            if (path.node.loc) stmtLines.push(path.node.loc.start.line);
        }
    });

    // Instrument: inject __trace(line, localVarNames, localVarValues) before each statement
    traverse(ast, {
        ExpressionStatement(path: any) { injectTrace(path); },
        VariableDeclaration(path: any) { injectTrace(path); },
        ReturnStatement(path: any) { injectTrace(path); },
        IfStatement(path: any) { injectTrace(path); },
        ForStatement(path: any) { injectTrace(path); },
        WhileStatement(path: any) { injectTrace(path); },
        ForOfStatement(path: any) { injectTrace(path); },
        ForInStatement(path: any) { injectTrace(path); },
        AssignmentExpression(path: any) {
            // handled via ExpressionStatement parent
        },
        ThrowStatement(path: any) { injectTrace(path); },
    });

    function injectTrace(path: any) {
        const loc = path.node.loc;
        if (!loc) return;
        const lineNo = loc.start.line;
        // Build a snapshot expression: snapshot of all bindings in scope
        const traceCall = t.expressionStatement(
            t.callExpression(t.identifier('__trace'), [
                t.numericLiteral(lineNo),
                t.callExpression(
                    t.memberExpression(t.identifier('__getLocals'), t.identifier('call')),
                    [t.thisExpression()]
                )
            ])
        );
        try {
            path.insertBefore(traceCall);
        } catch (_) { }
    }

    let instrumented: string;
    try {
        instrumented = generate(ast, { retainLines: false }, code).code;
    } catch (e: any) {
        // Fallback: use original code with a simpler approach
        instrumented = code;
    }

    const steps: ExecutionStep[] = [];
    let fullOutput = '';
    let stepOutput = '';
    const callStack: Array<{ funcName: string; line: number }> = [{ funcName: 'main', line: 1 }];

    function __trace(line: number, locals: Record<string, any>) {
        const variables: Record<string, { value: any; type: string }> = {};
        for (const [k, v] of Object.entries(locals)) {
            if (k.startsWith('__')) continue;
            try {
                variables[k] = { value: safeSerialize(v), type: getType(v) };
            } catch {
                variables[k] = { value: '?', type: 'unknown' };
            }
        }
        steps.push({
            line,
            variables,
            stdout: stepOutput,
            callStack: [...callStack],
            event: 'line',
        });
        stepOutput = '';
    }

    // __getLocals is tricky - we'll use a proxy approach instead
    // Build a simpler instrumented version using a different strategy:
    // Wrap in a with-statement style approach using a Proxy scope object
    const wrappedCode = `
(function() {
  "use strict";
  var __locals = {};
  var __getLocals = function() { return Object.assign({}, __locals); };
  ${instrumented}
})();
`;

    const sandbox = {
        __trace,
        __getLocals: () => ({}),
        console: {
            log: (...args: any[]) => {
                const out = args.map(a => {
                    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); }
                }).join(' ') + '\n';
                stepOutput += out;
                fullOutput += out;
            },
            error: (...args: any[]) => {
                const out = args.map(String).join(' ') + '\n';
                stepOutput += out;
                fullOutput += out;
            },
            warn: (...args: any[]) => {
                const out = args.map(String).join(' ') + '\n';
                stepOutput += out;
                fullOutput += out;
            }
        },
        Math, JSON, parseInt, parseFloat, isNaN, isFinite, String, Number, Boolean, Array, Object,
        setTimeout: undefined, setInterval: undefined, fetch: undefined,
        require: undefined, process: undefined, __dirname: undefined, __filename: undefined,
    };

    try {
        const script = new vm.Script(wrappedCode, { filename: 'usercode.js' });
        const context = vm.createContext(sandbox);
        script.runInContext(context, { timeout: 5000 });
    } catch (e: any) {
        const lineMatch = e.stack?.match(/:(\d+):/);
        const errorLine = e.lineNumber || (lineMatch ? parseInt(lineMatch[1]) : undefined);
        if (steps.length === 0) {
            return { success: false, steps: [], output: fullOutput, error: e.message, errorLine };
        }
        return {
            success: false, steps, output: fullOutput,
            error: e.message, errorLine,
        };
    }

    // Post-process: if __trace was never called (instrumentation failed), do manual line stepping
    if (steps.length === 0) {
        return runJsFallback(code);
    }

    return { success: true, steps, output: fullOutput };
}

// Fallback: simple line-by-line execution snapshot without AST (runs whole code, captures final state)
function runJsFallback(code: string): TracerResult {
    const steps: ExecutionStep[] = [];
    let fullOutput = '';
    const lines = code.split('\n');
    let accumulated = '';
    const sandbox: any = {
        console: {
            log: (...args: any[]) => {
                const s = args.map(String).join(' ') + '\n';
                fullOutput += s;
                accumulated += s;
            }
        },
        Math, JSON, parseInt, parseFloat, isNaN, isFinite,
        String, Number, Boolean, Array, Object,
    };

    // Execute each line cumulatively to get state snapshots
    for (let i = 0; i < lines.length; i++) {
        const lineNo = i + 1;
        const partialCode = lines.slice(0, lineNo).join('\n');
        const prevAcc = accumulated;
        accumulated = '';
        try {
            const ctx = vm.createContext({ ...sandbox });
            new vm.Script(partialCode).runInContext(ctx, { timeout: 2000 });
            const vars: Record<string, { value: any; type: string }> = {};
            for (const [k, v] of Object.entries(ctx)) {
                if (['console', 'Math', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'String', 'Number', 'Boolean', 'Array', 'Object'].includes(k)) continue;
                try { vars[k] = { value: safeSerialize(v), type: getType(v) }; } catch { vars[k] = { value: '?', type: 'unknown' }; }
            }
            steps.push({ line: lineNo, variables: vars, stdout: accumulated, callStack: [{ funcName: 'main', line: lineNo }], event: 'line' });
        } catch {
            steps.push({ line: lineNo, variables: {}, stdout: accumulated, callStack: [{ funcName: 'main', line: lineNo }], event: 'line' });
        }
    }

    return { success: true, steps, output: fullOutput };
}
