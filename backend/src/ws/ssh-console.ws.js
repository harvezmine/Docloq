// Authenticated WebSocket↔ssh2 bridge (mounted only when SSH_CONSOLE_ENABLED).
// Auth: single-use gate ticket + optional TOTP + SSH password (sent once, never stored/logged).
import { WebSocketServer } from 'ws';
import ssh2 from 'ssh2';
import * as svc from '../services/ssh-console.service.js';

const WS_PATH = '/api/superadmin/ssh';
const clientIp = (req) =>
  ((req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

export function attachSshConsole(server) {
  if (!svc.isEnabled()) {
    console.log('[SSH] web console disabled (SSH_CONSOLE_ENABLED != true or host/user unset)');
    return;
  }
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://x').pathname; } catch { pathname = ''; }
    if (pathname !== WS_PATH) return; // not ours — leave for any other handler

    const ip = clientIp(req);
    const url = new URL(req.url, 'http://x');
    const ticket = url.searchParams.get('ticket');

    if (svc.isLocked(ip)) return reject(socket, 429, 'locked');
    if (!svc.consumeTicket(ticket, ip)) {
      svc.auditSsh('ssh_console_denied', 'SSH console upgrade denied (bad/expired ticket)', { ip });
      return reject(socket, 401, 'unauthorized');
    }
    wss.handleUpgrade(req, socket, head, (ws) => handleConn(ws, ip));
  });

  console.log(`[SSH] web console ENABLED → ${WS_PATH} (target ${svc.cfg().user}@${svc.cfg().host}:${svc.cfg().port})`);
}

function reject(socket, code, msg) {
  try { socket.write(`HTTP/1.1 ${code} ${msg}\r\n\r\n`); } catch { /* ignore */ }
  socket.destroy();
}

function handleConn(ws, ip) {
  const c = svc.cfg();
  let ssh = null, stream = null, idleTimer = null, maxTimer = null;
  let authed = false, gotFirst = false, acquired = false;

  const send = (o) => { try { ws.send(JSON.stringify(o)); } catch { /* ignore */ } };
  const closeAll = (reason) => {
    clearTimeout(idleTimer); clearTimeout(maxTimer); clearTimeout(firstTimer);
    try { stream?.end(); } catch { /* ignore */ }
    try { ssh?.end(); } catch { /* ignore */ }
    try { ws.close(); } catch { /* ignore */ }
    if (acquired) { svc.release(); acquired = false; }
    if (authed) { authed = false; svc.auditSsh('ssh_console_close', 'SSH console session closed', { ip, reason }); }
  };
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { send({ type: 'exit', reason: 'idle-timeout' }); closeAll('idle'); }, c.idleMs);
  };

  // Must send the connect frame quickly, else drop.
  const firstTimer = setTimeout(() => { if (!gotFirst) { send({ type: 'error', message: 'no connect frame' }); closeAll('no-connect'); } }, 15000);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'connect' && !gotFirst) {
      gotFirst = true; clearTimeout(firstTimer);
      // (Gate + email-OTP were already verified at ticket issuance; the ticket proves it.)
      if (svc.isLocked(ip)) { send({ type: 'error', message: 'temporarily locked' }); return closeAll('locked'); }
      if (!svc.allowOpen(ip)) { send({ type: 'error', message: 'rate limited' }); return closeAll('rate'); }
      if (!svc.acquire()) { send({ type: 'error', message: 'a session is already active' }); return closeAll('busy'); }
      acquired = true;

      send({ type: 'status', message: `connecting ${c.user}@${c.host}…` });
      ssh = new ssh2.Client();
      ssh.on('ready', () => {
        authed = true; svc.clearFails(ip);
        svc.auditSsh('ssh_console_open', 'SSH console session opened', { ip, user: c.user, host: c.host });
        ssh.shell({ term: 'xterm-256color', cols: msg.cols || 80, rows: msg.rows || 24 }, (err, s) => {
          if (err) { send({ type: 'error', message: 'shell open failed' }); return closeAll('shell-err'); }
          stream = s;
          send({ type: 'ready' });
          resetIdle();
          maxTimer = setTimeout(() => { send({ type: 'exit', reason: 'max-session' }); closeAll('max'); }, c.maxMs);
          s.on('data', (d) => { try { ws.send(d); } catch { /* ignore */ } });
          s.stderr.on('data', (d) => { try { ws.send(d); } catch { /* ignore */ } });
          s.on('close', () => { send({ type: 'exit', reason: 'shell-closed' }); closeAll('shell-closed'); });
        });
      });
      ssh.on('error', (e) => {
        if (!authed) svc.recordFail(ip); // connect / auth failure counts toward lockout
        send({ type: 'error', message: e?.level === 'client-authentication' ? 'authentication failed' : 'connection error' });
        closeAll('ssh-error');
      });

      ssh.connect({
        host: c.host,
        port: c.port,
        username: c.user,
        password: String(msg.password || ''),
        readyTimeout: c.readyTimeoutMs,
        keepaliveInterval: 15000,
        hostVerifier: (key, cbk) => {
          const r = svc.hostKeyOk(key);
          if (r.tofu) console.warn('[SSH] host-key TOFU — set SSH_CONSOLE_HOST_FINGERPRINT to pin. sha256=%s', r.hash);
          cbk(r.ok);
        },
      });
      msg.password = null; // drop our reference
      return;
    }

    if (!authed || !stream) return;
    if (msg.type === 'data') { stream.write(msg.data); resetIdle(); }
    else if (msg.type === 'resize') { try { stream.setWindow(msg.rows, msg.cols, 0, 0); } catch { /* ignore */ } }
  });

  ws.on('close', () => closeAll('ws-close'));
  ws.on('error', () => closeAll('ws-error'));
}
