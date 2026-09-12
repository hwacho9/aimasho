import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Explicit demo values take precedence over .env.local. The production build
// output and a developer's existing port 3000 server are left untouched.
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3007'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'inherit',
  env: {
    ...process.env,
    AIMASHO_E2E: 'true',
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR: 'true',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-test-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-aimasho-e2e.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-aimasho-e2e',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-aimasho-e2e.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:e2e',
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: '',
    NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY: '',
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
