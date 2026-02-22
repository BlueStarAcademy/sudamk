const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getGnuGoMove: (request) => ipcRenderer.invoke('gnugo-move', request),
    isGnuGoAvailable: () => ipcRenderer.invoke('gnugo-available'),
});
