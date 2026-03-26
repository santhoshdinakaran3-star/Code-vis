import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import { runJsTracer } from './tracers/jsTracer.js';
import { runPyTracer } from './tracers/pyTracer.js';
import { runJavaTracer } from './tracers/javaTracer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('New client connected via WebSocket');
    ws.on('message', (message) => {
        console.log(`WS Received: ${message}`);
    });
    ws.on('close', () => console.log('Client disconnected'));
});

app.get('/', (_req, res) => {
    res.json({
        status: 'Code-Vis API is running',
        supportedLanguages: ['javascript', 'python', 'java'],
    });
});

app.post('/execute', async (req, res) => {
    const { code, language } = req.body as { code: string; language: string };

    if (!code || !language) {
        res.status(400).json({ success: false, error: 'Missing code or language' });
        return;
    }

    if (code.length > 50_000) {
        res.status(400).json({ success: false, error: 'Code too large (max 50KB)' });
        return;
    }

    console.log(`[Execute] Language: ${language}, Code length: ${code.length}`);

    try {
        let result;

        switch (language.toLowerCase()) {
            case 'javascript':
            case 'js':
                result = await runJsTracer(code);
                break;

            case 'python':
            case 'py':
                result = await runPyTracer(code);
                break;

            case 'java':
                result = await runJavaTracer(code);
                break;

            default:
                res.status(400).json({
                    success: false,
                    error: `Language "${language}" is not supported. Supported: javascript, python, java`,
                });
                return;
        }

        res.json(result);
    } catch (err: any) {
        console.error('[Execute Error]', err);
        res.status(500).json({
            success: false,
            steps: [],
            output: '',
            error: `Internal server error: ${err.message}`,
        });
    }
});

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
    console.log(`✅ Code-Vis server running on http://localhost:${PORT}`);
    console.log(`   Supported languages: JavaScript, Python, Java`);
});
