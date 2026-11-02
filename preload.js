const { contextBridge, ipcRenderer, webFrame } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('sf', {
  boards: invoke('boards'),
  pickFolder: invoke('pick-folder'),
  tree: invoke('tree'),
  readFile: invoke('read-file'),
  writeFile: invoke('write-file'),
  createProject: invoke('create-project'),
  changeBoard: invoke('change-board'),
  examples: invoke('examples'),
  readExample: invoke('read-example'),
  ports: invoke('ports'),
  lint: invoke('lint'),
  marketSearch: invoke('market-search'),
  marketAction: invoke('market-action'),
  extensions: invoke('extensions'),
  extensionCode: invoke('extension-code'),
  extensionInstall: invoke('extension-install'),
  extensionRemove: invoke('extension-remove'),
  extensionsFolder: invoke('extensions-folder'),
  toggleDevTools: invoke('toggle-devtools'),
  setZoom: (factor) => webFrame.setZoomFactor(factor),
  run: invoke('run'),
  stop: invoke('stop'),
  onConsole: (cb) => ipcRenderer.on('console', (_, msg) => cb(msg)),
});
