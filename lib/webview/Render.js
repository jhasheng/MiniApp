'use strict'

const { ipcRenderer } = require('electron');
const { data } = require('./Page.js');
const { Component, isOfficial } = require('./Component.js');

const isTextVdom = (vdom) => {
    return typeof vdom == 'string' || typeof vdom == 'number';
}

const isElementVdom = (vdom) => {
    return typeof vdom == 'object' && typeof vdom.type == 'string';
}

const isComponentVdom = (vdom) => {
    return typeof vdom.type == 'function';
}

const isEventListenerAttr = (key, value) => {
    return typeof value == 'function' && key.startsWith('on');
}

const isStyleAttr = (key, value) => {
    return key == 'style' && typeof value == 'object';
}

const isPlainAttr = (key, value) => {
    return typeof value != 'object' && typeof value != 'function';
}

const isRefAttr = (key, value) => {
    return key === 'x-ref' && typeof value == 'function';
}

const mount = (parent) => {
    if (parent) {
        return el => parent.appendChild(el);
    } else {
        return el => el;
    }
}

const setAttribute = (dom, key, value) => {
    // 事件回调
    if (isEventListenerAttr(key, value)) {
        const eventType = key.slice(2).toLowerCase();
        dom.__handlers = dom.__handlers || {};
        dom.removeEventListener(eventType, dom.__handlers[eventType]);
        dom.__handlers[eventType] = value;
        dom.addEventListener(eventType, dom.__handlers[eventType]);
    }
    // 常用特殊属性
    else if (key == 'checked' || key == 'value' || key == 'className') {
        dom[key] = value;
    }
    // patch 标识符
    else if (key == 'key') {
        dom.__key = value;
    }
    // ref 函数
    else if (isRefAttr(key, value)) {
        value(dom);
    }
    // 样式 
    else if (isStyleAttr(key, value)) {
        Object.assign(dom.style, value);
    }
    // 普通属性
    else if (isPlainAttr(key, value)) {
        dom.setAttribute(key, value);
    }
}

const renderComponent = (vdom, parent) => {
    const props = Object.assign({}, vdom.props, { children: vdom.children });

    // x-if 渲染控制
    const dslIf = findDslIf(vdom.props);
    if (dslIf && dslIf.value === false) {
        return;
    }

    // 类组件
    if (vdom.type instanceof Component) {
        // 原生类组件
        if (isOfficial(vdom.type)) {
            // 新建类实例
            const instance = new vdom.type(vdom.props);

            // 生命周期函数 加载前
            instance.componentWillMount();

            // 获取类模板 vdom 结果
            const componentVdom = instance.render();

            // 记录 vdom 树与对应的实例
            instance.dom = render(componentVdom, parent);
            instance.dom.__instance = instance;
            instance.dom.__key = vdom.props.key;

            // 生命周期函数 加载后
            instance.componentDidMount();

            data.componentId++;
            return instance.dom;
        }
        // 自定义类组件
        else {
            const componentVdom = ipcRenderer.invoke(
                'render:createComponent', {
                    props: vdom.props,
                    name: vdom.type.name,
                    pageId: data.pageId,
                    componentId: data.componentId,
                }
            );
            
            const dom = render(componentVdom, parent);

            ipcRenderer.invoke('render:mountComponent', {
                key: vdom.props.key,
                componentId: data.componentId,
            });

            data.componentId++;
            return dom;
        }

    }
    // 函数组件
    else {
        // 原生函数组件
        if(isOfficial(vdom.type)) {
            // 调用函数获取类模板
            const componentVdom = vdom.type(props);
            data.componentId++;
            return render(componentVdom, parent);
        } 
        // 非原生函数组件
        else {
            const componentVdom = ipcRenderer.invoke(
                'render:createComponent', {
                    props: vdom.props,
                    name: vdom.type.name,
                    pageId: data.pageId,
                    componentId: data.componentId,
                }
            );
            data.componentId++;
            return render(componentVdom, parent);
        }
    }
}

const findDslIf = (props) => {
    let i = 0;
    for (const prop in props) {
        if (prop.startsWith('x-if')) {
            const value = props[prop];
            let result;

            if (typeof value === 'function') {
                value() ? result = true : result = false;
            } else {
                value ? result = true : result = false;
            }
            return { index: i, value: result };
        }
        i++;
    }
    return undefined;
}


const render = (vdom, parent = null) => {
    // 文字节点
    if (isTextVdom(vdom)) {
        return mount(document.createTextNode(vdom));
    }
    // 元素节点
    else if (isElementVdom(vdom)) {
        const dom = mount(document.createElement(vdom.type));

        const children = new Array();
        children.concat(...vdom.children);

        // vue3 最新文档 if 优先级高于 for
        // 处理 x-if 标签
        const dslIf = findDslIf(vdom.props);
        if (dslIf && dslIf.value === false) {
            return dom;
        }

        for (const prop in vdom.props) {
            setAttribute(dom, prop, vdom.props[prop]);
        }

        for (const child of children) {
            render(child, dom);
        }

        return dom;
    }
    // 组件节点
    else if (isComponentVdom(vdom)) {
        renderComponent(vdom, parent);
    }
    else {
        throw new Error(`Invalid vDOML ${vdom}.`);
    }
}

const patch = (dom, vdom, parent = dom.parentNode) => {
    const replace = parent ?
        el => {
            parent.replaceChild(el, dom);
            return el;
        } :
        (el => el);

    // 文本更新
    if (dom instanceof Text) {
        if (typeof vdom === 'object') {
            return replace(render(vdom, parent));
        } else {
            return dom.textContent != vdom ? replace(render(vdom, parent)) : dom;
        }
    }
    // 组件更新
    else if (isComponentVdom(vdom)) {
        const props = Object.assign({}, vdom.props, { children: vdom.children });
        // 同组件渲染 更新子元素
        if (dom.__instance && dom.constructor == vdom.type) {
            dom.__instance.componentWillReceiveProps(props);
            return patch(dom, dom.__instance.render(), parent);
        }
        // 替换类组件
        else if (vdom.type instanceof Component) {
            const componentDom = renderComponent(vdom, parent);
            if (parent) {
                parent.replaceChild(componentDom, dom);
                return componentDom;
            } else {

                return componentDom;
            }
        }
        // 替换函数组件
        else if (!(vdom.type instanceof Component)) {
            return patch(dom, vdom.type(props), parent);
        }
    }
    // 元素更新
    else {
        // 不同类型元素
        if (dom.nodeName !== vdom.type.toUpperCase() && typeof vdom === 'object') {
            return replace(render(vdom, parent));
        }
        // 同类型元素
        else if (dom.nodeName === vdom.type.toUpperCase() && typeof vdom === 'object') {
            const active = document.activeElement;
            const oldDoms = {};
            // 根据 DOM 填充对象
            [].concat(...dom.childNodes).map((child, index) => {
                const key = child.__key || `__index_${index}`;
                oldDoms[key] = child;
            });

            // 对比 vDom 进行渲染
            [].concat(...vdom.children).map((child, index) => {
                const key = child.props && child.props.key || `__index_${index}`;
                // 区分首次渲染与更新渲染
                dom.appendChild(oldDoms[key] ? patch(oldDoms[key], child) : render(child, dom));
                delete oldDoms[key];
            });

            for (const key in oldDoms) {
                const instance = oldDoms[key].__instance;
                if (instance) {
                    // 生命周期函数 即将卸载
                    instance.componentWillUnmount();
                }
                oldDoms[key].remove();
            }

            for (const attr of dom.attributes) {
                dom.removeAttribute(attr.name);
            }

            for (const prop in vdom.props) {
                setAttribute(dom, prop, vdom.props[prop]);
            }

            active.focus();

            return dom;
        }
    }
}

module.exports = { render, patch };
