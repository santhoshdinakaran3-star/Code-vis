import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { TracerResult, ExecutionStep } from './jsTracer.js';

/**
 * Java tracer strategy:
 * 1. Detect or wrap the user code in a class with a main method
 * 2. Inject System.err.println("__TRACE|line|varJSON") before key statements
 * 3. Compile with javac, run with java
 * 4. Parse __TRACE lines from stderr into ExecutionStep[]
 */

function extractClassName(code: string): string | null {
    const match = code.match(/public\s+class\s+(\w+)/);
    return match ? match[1] : null;
}

function wrapInClass(code: string): { code: string; className: string } {
    // If code already has a class, use it as-is
    const existing = extractClassName(code);
    if (existing) return { code, className: existing };

    // Otherwise wrap in a Main class
    const wrapped = `
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        ${code}
    }
}
`;
    return { code: wrapped, className: 'Main' };
}

function instrumentJava(code: string): { instrumented: string; lineMap: number[] } {
    const lines = code.split('\n');
    const lineMap: number[] = [];
    const instrumented: string[] = [];
    let braceDepth = 0;
    let inMainMethod = false;
    let inComment = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNo = i + 1;

        // Track block comments
        if (trimmed.startsWith('/*')) inComment = true;
        if (trimmed.includes('*/')) inComment = false;
        if (inComment || trimmed.startsWith('//') || trimmed === '') {
            instrumented.push(line);
            continue;
        }

        // Count braces
        for (const ch of line) {
            if (ch === '{') braceDepth++;
            if (ch === '}') braceDepth--;
        }

        // Inject trace before executable statements (depth >= 2 = inside class.method)
        if (braceDepth >= 2 && !trimmed.startsWith('{') && !trimmed.startsWith('}')
            && !trimmed.startsWith('public') && !trimmed.startsWith('private')
            && !trimmed.startsWith('protected') && !trimmed.startsWith('class')
            && !trimmed.startsWith('import') && !trimmed.endsWith('{')
            && !trimmed.startsWith('@')) {
            // Emit a trace marker via stderr
            instrumented.push(`        System.err.println("__TRACE|${lineNo}|{}");`);
            lineMap.push(lineNo);
        }

        instrumented.push(line);
    }

    return { instrumented: instrumented.join('\n'), lineMap };
}

export async function runJavaTracer(code: string): Promise<TracerResult> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codevis-java-'));

    try {
        const { code: wrapped, className } = wrapInClass(code);
        const { instrumented } = instrumentJava(wrapped);

        const javaFile = path.join(tmpDir, `${className}.java`);
        await fs.writeFile(javaFile, instrumented, 'utf-8');

        // Compile
        const compileResult = await runProcess('javac', [javaFile], { cwd: tmpDir, timeout: 10000 });
        if (compileResult.exitCode !== 0) {
            const errMsg = compileResult.stderr;
            // Parse javac error line
            const lineMatch = errMsg.match(/:(\d+):/);
            return {
                success: false,
                steps: [],
                output: '',
                error: `Compile Error:\n${errMsg}`,
                errorLine: lineMatch ? parseInt(lineMatch[1]) : undefined,
            };
        }

        // Run
        const runResult = await runProcess('java', ['-cp', tmpDir, className], {
            cwd: tmpDir,
            timeout: 10000,
            input: '',
        });

        const steps = parseJavaTrace(runResult.stderr, wrapped);
        const output = runResult.stdout;

        if (runResult.exitCode !== 0 && steps.length === 0) {
            return {
                success: false,
                steps,
                output,
                error: runResult.stderr || `Java exited with code ${runResult.exitCode}`,
            };
        }

        // Distribute stdout across steps
        distributeStdout(steps, output);

        return { success: true, steps, output };
    } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
    }
}

function parseJavaTrace(stderr: string, code: string): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const codeLines = code.split('\n');
    const seenLines = new Set<number>();

    const traceLines = stderr.split('\n').filter(l => l.startsWith('__TRACE|'));
    for (const t of traceLines) {
        const parts = t.split('|');
        if (parts.length < 2) continue;
        const lineNo = parseInt(parts[1]);
        if (isNaN(lineNo)) continue;

        const variables: Record<string, { value: any; type: string }> = {};
        // We can't easily get variables without JDWP; show line content as context
        const lineContent = codeLines[lineNo - 1]?.trim() || '';

        steps.push({
            line: lineNo,
            variables,
            stdout: '',
            callStack: [{ funcName: 'main', line: lineNo }],
            event: 'line',
        });
    }

    // Deduplicate consecutive same-line steps but keep all for loop iterations
    return steps;
}

function distributeStdout(steps: ExecutionStep[], output: string) {
    if (steps.length === 0 || !output) return;
    const outputLines = output.split('\n').filter(l => l !== '');
    let outIdx = 0;
    for (const step of steps) {
        if (outIdx < outputLines.length) {
            step.stdout = outputLines[outIdx++] + '\n';
        }
    }
}

interface ProcessResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

function runProcess(
    cmd: string,
    args: string[],
    opts: { cwd?: string; timeout?: number; input?: string }
): Promise<ProcessResult> {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, {
            cwd: opts.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGTERM');
        }, opts.timeout ?? 10000);

        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

        proc.on('error', (err) => {
            clearTimeout(timer);
            resolve({ stdout, stderr: err.message, exitCode: -1 });
        });

        proc.on('close', (code: number | null) => {
            clearTimeout(timer);
            resolve({
                stdout,
                stderr: timedOut ? 'Execution timed out (5s)' : stderr,
                exitCode: code ?? -1,
            });
        });

        if (opts.input !== undefined) {
            proc.stdin.write(opts.input);
            proc.stdin.end();
        }
    });
}
