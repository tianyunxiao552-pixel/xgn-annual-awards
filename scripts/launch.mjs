import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const port = Number(process.env.XGN_LAUNCH_PORT || 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid XGN port');
const address = `http://127.0.0.1:${port}/`;

async function running() {
  try {
    const response = await fetch(`${address}api/session`, { signal: AbortSignal.timeout(1200) });
    const session = await response.json();
    return response.ok && typeof session.authenticated === 'boolean' && typeof session.setup === 'boolean';
  } catch { return false; }
}

function openBrowser() {
  console.log(`XGN: ${address}`);
  if (process.env.XGN_LAUNCH_NO_OPEN === '1') return;
  const opener = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start', '', address], { windowsHide: true, stdio: 'ignore' })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [address], { stdio: 'ignore' });
  opener.on('error', () => console.error(`Please open ${address} in your browser.`));
}

async function runNpm(command) {
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', `npm ${command}`], { cwd: root, stdio: 'inherit', windowsHide: true })
    : spawn('npm', command.split(' '), { cwd: root, stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`npm ${command} failed (${code})`)));
  });
}

async function launch() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Please install Node.js 24 or newer.');
  if (await running()) {
    console.log('XGN is already running. Opening the website.');
    openBrowser();
    return;
  }
  if (!existsSync('dist/client/index.html')) {
    if (!existsSync('node_modules')) await runNpm('ci');
    await runNpm('run build');
  }
  console.log('Starting XGN. Keep this window open while using the website.');
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
  });
  let exited = false;
  child.once('error', e => { exited = true; console.error(e.message); process.exitCode = 1; });
  child.once('exit', code => { exited = true; if (code) process.exitCode = code; });
  const stop = () => { if (!exited) child.kill(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  for (let attempt = 0; attempt < 40 && !exited; attempt++) {
    if (await running()) { openBrowser(); return; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  stop();
  throw new Error(`XGN could not start at ${address}. Check the error above or whether the port is occupied.`);
}

launch().catch(e => { console.error(`\nXGN startup failed: ${e.message}`); process.exitCode = 1; });
