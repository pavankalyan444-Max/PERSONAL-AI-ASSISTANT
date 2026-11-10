const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbitDesktop', {
  isDesktop: true,
  platform: process.platform,
  minimizeToTray: () => ipcRenderer.send('orbit:minimize-tray'),
  notify: (title, body) => ipcRenderer.send('orbit:notify', { title, body }),
  getSystemMetrics: () => ipcRenderer.invoke('orbit:get-metrics'),
  openExternal: (url) => ipcRenderer.send('orbit:open-external', url),
  setStartOnBoot: (enable) => ipcRenderer.send('orbit:set-boot', enable),
});
