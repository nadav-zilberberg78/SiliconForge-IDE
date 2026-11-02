// Arduino's "1200 bps touch": opening a native-USB board's port at 1200 baud and dropping DTR resets it into its
// bootloader (Leonardo, Micro) or programming mode (Nano Every). Manifests list it as the step TOUCH_STEP, which the IDE
// runs itself because the bootloader can come back on a different port that the following steps must use.
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const { promisify } = require('node:util');

const TOUCH_STEP = 'touch-1200';
const exec = promisify(execFile);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function listPorts() {
  if (process.platform === 'win32') {
    const { stdout } = await exec('powershell', ['-NoProfile', '-Command', '[System.IO.Ports.SerialPort]::GetPortNames()']);
    return stdout.split(/\r?\n/).filter(Boolean);
  }
  return fs.readdirSync('/dev').filter((n) => /^(ttyACM|ttyUSB|cu\.usbmodem|cu\.usbserial)/.test(n)).map((n) => `/dev/${n}`);
}

async function touch(port) {
  if (process.platform !== 'win32') return exec('stty', [process.platform === 'darwin' ? '-f' : '-F', port, '1200']);
  // the port goes in through the environment so it is never parsed as PowerShell code
  const script = '$p = New-Object System.IO.Ports.SerialPort $env:SF_PORT, 1200; $p.DtrEnable = $true; $p.Open(); $p.DtrEnable = $false; $p.Close()';
  return exec('powershell', ['-NoProfile', '-Command', script], { env: { ...process.env, SF_PORT: port } });
}

// Returns the port to upload to: the one the board re-enumerates as, or `port` when it does not reset (a USB bridge
// keeps its port) or is not there to touch (already in the bootloader after pressing reset).
async function resetToBootloader(port, { list = listPorts, poke = touch, sleep = pause, timeoutMs = 10000 } = {}) {
  const before = await list();
  if (!before.includes(port)) return port;
  await poke(port);
  let left = false;
  for (let t = 0; t < timeoutMs; t += 250) {
    await sleep(250);
    const now = await list();
    const fresh = now.find((p) => !before.includes(p));
    if (fresh) return fresh;
    if (!now.includes(port)) left = true;
    else if (left || t >= 1500) return port; // came back under the same name, or never reset
  }
  return port;
}

module.exports = { TOUCH_STEP, resetToBootloader };
