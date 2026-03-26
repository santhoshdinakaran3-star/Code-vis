import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { TracerResult } from './jsTracer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runPyTracer(code: string): Promise<TracerResult> {
    return new Promise((resolve) => {
        const scriptPath = path.join(__dirname, 'pythonTracerScript.py');

        // Try python3 first, then python
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

        const proc = spawn(pythonCmd, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 10000,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

        proc.on('error', (err) => {
            resolve({
                success: false,
                steps: [],
                output: '',
                error: `Failed to start Python: ${err.message}. Make sure Python 3 is installed and in PATH.`,
            });
        });

        proc.on('close', (code: number) => {
            if (code !== 0 && !stdout) {
                resolve({
                    success: false,
                    steps: [],
                    output: '',
                    error: stderr || `Python exited with code ${code}`,
                });
                return;
            }

            try {
                const result = JSON.parse(stdout.trim());
                resolve(result as TracerResult);
            } catch (e) {
                resolve({
                    success: false,
                    steps: [],
                    output: stdout,
                    error: `Failed to parse Python tracer output: ${stderr}`,
                });
            }
        });

        // Send user code via stdin
        proc.stdin.write(code, 'utf-8');
        proc.stdin.end();
    });
}
