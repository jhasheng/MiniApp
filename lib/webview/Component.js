'use strict'

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const { data } = require('./Page.js');
const { patch, render } = require('./Render.js');

const root = document.getElementById('root');

const isFuncComponent = (obj) => {
    return typeof obj === 'function' && !(obj.isClass);
}

const isOfficialName = (name) => {
    for (let official of data.officialComponent) {
        if (official === name) {
            return true;
        }
    }
    return false;
}

const isOfficial = (type) => {
    for(let {_, component} of data.officialComponent) {
        if(isFuncComponent(component)) {
            if(type === component) {
                return true;
            }
        } else {
            if(type === component.constructor) {
                return true;
            }
        }
    }
    return false;
}

// 检查所有的原生组件
const initOfficial = () => {
    const componentPath = path.join(__dirname, '..', 'component');
    fs.readdirSync(componentPath, (err, files) => {
        if (err) {
            console.warn(err);
            console.debug('无法检索原生组件');
        }
        else {
            files.forEach((filename) => {
                const componentName = filename.split('.')[0];
                let component = require('../component/' + componentName);
                data.officialComponent.push({componentName, component});
            })
        }
    });
}

const loadPage = (name) => {
    // 原生组件
    if (isOfficialName(name)) {
        let page;
        try {
            page = require('../component/' + name);
            data.componentId++;
        } catch (err) {
            throw new Error('无法加载原生组件');
        }

        if (isFuncComponent(page)) {
            render(page(), root);
        } else {
            const pageInstance = new page();
            render(pageInstance.render(), root);
        }
    } 
    // 非原生组件
    else {
        const pageVdom = ipcRenderer.invoke(
            'render:createPage', {
                pageName: name,
                pageId: data.pageId,
                componentId: data.componentId,
            }
        );
        data.componentId++;
        render(pageVdom, root);
    }
}

const createElement = (type, props, ...children) => {
    if (props === null) {
        props = {};
    }

    return {
        type,
        props,
        children
    };
}

class Component {
    static isClass = true;

    constructor(props) {
        this.props = props || {};
        this.state = null;
        this.webviewId = null;
        this.componentId = null;
    }

    setId(webviewId, componentId) {
        this.webviewId = webviewId;
        this.componentId = componentId;
    }

    setState(nextState) {
        this.state = Object.assign(this.state, nextState);
        // 仅在更新时
        if (this.dom && this.shouldComponentUpdate(this.props, nextState)) {
            if (window.sandbox) {
                ipcRenderer.send('render:patch', {dom:this.dom, vdom:this.render()});
            } else {
                patch(this.dom, this.render());
            }
        }
        // 首次渲染时不 patch
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps != this.props || nextState != this.state;
    }

    componentWillMount() { }

    componentDidMount() { }

    componentWillReceiveProps() { }

    componentWillUnmount() { }

    render() {return null;}
}

module.exports = { 
    Component, 
    createElement, 
    initOfficial, 
    isOfficial,
    loadPage 
};
