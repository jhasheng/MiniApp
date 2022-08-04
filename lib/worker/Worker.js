'use strict'

const registerMsg = 'worker:register';

const {Component, createElement} = window.context.load('../lib/webview/Component.js');

window.context.send(registerMsg, 'Index');

const componentList = new Map();

const isFuncComponent = (obj) => {
    return typeof obj === 'function' && !(obj.isClass);
}

const loadPage = (data) => {
    const path = './page/' + data.pageName;
    let page;

    try {
        page = window.load(path)
    } catch(err) {
        throw new Error(`找不到自定义页面:{data.pageName}`);
    }

    if(isFuncComponent(page)) {
        componentList.set(data.componentId, page);
        return page();
    } else {
        const pageObj = new page();
        pageObj.setId(data.pageId, data.componentId);
        componentList.set(data.componentId, pageObj);
        return pageObj.render();
    }
}

const loadComponent = (data) => {
    const path = './component/' + data.name;
    let component;

    try {
        component = window.load(path);
    } catch(err) {
        throw new Error(`找不到自定义组件:{data.name}`);
    }

    if(isFuncComponent(component)) {
        componentList.set(data.componentId, component);

        const componentVdom = component(data.props);
        return componentVdom;
    } else {
        const instance = new component(data.props);
        componentList.set(data.componentId, component);

        instance.setId(data.pageId, data.componentId);

        instance.componentWillMount();
        const componentVdom = instance.render();
        return componentVdom;
    }
}

const findComponent = (componentId) => {
    return componentList.get(componentId);
}

const registerRenderCallback = () => {
    const createPageMsg = 'render:createPage:reply';
    window.on(createPageMsg, (event, args) => {
        const vdom = loadPage(args);
        window.send(createPageMsg, vdom);
    });

    const createComponentMsg = 'render:createComponent:reply';
    window.on(createComponentMsg, (event, args) => {
        const vdom = loadComponent(args);
        window.send(createComponentMsg, vdom);
    });

    const mountComponentMsg = 'render:mountComponent:reply';
    window.on(mountComponentMsg, (event, args) => {
        const component = findComponent(data.componentId);
        if(!isFuncComponent(component)) {
            component.dom.__instance = component;
            component.dom.__key = data.key;
            component.componentDidMount();

            window.send(mountComponentMsg, component.dom);
        } else {
            throw new Error('自定义函数组件没有生命周期');
        }
    });
};

registerRenderCallback();
