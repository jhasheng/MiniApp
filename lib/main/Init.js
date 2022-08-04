'use strict'

const path = require('path');
const { app, BrowserWindow, ipcMain, Menu } = require('electron');

const messageProxy = require('./Message.js');

const createWorker = () => {
    const worker = new BrowserWindow({
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '..', 'worker', 'WorkerPreload.js'),
        }
    });
    
    worker.loadFile(path.join(__dirname, '..', 'public', 'worker', 'worker.html'));

    messageProxy.createPageAfterWorker(worker);
}

const createWebview = () => {
    Menu.buildFromTemplate(null);
    const webview = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    webview.loadFile(path.join(__dirname, '..', 'public', 'root', 'root.html'));
    return webview;
};

const appInit = () => {
    app.whenReady().then(() => {

        createWorker();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWebview();
        });

    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit()
    });
}

module.exports = {
    createWebview,
    appInit
}
