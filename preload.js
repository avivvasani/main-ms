const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    savePortfolioBackground: (userId, fileBase64) => 
        ipcRenderer.invoke('write-portfolio', { userId, fileBase64 })
});