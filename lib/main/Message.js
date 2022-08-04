const path = require('path');
const {ipcMain, ipcRenderer} = require('electron');

const {createWebview} = require('./Init');

const MiniModule = require("../module/MiniModule.js");
let miniModule = new MiniModule.class(path.join(__dirname, '..', '..', 'src'));

class MessageProxy {
    worker = undefined;
    webviewList = [];

    static dynamicLoad = () => {
        ipcMain.handle('main:load', (path) => {
            return miniModule.load(path);
        })
    }

    static {
        MessageProxy.dynamicLoad();
    }

    latestWebviewIndex = () => {
        return this.webviewList.length - 1;
    }

    latestWebview = () => {
        return this.webviewList[this.latestWebviewIndex()];
    }

    createPageAfterWorker = (worker) => {
        const workerMsg = 'worker:register';

        ipcMain.on(workerMsg, (event, page) => {
            // worker 注册回复
            MessageProxy.worker = worker;
            this.worker.webContent.send(workerMsg);
            
            // 初始化首页
            this.initPage(page);
            
        });
    }

    initPage = (page) => {
        const pageId = this.latestWebviewIndex();
        const webviewMsg = 'webview:init';

        const webview = createWebview();
        MessageProxy.webviewList.push(webview);

        // webview 注册回复
        ipcMain.on(webviewMsg, () =>{
            webview.webContents.send(webviewMsg, page, pageId);
        });
    }

    renderTransfer = () => {
        const eventArr = ['createPage', 'createComponent', 'mountComponent'];

        for (let event of eventArr) {
            let arr = 'render:' + event;
            let arrReply = arr + ':reply';
            ipcMain.handle(arr, (event, args) => {
                let reply;
                this.worker.webContent.send(arrReply, args);
                ipcMain.on(arrReply, (event, args) => {
                    reply = args;
                });
                return reply;
            });
        }

        let arr = 'render:patch';
        ipcMain.on(arr, (event, args) => {
            this.latestWebview().webContent.send(arr, args);
        });
    }
}

const messageProxy = new MessageProxy();

module.exports = messageProxy;
