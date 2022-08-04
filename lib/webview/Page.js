'use strict'

const { ipcRenderer } = require('electron');
const {render, patch} = require('./Render.js');
const {initOfficial, loadPage} = require('./Component.js');

const data = {
    officialComponent: [],
    componentId: 0,
};

const patchCallback = (pageId) => {
    ipcRenderer.on('render:patch', (event, args) => {
        patch(args.dom, args.vdom);
    });
}

const initPage = () => {
    const initMsg = 'webview:init';
    initOfficial();

    ipcRenderer.send(initMsg);

    ipcRenderer.on(initMsg, (event, page, pageId) => {
        window.sandbox = false;
        data.page = page;
        data.pageId = pageId;

        patchCallback();
        loadPage(page);
    });
};

initPage();

module.exports = {data};
