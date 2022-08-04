'use strict';

const pathTool = require("path");
const fsTool = require("fs");
const vmTool = require("vm");

class MiniModule {
    static #cache = new Map();
    static #extFunc = new Map();
    static #wrapper = ['(function (exports, load, module, __filename, __dirname) { ', '\n});'];

    // 按需添加 node 内置模块加载列表
    static #nativeModule = ['fs', 'path', 'electron'];

    static #compileConfig = () => {
        let fileReadFunc = (filename) => {
            let content = null;
            try {
                content = fsTool.readFileSync(filename, 'utf-8');
            } catch (e) {
                throw new Error('模块加载失败 ' + e.message);
            }
            return content;
        }

        let jsFunc = (module, filename) => {
            const content = fileReadFunc(filename);
            module.#compile(content, filename);
        };

        let jsonFunc = (module, filename) => {
            const content = fileReadFunc(filename);
            module.exports = JSON.parse(content);
        };

        MiniModule.#extFunc.set('.js', jsFunc);
        MiniModule.#extFunc.set('.cjs', jsFunc);
        MiniModule.#extFunc.set('.mjs', jsFunc);

        MiniModule.#extFunc.set('.json', jsonFunc);
    }

    static #wrap = (script) => {
        return MiniModule.#wrapper[0] + script + MiniModule.#wrapper[1];
    }

    static {
        MiniModule.#compileConfig();
    }

    id = '';
    path = '';
    exports = {};
    isLoaded = false;

    constructor(id = '') {
        this.id = id;
        this.path = pathTool.dirname(id);
    }

    load = (id) => {
        return this.#loadModule(id);
    }

    #process = (filename) => {
        const extname = pathTool.extname(filename);
        const extFunc = MiniModule.#extFunc.get(extname);

        extFunc(this, filename);

        this.isLoaded = true;
    }

    #loadModule = (request) => {
        let nativeModule = this.#loadNativeModule(request);
        if(nativeModule !== null) {
            return nativeModule;
        }

        const filename = this.#resolveFilename(request);

        const cachedModule = MiniModule.#cache.get(filename);
        if(cachedModule !== undefined) {
            return cachedModule.exports;
        }

        const module = new MiniModule(filename);
        MiniModule.#cache.set(filename, module);

        module.#process(filename);
        console.debug('成功加载自定义模块 ' + request + ' 位于 ' + filename);
        return module.exports;
    }

    #loadNativeModule = (request) => {
        let nativeModule = null;
        for(let i = 0; i < MiniModule.#nativeModule.length; i++) {
            if(MiniModule.#nativeModule[i] === request) {
                nativeModule = require(request);
                console.debug('成功加载内置模块 ' + request);
                break;
            }
        }
        return nativeModule;
    }

    #resolveFilename(request) {
        const filename = pathTool.join(this.path, request);
        const extname = pathTool.extname(request);

        if(!extname) {
            for(let [key] of MiniModule.#extFunc) {
                const currentPath = `${filename}${key}`;
                if(fsTool.existsSync(currentPath)) {
                    return currentPath;
                }
            }
        }

        return filename;
    }

    #compile(content, filename) {
        const wrapper = MiniModule.#wrap(content);

        const compiledWrapper = vmTool.runInThisContext(wrapper, {
            filename,
            lineOffset: 0,
            displayErrors: true,
        });

        const dirname = pathTool.dirname(filename);

        compiledWrapper.call(this.exports, this.exports, this.load, this, filename, dirname);
    }

}

module.exports.class = MiniModule;
