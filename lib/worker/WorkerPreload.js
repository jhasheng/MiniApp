const { contextBridge, ipcRenderer } = require('electron');

const workerRegisterHandler = () => {

    contextBridge.exposeInMainWorld('context', {
        load: (path) => ipcRenderer.invoke('main:load', path),
        sandbox: true,
        send: ipcRenderer.send,
        on: ipcRenderer.on,
    });

    const registerMsg = 'worker:register';
    ipcRenderer.on(registerMsg, () => {
        console.log('worker registered.');
    });
}

workerRegisterHandler();
