var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./typeAcquisition", "./theme", "./compilerOptions", "./vendor/lzstring.min", "./releases", "./getInitialCode", "./twoslashSupport", "./vendor/typescript-vfs"], function (require, exports, typeAcquisition_1, theme_1, compilerOptions_1, lzstring_min_1, releases_1, getInitialCode_1, twoslashSupport_1, tsvfs) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createTypeScriptSandbox = exports.defaultPlaygroundSettings = void 0;
    lzstring_min_1 = __importDefault(lzstring_min_1);
    tsvfs = __importStar(tsvfs);
    const languageType = (config) => (config.filetype === "js" ? "javascript" : "typescript");
    // Basically android and monaco is pretty bad, this makes it less bad
    // See https://github.com/microsoft/pxt/pull/7099 for this, and the long
    // read is in https://github.com/microsoft/monaco-editor/issues/563
    const isAndroid = navigator && /android/i.test(navigator.userAgent);
    /** Default Monaco settings for playground */
    const sharedEditorOptions = {
        scrollBeyondLastLine: true,
        scrollBeyondLastColumn: 3,
        minimap: {
            enabled: false,
        },
        lightbulb: {
            enabled: true,
        },
        quickSuggestions: {
            other: !isAndroid,
            comments: !isAndroid,
            strings: !isAndroid,
        },
        acceptSuggestionOnCommitCharacter: !isAndroid,
        acceptSuggestionOnEnter: !isAndroid ? "on" : "off",
        accessibilitySupport: !isAndroid ? "on" : "off",
    };
    /** The default settings which we apply a partial over */
    function defaultPlaygroundSettings() {
        const config = {
            text: "",
            domID: "",
            compilerOptions: {},
            acquireTypes: true,
            filetype: "ts",
            supportTwoslashCompilerOptions: false,
            logger: console,
        };
        return config;
    }
    exports.defaultPlaygroundSettings = defaultPlaygroundSettings;
    function defaultFilePath(config, compilerOptions, monaco) {
        const isJSX = compilerOptions.jsx !== monaco.languages.typescript.JsxEmit.None;
        const ext = isJSX && config.filetype !== "d.ts" ? config.filetype + "x" : config.filetype;
        return "input." + ext;
    }
    /** Creates a monaco file reference, basically a fancy path */
    function createFileUri(config, compilerOptions, monaco) {
        return monaco.Uri.file(defaultFilePath(config, compilerOptions, monaco));
    }
    /** Creates a sandbox editor, and returns a set of useful functions and the editor */
    const createTypeScriptSandbox = (partialConfig, monaco, ts) => {
        const config = Object.assign(Object.assign({}, defaultPlaygroundSettings()), partialConfig);
        if (!("domID" in config) && !("elementToAppend" in config))
            throw new Error("You did not provide a domID or elementToAppend");
        const defaultText = config.suppressAutomaticallyGettingDefaultText
            ? config.text
            : (0, getInitialCode_1.getInitialCode)(config.text, document.location);
        // Defaults
        const compilerDefaults = (0, compilerOptions_1.getDefaultSandboxCompilerOptions)(config, monaco);
        // Grab the compiler flags via the query params
        let compilerOptions;
        if (!config.suppressAutomaticallyGettingCompilerFlags) {
            const params = new URLSearchParams(location.search);
            let queryParamCompilerOptions = (0, compilerOptions_1.getCompilerOptionsFromParams)(compilerDefaults, ts, params);
            if (Object.keys(queryParamCompilerOptions).length)
                config.logger.log("[Compiler] Found compiler options in query params: ", queryParamCompilerOptions);
            compilerOptions = Object.assign(Object.assign({}, compilerDefaults), queryParamCompilerOptions);
        }
        else {
            compilerOptions = compilerDefaults;
        }
        const isJSLang = config.filetype === "js";
        // Don't allow a state like allowJs = false
        if (isJSLang) {
            compilerOptions.allowJs = true;
        }
        const language = languageType(config);
        const filePath = createFileUri(config, compilerOptions, monaco);
        const element = "domID" in config ? document.getElementById(config.domID) : config.elementToAppend;
        const model = monaco.editor.createModel(defaultText, language, filePath);
        monaco.editor.defineTheme("sandbox", theme_1.sandboxTheme);
        monaco.editor.defineTheme("sandbox-dark", theme_1.sandboxThemeDark);
        monaco.editor.setTheme("sandbox");
        const monacoSettings = Object.assign({ model }, sharedEditorOptions, config.monacoSettings || {});
        const editor = monaco.editor.create(element, monacoSettings);
        const getWorker = isJSLang
            ? monaco.languages.typescript.getJavaScriptWorker
            : monaco.languages.typescript.getTypeScriptWorker;
        const defaults = isJSLang
            ? monaco.languages.typescript.javascriptDefaults
            : monaco.languages.typescript.typescriptDefaults;
        // @ts-ignore - these exist
        if (config.customTypeScriptWorkerPath && defaults.setWorkerOptions) {
            // @ts-ignore - this func must exist to have got here
            defaults.setWorkerOptions({
                customWorkerPath: config.customTypeScriptWorkerPath,
            });
        }
        defaults.setDiagnosticsOptions(Object.assign(Object.assign({}, defaults.getDiagnosticsOptions()), { noSemanticValidation: false, 
            // This is when tslib is not found
            diagnosticCodesToIgnore: [2354] }));
        // In the future it'd be good to add support for an 'add many files'
        const addLibraryToRuntime = (code, path) => {
            defaults.addExtraLib(code, path);
            const uri = monaco.Uri.file(path);
            if (monaco.editor.getModel(uri) === null) {
                monaco.editor.createModel(code, "javascript", uri);
            }
            config.logger.log(`[ATA] Adding ${path} to runtime`);
        };
        const getTwoSlashCompilerOptions = (0, twoslashSupport_1.extractTwoSlashCompilerOptions)(ts);
        // Auto-complete twoslash comments
        if (config.supportTwoslashCompilerOptions) {
            const langs = ["javascript", "typescript"];
            langs.forEach(l => monaco.languages.registerCompletionItemProvider(l, {
                triggerCharacters: ["@", "/", "-"],
                provideCompletionItems: (0, twoslashSupport_1.twoslashCompletions)(ts, monaco),
            }));
        }
        const textUpdated = () => {
            const code = editor.getModel().getValue();
            if (config.supportTwoslashCompilerOptions) {
                const configOpts = getTwoSlashCompilerOptions(code);
                updateCompilerSettings(configOpts);
            }
            if (config.acquireTypes) {
                (0, typeAcquisition_1.detectNewImportsToAcquireTypeFor)(code, addLibraryToRuntime, window.fetch.bind(window), config);
            }
        };
        // Debounced sandbox features like twoslash and type acquisition to once every second
        let debouncingTimer = false;
        editor.onDidChangeModelContent(_e => {
            if (debouncingTimer)
                return;
            debouncingTimer = true;
            setTimeout(() => {
                debouncingTimer = false;
                textUpdated();
            }, 1000);
        });
        config.logger.log("[Compiler] Set compiler options: ", compilerOptions);
        defaults.setCompilerOptions(compilerOptions);
        // To let clients plug into compiler settings changes
        let didUpdateCompilerSettings = (opts) => { };
        const updateCompilerSettings = (opts) => {
            const newKeys = Object.keys(opts);
            if (!newKeys.length)
                return;
            // Don't update a compiler setting if it's the same
            // as the current setting
            newKeys.forEach(key => {
                if (compilerOptions[key] == opts[key])
                    delete opts[key];
            });
            if (!Object.keys(opts).length)
                return;
            config.logger.log("[Compiler] Updating compiler options: ", opts);
            compilerOptions = Object.assign(Object.assign({}, compilerOptions), opts);
            defaults.setCompilerOptions(compilerOptions);
            didUpdateCompilerSettings(compilerOptions);
        };
        const updateCompilerSetting = (key, value) => {
            config.logger.log("[Compiler] Setting compiler options ", key, "to", value);
            compilerOptions[key] = value;
            defaults.setCompilerOptions(compilerOptions);
            didUpdateCompilerSettings(compilerOptions);
        };
        const setCompilerSettings = (opts) => {
            config.logger.log("[Compiler] Setting compiler options: ", opts);
            compilerOptions = opts;
            defaults.setCompilerOptions(compilerOptions);
            didUpdateCompilerSettings(compilerOptions);
        };
        const getCompilerOptions = () => {
            return compilerOptions;
        };
        const setDidUpdateCompilerSettings = (func) => {
            didUpdateCompilerSettings = func;
        };
        /** Gets the results of compiling your editor's code */
        const getEmitResult = () => __awaiter(void 0, void 0, void 0, function* () {
            const model = editor.getModel();
            const client = yield getWorkerProcess();
            return yield client.getEmitOutput(model.uri.toString());
        });
        /** Gets the JS  of compiling your editor's code */
        const getRunnableJS = () => __awaiter(void 0, void 0, void 0, function* () {
            // This isn't quite _right_ in theory, we can downlevel JS -> JS
            // but a browser is basically always esnext-y and setting allowJs and
            // checkJs does not actually give the downlevel'd .js file in the output
            // later down the line.
            if (isJSLang) {
                return getText();
            }
            const result = yield getEmitResult();
            const firstJS = result.outputFiles.find((o) => o.name.endsWith(".js") || o.name.endsWith(".jsx"));
            return (firstJS && firstJS.text) || "";
        });
        /** Gets the DTS for the JS/TS  of compiling your editor's code */
        const getDTSForCode = () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield getEmitResult();
            return result.outputFiles.find((o) => o.name.endsWith(".d.ts")).text;
        });
        const getWorkerProcess = () => __awaiter(void 0, void 0, void 0, function* () {
            const worker = yield getWorker();
            // @ts-ignore
            return yield worker(model.uri);
        });
        const getDomNode = () => editor.getDomNode();
        const getModel = () => editor.getModel();
        const getText = () => getModel().getValue();
        const setText = (text) => getModel().setValue(text);
        const setupTSVFS = (fsMapAdditions) => __awaiter(void 0, void 0, void 0, function* () {
            const fsMap = yield tsvfs.createDefaultMapFromCDN(compilerOptions, ts.version, true, ts, lzstring_min_1.default);
            fsMap.set(filePath.path, getText());
            if (fsMapAdditions) {
                fsMapAdditions.forEach((v, k) => fsMap.set(k, v));
            }
            const system = tsvfs.createSystem(fsMap);
            const host = tsvfs.createVirtualCompilerHost(system, compilerOptions, ts);
            const program = ts.createProgram({
                rootNames: [...fsMap.keys()],
                options: compilerOptions,
                host: host.compilerHost,
            });
            return {
                program,
                system,
                host,
                fsMap,
            };
        });
        /**
         * Creates a TS Program, if you're doing anything complex
         * it's likely you want setupTSVFS instead and can pull program out from that
         *
         * Warning: Runs on the main thread
         */
        const createTSProgram = () => __awaiter(void 0, void 0, void 0, function* () {
            const tsvfs = yield setupTSVFS();
            return tsvfs.program;
        });
        const getAST = () => __awaiter(void 0, void 0, void 0, function* () {
            const program = yield createTSProgram();
            program.emit();
            return program.getSourceFile(filePath.path);
        });
        // Pass along the supported releases for the playground
        const supportedVersions = releases_1.supportedReleases;
        textUpdated();
        return {
            /** The same config you passed in */
            config,
            /** A list of TypeScript versions you can use with the TypeScript sandbox */
            supportedVersions,
            /** The monaco editor instance */
            editor,
            /** Either "typescript" or "javascript" depending on your config */
            language,
            /** The outer monaco module, the result of require("monaco-editor")  */
            monaco,
            /** Gets a monaco-typescript worker, this will give you access to a language server. Note: prefer this for language server work because it happens on a webworker . */
            getWorkerProcess,
            /** A copy of require("@typescript/vfs") this can be used to quickly set up an in-memory compiler runs for ASTs, or to get complex language server results (anything above has to be serialized when passed)*/
            tsvfs,
            /** Get all the different emitted files after TypeScript is run */
            getEmitResult,
            /** Gets just the JavaScript for your sandbox, will transpile if in TS only */
            getRunnableJS,
            /** Gets the DTS output of the main code in the editor */
            getDTSForCode,
            /** The monaco-editor dom node, used for showing/hiding the editor */
            getDomNode,
            /** The model is an object which monaco uses to keep track of text in the editor. Use this to directly modify the text in the editor */
            getModel,
            /** Gets the text of the main model, which is the text in the editor */
            getText,
            /** Shortcut for setting the model's text content which would update the editor */
            setText,
            /** Gets the AST of the current text in monaco - uses `createTSProgram`, so the performance caveat applies there too */
            getAST,
            /** The module you get from require("typescript") */
            ts,
            /** Create a new Program, a TypeScript data model which represents the entire project. As well as some of the
             * primitive objects you would normally need to do work with the files.
             *
             * The first time this is called it has to download all the DTS files which is needed for an exact compiler run. Which
             * at max is about 1.5MB - after that subsequent downloads of dts lib files come from localStorage.
             *
             * Try to use this sparingly as it can be computationally expensive, at the minimum you should be using the debounced setup.
             *
             * Accepts an optional fsMap which you can use to add any files, or overwrite the default file.
             *
             * TODO: It would be good to create an easy way to have a single program instance which is updated for you
             * when the monaco model changes.
             */
            setupTSVFS,
            /** Uses the above call setupTSVFS, but only returns the program */
            createTSProgram,
            /** The Sandbox's default compiler options  */
            compilerDefaults,
            /** The Sandbox's current compiler options */
            getCompilerOptions,
            /** Replace the Sandbox's compiler options */
            setCompilerSettings,
            /** Overwrite the Sandbox's compiler options */
            updateCompilerSetting,
            /** Update a single compiler option in the SAndbox */
            updateCompilerSettings,
            /** A way to get callbacks when compiler settings have changed */
            setDidUpdateCompilerSettings,
            /** A copy of lzstring, which is used to archive/unarchive code */
            lzstring: lzstring_min_1.default,
            /** Returns compiler options found in the params of the current page */
            createURLQueryWithCompilerOptions: compilerOptions_1.createURLQueryWithCompilerOptions,
            /**
             * @deprecated Use `getTwoSlashCompilerOptions` instead.
             *
             * Returns compiler options in the source code using twoslash notation
             */
            getTwoSlashComplierOptions: getTwoSlashCompilerOptions,
            /** Returns compiler options in the source code using twoslash notation */
            getTwoSlashCompilerOptions,
            /** Gets to the current monaco-language, this is how you talk to the background webworkers */
            languageServiceDefaults: defaults,
            /** The path which represents the current file using the current compiler options */
            filepath: filePath.path,
            /** Adds a file to the vfs used by the editor */
            addLibraryToRuntime,
        };
    };
    exports.createTypeScriptSandbox = createTypeScriptSandbox;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zYW5kYm94L3NyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBc0RBLE1BQU0sWUFBWSxHQUFHLENBQUMsTUFBcUIsRUFBRSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQTtJQUV4RyxxRUFBcUU7SUFDckUsd0VBQXdFO0lBQ3hFLG1FQUFtRTtJQUNuRSxNQUFNLFNBQVMsR0FBRyxTQUFTLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUE7SUFFbkUsNkNBQTZDO0lBQzdDLE1BQU0sbUJBQW1CLEdBQWtEO1FBQ3pFLG9CQUFvQixFQUFFLElBQUk7UUFDMUIsc0JBQXNCLEVBQUUsQ0FBQztRQUN6QixPQUFPLEVBQUU7WUFDUCxPQUFPLEVBQUUsS0FBSztTQUNmO1FBQ0QsU0FBUyxFQUFFO1lBQ1QsT0FBTyxFQUFFLElBQUk7U0FDZDtRQUNELGdCQUFnQixFQUFFO1lBQ2hCLEtBQUssRUFBRSxDQUFDLFNBQVM7WUFDakIsUUFBUSxFQUFFLENBQUMsU0FBUztZQUNwQixPQUFPLEVBQUUsQ0FBQyxTQUFTO1NBQ3BCO1FBQ0QsaUNBQWlDLEVBQUUsQ0FBQyxTQUFTO1FBQzdDLHVCQUF1QixFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUs7UUFDbEQsb0JBQW9CLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSztLQUNoRCxDQUFBO0lBRUQseURBQXlEO0lBQ3pELFNBQWdCLHlCQUF5QjtRQUN2QyxNQUFNLE1BQU0sR0FBa0I7WUFDNUIsSUFBSSxF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LEVBQUUsUUFBUSxDQUFDLElBQUk7WUFDdkIsZ0RBQWdEO1lBQ2hELG1CQUFtQjtTQUNwQixDQUFBO0lBQ0gsQ0FBQyxDQUFBO0lBdlVZLFFBQUEsdUJBQXVCLDJCQXVVbkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZXRlY3ROZXdJbXBvcnRzVG9BY3F1aXJlVHlwZUZvciB9IGZyb20gXCIuL3R5cGVBY3F1aXNpdGlvblwiXG5pbXBvcnQgeyBzYW5kYm94VGhlbWUsIHNhbmRib3hUaGVtZURhcmsgfSBmcm9tIFwiLi90aGVtZVwiXG5pbXBvcnQgeyBUeXBlU2NyaXB0V29ya2VyIH0gZnJvbSBcIi4vdHNXb3JrZXJcIlxuaW1wb3J0IHtcbiAgZ2V0RGVmYXVsdFNhbmRib3hDb21waWxlck9wdGlvbnMsXG4gIGdldENvbXBpbGVyT3B0aW9uc0Zyb21QYXJhbXMsXG4gIGNyZWF0ZVVSTFF1ZXJ5V2l0aENvbXBpbGVyT3B0aW9ucyxcbn0gZnJvbSBcIi4vY29tcGlsZXJPcHRpb25zXCJcbmltcG9ydCBsenN0cmluZyBmcm9tIFwiLi92ZW5kb3IvbHpzdHJpbmcubWluXCJcbmltcG9ydCB7IHN1cHBvcnRlZFJlbGVhc2VzIH0gZnJvbSBcIi4vcmVsZWFzZXNcIlxuaW1wb3J0IHsgZ2V0SW5pdGlhbENvZGUgfSBmcm9tIFwiLi9nZXRJbml0aWFsQ29kZVwiXG5pbXBvcnQgeyBleHRyYWN0VHdvU2xhc2hDb21waWxlck9wdGlvbnMsIHR3b3NsYXNoQ29tcGxldGlvbnMgfSBmcm9tIFwiLi90d29zbGFzaFN1cHBvcnRcIlxuaW1wb3J0ICogYXMgdHN2ZnMgZnJvbSBcIi4vdmVuZG9yL3R5cGVzY3JpcHQtdmZzXCJcblxudHlwZSBDb21waWxlck9wdGlvbnMgPSBpbXBvcnQoXCJtb25hY28tZWRpdG9yXCIpLmxhbmd1YWdlcy50eXBlc2NyaXB0LkNvbXBpbGVyT3B0aW9uc1xudHlwZSBNb25hY28gPSB0eXBlb2YgaW1wb3J0KFwibW9uYWNvLWVkaXRvclwiKVxuXG4vKipcbiAqIFRoZXNlIGFyZSBzZXR0aW5ncyBmb3IgdGhlIHBsYXlncm91bmQgd2hpY2ggYXJlIHRoZSBlcXVpdmFsZW50IHRvIHByb3BzIGluIFJlYWN0XG4gKiBhbnkgY2hhbmdlcyB0byBpdCBzaG91bGQgcmVxdWlyZSBhIG5ldyBzZXR1cCBvZiB0aGUgcGxheWdyb3VuZFxuICovXG5leHBvcnQgdHlwZSBTYW5kYm94Q29uZmlnID0ge1xuICAvKiogVGhlIGRlZmF1bHQgc291cmNlIGNvZGUgZm9yIHRoZSBwbGF5Z3JvdW5kICovXG4gIHRleHQ6IHN0cmluZ1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdXNlSmF2YVNjcmlwdD86IGJvb2xlYW5cbiAgLyoqIFRoZSBkZWZhdWx0IGZpbGUgZm9yIHRoZSBwbGFheWdyb3VuZCAgKi9cbiAgZmlsZXR5cGU6IFwianNcIiB8IFwidHNcIiB8IFwiZC50c1wiXG4gIC8qKiBDb21waWxlciBvcHRpb25zIHdoaWNoIGFyZSBhdXRvbWF0aWNhbGx5IGp1c3QgZm9yd2FyZGVkIG9uICovXG4gIGNvbXBpbGVyT3B0aW9uczogQ29tcGlsZXJPcHRpb25zXG4gIC8qKiBPcHRpb25hbCBtb25hY28gc2V0dGluZ3Mgb3ZlcnJpZGVzICovXG4gIG1vbmFjb1NldHRpbmdzPzogaW1wb3J0KFwibW9uYWNvLWVkaXRvclwiKS5lZGl0b3IuSUVkaXRvck9wdGlvbnNcbiAgLyoqIEFjcXVpcmUgdHlwZXMgdmlhIHR5cGUgYWNxdWlzaXRpb24gKi9cbiAgYWNxdWlyZVR5cGVzOiBib29sZWFuXG4gIC8qKiBTdXBwb3J0IHR3b3NsYXNoIGNvbXBpbGVyIG9wdGlvbnMgKi9cbiAgc3VwcG9ydFR3b3NsYXNoQ29tcGlsZXJPcHRpb25zOiBib29sZWFuXG4gIC8qKiBHZXQgdGhlIHRleHQgdmlhIHF1ZXJ5IHBhcmFtcyBhbmQgbG9jYWwgc3RvcmFnZSwgdXNlZnVsIHdoZW4gdGhlIGVkaXRvciBpcyB0aGUgbWFpbiBleHBlcmllbmNlICovXG4gIHN1cHByZXNzQXV0b21hdGljYWxseUdldHRpbmdEZWZhdWx0VGV4dD86IHRydWVcbiAgLyoqIFN1cHByZXNzIHNldHRpbmcgY29tcGlsZXIgb3B0aW9ucyBmcm9tIHRoZSBjb21waWxlciBmbGFncyBmcm9tIHF1ZXJ5IHBhcmFtcyAqL1xuICBzdXBwcmVzc0F1dG9tYXRpY2FsbHlHZXR0aW5nQ29tcGlsZXJGbGFncz86IHRydWVcbiAgLyoqIE9wdGlvbmFsIHBhdGggdG8gVHlwZVNjcmlwdCB3b3JrZXIgd3JhcHBlciBjbGFzcyBzY3JpcHQsIHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L21vbmFjby10eXBlc2NyaXB0L3B1bGwvNjUgICovXG4gIGN1c3RvbVR5cGVTY3JpcHRXb3JrZXJQYXRoPzogc3RyaW5nXG4gIC8qKiBMb2dnaW5nIHN5c3RlbSAqL1xuICBsb2dnZXI6IHtcbiAgICBsb2c6ICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZFxuICAgIGVycm9yOiAoLi4uYXJnczogYW55W10pID0+IHZvaWRcbiAgICBncm91cENvbGxhcHNlZDogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkXG4gICAgZ3JvdXBFbmQ6ICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZFxuICB9XG59ICYgKFxuICB8IHsgLyoqIHRoZUlEIG9mIGEgZG9tIG5vZGUgdG8gYWRkIG1vbmFjbyB0byAqLyBkb21JRDogc3RyaW5nIH1cbiAgfCB7IC8qKiB0aGVJRCBvZiBhIGRvbSBub2RlIHRvIGFkZCBtb25hY28gdG8gKi8gZWxlbWVudFRvQXBwZW5kOiBIVE1MRWxlbWVudCB9XG4pXG5cbmNvbnN0IGxhbmd1YWdlVHlwZSA9IChjb25maWc6IFNhbmRib3hDb25maWcpID0+IChjb25maWcuZmlsZXR5cGUgPT09IFwianNcIiA/IFwiamF2YXNjcmlwdFwiIDogXCJ0eXBlc2NyaXB0XCIpXG5cbi8vIEJhc2ljYWxseSBhbmRyb2lkIGFuZCBtb25hY28gaXMgcHJldHR5IGJhZCwgdGhpcyBtYWtlcyBpdCBsZXNzIGJhZFxuLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvcHh0L3B1bGwvNzA5OSBmb3IgdGhpcywgYW5kIHRoZSBsb25nXG4vLyByZWFkIGlzIGluIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvbW9uYWNvLWVkaXRvci9pc3N1ZXMvNTYzXG5jb25zdCBpc0FuZHJvaWQgPSBuYXZpZ2F0b3IgJiYgL2FuZHJvaWQvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpXG5cbi8qKiBEZWZhdWx0IE1vbmFjbyBzZXR0aW5ncyBmb3IgcGxheWdyb3VuZCAqL1xuY29uc3Qgc2hhcmVkRWRpdG9yT3B0aW9uczogaW1wb3J0KFwibW9uYWNvLWVkaXRvclwiKS5lZGl0b3IuSUVkaXRvck9wdGlvbnMgPSB7XG4gIHNjcm9sbEJleW9uZExhc3RMaW5lOiB0cnVlLFxuICBzY3JvbGxCZXlvbmRMYXN0Q29sdW1uOiAzLFxuICBtaW5pbWFwOiB7XG4gICAgZW5hYmxlZDogZmFsc2UsXG4gIH0sXG4gIGxpZ2h0YnVsYjoge1xuICAgIGVuYWJsZWQ6IHRydWUsXG4gIH0sXG4gIHF1aWNrU3VnZ2VzdGlvbnM6IHtcbiAgICBvdGhlcjogIWlzQW5kcm9pZCxcbiAgICBjb21tZW50czogIWlzQW5kcm9pZCxcbiAgICBzdHJpbmdzOiAhaXNBbmRyb2lkLFxuICB9LFxuICBhY2NlcHRTdWdnZXN0aW9uT25Db21taXRDaGFyYWN0ZXI6ICFpc0FuZHJvaWQsXG4gIGFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyOiAhaXNBbmRyb2lkID8gXCJvblwiIDogXCJvZmZcIixcbiAgYWNjZXNzaWJpbGl0eVN1cHBvcnQ6ICFpc0FuZHJvaWQgPyBcIm9uXCIgOiBcIm9mZlwiLFxufVxuXG4vKiogVGhlIGRlZmF1bHQgc2V0dGluZ3Mgd2hpY2ggd2UgYXBwbHkgYSBwYXJ0aWFsIG92ZXIgKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0UGxheWdyb3VuZFNldHRpbmdzKCkge1xuICBjb25zdCBjb25maWc6IFNhbmRib3hDb25maWcgPSB7XG4gICAgdGV4dDogXCJcIixcbiAgICBkb21JRDogXCJcIixcbiAgICBjb21waWxlck9wdGlvbnM6IHt9LFxuICAgIGFjcXVpcmVUeXBlczogdHJ1ZSxcbiAgICBmaWxldHlwZTogXCJ0c1wiLFxuICAgIHN1cHBvcnRUd29zbGFzaENvbXBpbGVyT3B0aW9uczogZmFsc2UsXG4gICAgbG9nZ2VyOiBjb25zb2xlLFxuICB9XG4gIHJldHVybiBjb25maWdcbn1cblxuZnVuY3Rpb24gZGVmYXVsdEZpbGVQYXRoKGNvbmZpZzogU2FuZGJveENvbmZpZywgY29tcGlsZXJPcHRpb25zOiBDb21waWxlck9wdGlvbnMsIG1vbmFjbzogTW9uYWNvKSB7XG4gIGNvbnN0IGlzSlNYID0gY29tcGlsZXJPcHRpb25zLmpzeCAhPT0gbW9uYWNvLmxhbmd1YWdlcy50eXBlc2NyaXB0LkpzeEVtaXQuTm9uZVxuICBjb25zdCBleHQgPSBpc0pTWCAmJiBjb25maWcuZmlsZXR5cGUgIT09IFwiZC50c1wiID8gY29uZmlnLmZpbGV0eXBlICsgXCJ4XCIgOiBjb25maWcuZmlsZXR5cGVcbiAgcmV0dXJuIFwiaW5wdXQuXCIgKyBleHRcbn1cblxuLyoqIENyZWF0ZXMgYSBtb25hY28gZmlsZSByZWZlcmVuY2UsIGJhc2ljYWxseSBhIGZhbmN5IHBhdGggKi9cbmZ1bmN0aW9uIGNyZWF0ZUZpbGVVcmkoY29uZmlnOiBTYW5kYm94Q29uZmlnLCBjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucywgbW9uYWNvOiBNb25hY28pIHtcbiAgcmV0dXJuIG1vbmFjby5VcmkuZmlsZShkZWZhdWx0RmlsZVBhdGgoY29uZmlnLCBjb21waWxlck9wdGlvbnMsIG1vbmFjbykpXG59XG5cbi8qKiBDcmVhdGVzIGEgc2FuZGJveCBlZGl0b3IsIGFuZCByZXR1cm5zIGEgc2V0IG9mIHVzZWZ1bCBmdW5jdGlvbnMgYW5kIHRoZSBlZGl0b3IgKi9cbmV4cG9ydCBjb25zdCBjcmVhdGVUeXBlU2NyaXB0U2FuZGJveCA9IChcbiAgcGFydGlhbENvbmZpZzogUGFydGlhbDxTYW5kYm94Q29uZmlnPixcbiAgbW9uYWNvOiBNb25hY28sXG4gIHRzOiB0eXBlb2YgaW1wb3J0KFwidHlwZXNjcmlwdFwiKVxuKSA9PiB7XG4gIGNvbnN0IGNvbmZpZyA9IHsgLi4uZGVmYXVsdFBsYXlncm91bmRTZXR0aW5ncygpLCAuLi5wYXJ0aWFsQ29uZmlnIH1cbiAgaWYgKCEoXCJkb21JRFwiIGluIGNvbmZpZykgJiYgIShcImVsZW1lbnRUb0FwcGVuZFwiIGluIGNvbmZpZykpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiWW91IGRpZCBub3QgcHJvdmlkZSBhIGRvbUlEIG9yIGVsZW1lbnRUb0FwcGVuZFwiKVxuXG4gIGNvbnN0IGRlZmF1bHRUZXh0ID0gY29uZmlnLnN1cHByZXNzQXV0b21hdGljYWxseUdldHRpbmdEZWZhdWx0VGV4dFxuICAgID8gY29uZmlnLnRleHRcbiAgICA6IGdldEluaXRpYWxDb2RlKGNvbmZpZy50ZXh0LCBkb2N1bWVudC5sb2NhdGlvbilcblxuICAvLyBEZWZhdWx0c1xuICBjb25zdCBjb21waWxlckRlZmF1bHRzID0gZ2V0RGVmYXVsdFNhbmRib3hDb21waWxlck9wdGlvbnMoY29uZmlnLCBtb25hY28pXG5cbiAgLy8gR3JhYiB0aGUgY29tcGlsZXIgZmxhZ3MgdmlhIHRoZSBxdWVyeSBwYXJhbXNcbiAgbGV0IGNvbXBpbGVyT3B0aW9uczogQ29tcGlsZXJPcHRpb25zXG4gIGlmICghY29uZmlnLnN1cHByZXNzQXV0b21hdGljYWxseUdldHRpbmdDb21waWxlckZsYWdzKSB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhsb2NhdGlvbi5zZWFyY2gpXG4gICAgbGV0IHF1ZXJ5UGFyYW1Db21waWxlck9wdGlvbnMgPSBnZXRDb21waWxlck9wdGlvbnNGcm9tUGFyYW1zKGNvbXBpbGVyRGVmYXVsdHMsIHRzLCBwYXJhbXMpXG4gICAgaWYgKE9iamVjdC5rZXlzKHF1ZXJ5UGFyYW1Db21waWxlck9wdGlvbnMpLmxlbmd0aClcbiAgICAgIGNvbmZpZy5sb2dnZXIubG9nKFwiW0NvbXBpbGVyXSBGb3VuZCBjb21waWxlciBvcHRpb25zIGluIHF1ZXJ5IHBhcmFtczogXCIsIHF1ZXJ5UGFyYW1Db21waWxlck9wdGlvbnMpXG4gICAgY29tcGlsZXJPcHRpb25zID0geyAuLi5jb21waWxlckRlZmF1bHRzLCAuLi5xdWVyeVBhcmFtQ29tcGlsZXJPcHRpb25zIH1cbiAgfSBlbHNlIHtcbiAgICBjb21waWxlck9wdGlvbnMgPSBjb21waWxlckRlZmF1bHRzXG4gIH1cblxuICBjb25zdCBpc0pTTGFuZyA9IGNvbmZpZy5maWxldHlwZSA9PT0gXCJqc1wiXG4gIC8vIERvbid0IGFsbG93IGEgc3RhdGUgbGlrZSBhbGxvd0pzID0gZmFsc2VcbiAgaWYgKGlzSlNMYW5nKSB7XG4gICAgY29tcGlsZXJPcHRpb25zLmFsbG93SnMgPSB0cnVlXG4gIH1cblxuICBjb25zdCBsYW5ndWFnZSA9IGxhbmd1YWdlVHlwZShjb25maWcpXG4gIGNvbnN0IGZpbGVQYXRoID0gY3JlYXRlRmlsZVVyaShjb25maWcsIGNvbXBpbGVyT3B0aW9ucywgbW9uYWNvKVxuICBjb25zdCBlbGVtZW50ID0gXCJkb21JRFwiIGluIGNvbmZpZyA/IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5kb21JRCkgOiAoY29uZmlnIGFzIGFueSkuZWxlbWVudFRvQXBwZW5kXG5cbiAgY29uc3QgbW9kZWwgPSBtb25hY28uZWRpdG9yLmNyZWF0ZU1vZGVsKGRlZmF1bHRUZXh0LCBsYW5ndWFnZSwgZmlsZVBhdGgpXG4gIG1vbmFjby5lZGl0b3IuZGVmaW5lVGhlbWUoXCJzYW5kYm94XCIsIHNhbmRib3hUaGVtZSlcbiAgbW9uYWNvLmVkaXRvci5kZWZpbmVUaGVtZShcInNhbmRib3gtZGFya1wiLCBzYW5kYm94VGhlbWVEYXJrKVxuICBtb25hY28uZWRpdG9yLnNldFRoZW1lKFwic2FuZGJveFwiKVxuXG4gIGNvbnN0IG1vbmFjb1NldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7IG1vZGVsIH0sIHNoYXJlZEVkaXRvck9wdGlvbnMsIGNvbmZpZy5tb25hY29TZXR0aW5ncyB8fCB7fSlcbiAgY29uc3QgZWRpdG9yID0gbW9uYWNvLmVkaXRvci5jcmVhdGUoZWxlbWVudCwgbW9uYWNvU2V0dGluZ3MpXG5cbiAgY29uc3QgZ2V0V29ya2VyID0gaXNKU0xhbmdcbiAgICA/IG1vbmFjby5sYW5ndWFnZXMudHlwZXNjcmlwdC5nZXRKYXZhU2NyaXB0V29ya2VyXG4gICAgOiBtb25hY28ubGFuZ3VhZ2VzLnR5cGVzY3JpcHQuZ2V0VHlwZVNjcmlwdFdvcmtlclxuXG4gIGNvbnN0IGRlZmF1bHRzID0gaXNKU0xhbmdcbiAgICA/IG1vbmFjby5sYW5ndWFnZXMudHlwZXNjcmlwdC5qYXZhc2NyaXB0RGVmYXVsdHNcbiAgICA6IG1vbmFjby5sYW5ndWFnZXMudHlwZXNjcmlwdC50eXBlc2NyaXB0RGVmYXVsdHNcblxuICAvLyBAdHMtaWdub3JlIC0gdGhlc2UgZXhpc3RcbiAgaWYgKGNvbmZpZy5jdXN0b21UeXBlU2NyaXB0V29ya2VyUGF0aCAmJiBkZWZhdWx0cy5zZXRXb3JrZXJPcHRpb25zKSB7XG4gICAgLy8gQHRzLWlnbm9yZSAtIHRoaXMgZnVuYyBtdXN0IGV4aXN0IHRvIGhhdmUgZ290IGhlcmVcbiAgICBkZWZhdWx0cy5zZXRXb3JrZXJPcHRpb25zKHtcbiAgICAgIGN1c3RvbVdvcmtlclBhdGg6IGNvbmZpZy5jdXN0b21UeXBlU2NyaXB0V29ya2VyUGF0aCxcbiAgICB9KVxuICB9XG5cbiAgZGVmYXVsdHMuc2V0RGlhZ25vc3RpY3NPcHRpb25zKHtcbiAgICAuLi5kZWZhdWx0cy5nZXREaWFnbm9zdGljc09wdGlvbnMoKSxcbiAgICBub1NlbWFudGljVmFsaWRhdGlvbjogZmFsc2UsXG4gICAgLy8gVGhpcyBpcyB3aGVuIHRzbGliIGlzIG5vdCBmb3VuZFxuICAgIGRpYWdub3N0aWNDb2Rlc1RvSWdub3JlOiBbMjM1NF0sXG4gIH0pXG5cbiAgLy8gSW4gdGhlIGZ1dHVyZSBpdCdkIGJlIGdvb2QgdG8gYWRkIHN1cHBvcnQgZm9yIGFuICdhZGQgbWFueSBmaWxlcydcbiAgY29uc3QgYWRkTGlicmFyeVRvUnVudGltZSA9IChjb2RlOiBzdHJpbmcsIHBhdGg6IHN0cmluZykgPT4ge1xuICAgIGRlZmF1bHRzLmFkZEV4dHJhTGliKGNvZGUsIHBhdGgpXG4gICAgY29uc3QgdXJpID0gbW9uYWNvLlVyaS5maWxlKHBhdGgpXG4gICAgaWYgKG1vbmFjby5lZGl0b3IuZ2V0TW9kZWwodXJpKSA9PT0gbnVsbCkge1xuICAgICAgbW9uYWNvLmVkaXRvci5jcmVhdGVNb2RlbChjb2RlLCBcImphdmFzY3JpcHRcIiwgdXJpKVxuICAgIH1cbiAgICBjb25maWcubG9nZ2VyLmxvZyhgW0FUQV0gQWRkaW5nICR7cGF0aH0gdG8gcnVudGltZWApXG4gIH1cblxuICBjb25zdCBnZXRUd29TbGFzaENvbXBpbGVyT3B0aW9ucyA9IGV4dHJhY3RUd29TbGFzaENvbXBpbGVyT3B0aW9ucyh0cylcblxuICAvLyBBdXRvLWNvbXBsZXRlIHR3b3NsYXNoIGNvbW1lbnRzXG4gIGlmIChjb25maWcuc3VwcG9ydFR3b3NsYXNoQ29tcGlsZXJPcHRpb25zKSB7XG4gICAgY29uc3QgbGFuZ3MgPSBbXCJqYXZhc2NyaXB0XCIsIFwidHlwZXNjcmlwdFwiXVxuICAgIGxhbmdzLmZvckVhY2gobCA9PlxuICAgICAgbW9uYWNvLmxhbmd1YWdlcy5yZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIobCwge1xuICAgICAgICB0cmlnZ2VyQ2hhcmFjdGVyczogW1wiQFwiLCBcIi9cIiwgXCItXCJdLFxuICAgICAgICBwcm92aWRlQ29tcGxldGlvbkl0ZW1zOiB0d29zbGFzaENvbXBsZXRpb25zKHRzLCBtb25hY28pLFxuICAgICAgfSlcbiAgICApXG4gIH1cblxuICBjb25zdCB0ZXh0VXBkYXRlZCA9ICgpID0+IHtcbiAgICBjb25zdCBjb2RlID0gZWRpdG9yLmdldE1vZGVsKCkhLmdldFZhbHVlKClcblxuICAgIGlmIChjb25maWcuc3VwcG9ydFR3b3NsYXNoQ29tcGlsZXJPcHRpb25zKSB7XG4gICAgICBjb25zdCBjb25maWdPcHRzID0gZ2V0VHdvU2xhc2hDb21waWxlck9wdGlvbnMoY29kZSlcbiAgICAgIHVwZGF0ZUNvbXBpbGVyU2V0dGluZ3MoY29uZmlnT3B0cylcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmFjcXVpcmVUeXBlcykge1xuICAgICAgZGV0ZWN0TmV3SW1wb3J0c1RvQWNxdWlyZVR5cGVGb3IoY29kZSwgYWRkTGlicmFyeVRvUnVudGltZSwgd2luZG93LmZldGNoLmJpbmQod2luZG93KSwgY29uZmlnKVxuICAgIH1cbiAgfVxuXG4gIC8vIERlYm91bmNlZCBzYW5kYm94IGZlYXR1cmVzIGxpa2UgdHdvc2xhc2ggYW5kIHR5cGUgYWNxdWlzaXRpb24gdG8gb25jZSBldmVyeSBzZWNvbmRcbiAgbGV0IGRlYm91bmNpbmdUaW1lciA9IGZhbHNlXG4gIGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudChfZSA9PiB7XG4gICAgaWYgKGRlYm91bmNpbmdUaW1lcikgcmV0dXJuXG4gICAgZGVib3VuY2luZ1RpbWVyID0gdHJ1ZVxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZGVib3VuY2luZ1RpbWVyID0gZmFsc2VcbiAgICAgIHRleHRVcGRhdGVkKClcbiAgICB9LCAxMDAwKVxuICB9KVxuXG4gIGNvbmZpZy5sb2dnZXIubG9nKFwiW0NvbXBpbGVyXSBTZXQgY29tcGlsZXIgb3B0aW9uczogXCIsIGNvbXBpbGVyT3B0aW9ucylcbiAgZGVmYXVsdHMuc2V0Q29tcGlsZXJPcHRpb25zKGNvbXBpbGVyT3B0aW9ucylcblxuICAvLyBUbyBsZXQgY2xpZW50cyBwbHVnIGludG8gY29tcGlsZXIgc2V0dGluZ3MgY2hhbmdlc1xuICBsZXQgZGlkVXBkYXRlQ29tcGlsZXJTZXR0aW5ncyA9IChvcHRzOiBDb21waWxlck9wdGlvbnMpID0+IHt9XG5cbiAgY29uc3QgdXBkYXRlQ29tcGlsZXJTZXR0aW5ncyA9IChvcHRzOiBDb21waWxlck9wdGlvbnMpID0+IHtcbiAgICBjb25zdCBuZXdLZXlzID0gT2JqZWN0LmtleXMob3B0cylcbiAgICBpZiAoIW5ld0tleXMubGVuZ3RoKSByZXR1cm5cblxuICAgIC8vIERvbid0IHVwZGF0ZSBhIGNvbXBpbGVyIHNldHRpbmcgaWYgaXQncyB0aGUgc2FtZVxuICAgIC8vIGFzIHRoZSBjdXJyZW50IHNldHRpbmdcbiAgICBuZXdLZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGlmIChjb21waWxlck9wdGlvbnNba2V5XSA9PSBvcHRzW2tleV0pIGRlbGV0ZSBvcHRzW2tleV1cbiAgICB9KVxuXG4gICAgaWYgKCFPYmplY3Qua2V5cyhvcHRzKS5sZW5ndGgpIHJldHVyblxuXG4gICAgY29uZmlnLmxvZ2dlci5sb2coXCJbQ29tcGlsZXJdIFVwZGF0aW5nIGNvbXBpbGVyIG9wdGlvbnM6IFwiLCBvcHRzKVxuXG4gICAgY29tcGlsZXJPcHRpb25zID0geyAuLi5jb21waWxlck9wdGlvbnMsIC4uLm9wdHMgfVxuICAgIGRlZmF1bHRzLnNldENvbXBpbGVyT3B0aW9ucyhjb21waWxlck9wdGlvbnMpXG4gICAgZGlkVXBkYXRlQ29tcGlsZXJTZXR0aW5ncyhjb21waWxlck9wdGlvbnMpXG4gIH1cblxuICBjb25zdCB1cGRhdGVDb21waWxlclNldHRpbmcgPSAoa2V5OiBrZXlvZiBDb21waWxlck9wdGlvbnMsIHZhbHVlOiBhbnkpID0+IHtcbiAgICBjb25maWcubG9nZ2VyLmxvZyhcIltDb21waWxlcl0gU2V0dGluZyBjb21waWxlciBvcHRpb25zIFwiLCBrZXksIFwidG9cIiwgdmFsdWUpXG4gICAgY29tcGlsZXJPcHRpb25zW2tleV0gPSB2YWx1ZVxuICAgIGRlZmF1bHRzLnNldENvbXBpbGVyT3B0aW9ucyhjb21waWxlck9wdGlvbnMpXG4gICAgZGlkVXBkYXRlQ29tcGlsZXJTZXR0aW5ncyhjb21waWxlck9wdGlvbnMpXG4gIH1cblxuICBjb25zdCBzZXRDb21waWxlclNldHRpbmdzID0gKG9wdHM6IENvbXBpbGVyT3B0aW9ucykgPT4ge1xuICAgIGNvbmZpZy5sb2dnZXIubG9nKFwiW0NvbXBpbGVyXSBTZXR0aW5nIGNvbXBpbGVyIG9wdGlvbnM6IFwiLCBvcHRzKVxuICAgIGNvbXBpbGVyT3B0aW9ucyA9IG9wdHNcbiAgICBkZWZhdWx0cy5zZXRDb21waWxlck9wdGlvbnMoY29tcGlsZXJPcHRpb25zKVxuICAgIGRpZFVwZGF0ZUNvbXBpbGVyU2V0dGluZ3MoY29tcGlsZXJPcHRpb25zKVxuICB9XG5cbiAgY29uc3QgZ2V0Q29tcGlsZXJPcHRpb25zID0gKCkgPT4ge1xuICAgIHJldHVybiBjb21waWxlck9wdGlvbnNcbiAgfVxuXG4gIGNvbnN0IHNldERpZFVwZGF0ZUNvbXBpbGVyU2V0dGluZ3MgPSAoZnVuYzogKG9wdHM6IENvbXBpbGVyT3B0aW9ucykgPT4gdm9pZCkgPT4ge1xuICAgIGRpZFVwZGF0ZUNvbXBpbGVyU2V0dGluZ3MgPSBmdW5jXG4gIH1cblxuICAvKiogR2V0cyB0aGUgcmVzdWx0cyBvZiBjb21waWxpbmcgeW91ciBlZGl0b3IncyBjb2RlICovXG4gIGNvbnN0IGdldEVtaXRSZXN1bHQgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSFcbiAgICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRXb3JrZXJQcm9jZXNzKClcbiAgICByZXR1cm4gYXdhaXQgY2xpZW50LmdldEVtaXRPdXRwdXQobW9kZWwudXJpLnRvU3RyaW5nKCkpXG4gIH1cblxuICAvKiogR2V0cyB0aGUgSlMgIG9mIGNvbXBpbGluZyB5b3VyIGVkaXRvcidzIGNvZGUgKi9cbiAgY29uc3QgZ2V0UnVubmFibGVKUyA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBUaGlzIGlzbid0IHF1aXRlIF9yaWdodF8gaW4gdGhlb3J5LCB3ZSBjYW4gZG93bmxldmVsIEpTIC0+IEpTXG4gICAgLy8gYnV0IGEgYnJvd3NlciBpcyBiYXNpY2FsbHkgYWx3YXlzIGVzbmV4dC15IGFuZCBzZXR0aW5nIGFsbG93SnMgYW5kXG4gICAgLy8gY2hlY2tKcyBkb2VzIG5vdCBhY3R1YWxseSBnaXZlIHRoZSBkb3dubGV2ZWwnZCAuanMgZmlsZSBpbiB0aGUgb3V0cHV0XG4gICAgLy8gbGF0ZXIgZG93biB0aGUgbGluZS5cbiAgICBpZiAoaXNKU0xhbmcpIHtcbiAgICAgIHJldHVybiBnZXRUZXh0KClcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0RW1pdFJlc3VsdCgpXG4gICAgY29uc3QgZmlyc3RKUyA9IHJlc3VsdC5vdXRwdXRGaWxlcy5maW5kKChvOiBhbnkpID0+IG8ubmFtZS5lbmRzV2l0aChcIi5qc1wiKSB8fCBvLm5hbWUuZW5kc1dpdGgoXCIuanN4XCIpKVxuICAgIHJldHVybiAoZmlyc3RKUyAmJiBmaXJzdEpTLnRleHQpIHx8IFwiXCJcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBEVFMgZm9yIHRoZSBKUy9UUyAgb2YgY29tcGlsaW5nIHlvdXIgZWRpdG9yJ3MgY29kZSAqL1xuICBjb25zdCBnZXREVFNGb3JDb2RlID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldEVtaXRSZXN1bHQoKVxuICAgIHJldHVybiByZXN1bHQub3V0cHV0RmlsZXMuZmluZCgobzogYW55KSA9PiBvLm5hbWUuZW5kc1dpdGgoXCIuZC50c1wiKSkhLnRleHRcbiAgfVxuXG4gIGNvbnN0IGdldFdvcmtlclByb2Nlc3MgPSBhc3luYyAoKTogUHJvbWlzZTxUeXBlU2NyaXB0V29ya2VyPiA9PiB7XG4gICAgY29uc3Qgd29ya2VyID0gYXdhaXQgZ2V0V29ya2VyKClcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgcmV0dXJuIGF3YWl0IHdvcmtlcihtb2RlbC51cmkpXG4gIH1cblxuICBjb25zdCBnZXREb21Ob2RlID0gKCkgPT4gZWRpdG9yLmdldERvbU5vZGUoKSFcbiAgY29uc3QgZ2V0TW9kZWwgPSAoKSA9PiBlZGl0b3IuZ2V0TW9kZWwoKSFcbiAgY29uc3QgZ2V0VGV4dCA9ICgpID0+IGdldE1vZGVsKCkuZ2V0VmFsdWUoKVxuICBjb25zdCBzZXRUZXh0ID0gKHRleHQ6IHN0cmluZykgPT4gZ2V0TW9kZWwoKS5zZXRWYWx1ZSh0ZXh0KVxuXG4gIGNvbnN0IHNldHVwVFNWRlMgPSBhc3luYyAoZnNNYXBBZGRpdGlvbnM/OiBNYXA8c3RyaW5nLCBzdHJpbmc+KSA9PiB7XG4gICAgY29uc3QgZnNNYXAgPSBhd2FpdCB0c3Zmcy5jcmVhdGVEZWZhdWx0TWFwRnJvbUNETihjb21waWxlck9wdGlvbnMsIHRzLnZlcnNpb24sIHRydWUsIHRzLCBsenN0cmluZylcbiAgICBmc01hcC5zZXQoZmlsZVBhdGgucGF0aCwgZ2V0VGV4dCgpKVxuICAgIGlmIChmc01hcEFkZGl0aW9ucykge1xuICAgICAgZnNNYXBBZGRpdGlvbnMuZm9yRWFjaCgodiwgaykgPT4gZnNNYXAuc2V0KGssIHYpKVxuICAgIH1cblxuICAgIGNvbnN0IHN5c3RlbSA9IHRzdmZzLmNyZWF0ZVN5c3RlbShmc01hcClcbiAgICBjb25zdCBob3N0ID0gdHN2ZnMuY3JlYXRlVmlydHVhbENvbXBpbGVySG9zdChzeXN0ZW0sIGNvbXBpbGVyT3B0aW9ucywgdHMpXG5cbiAgICBjb25zdCBwcm9ncmFtID0gdHMuY3JlYXRlUHJvZ3JhbSh7XG4gICAgICByb290TmFtZXM6IFsuLi5mc01hcC5rZXlzKCldLFxuICAgICAgb3B0aW9uczogY29tcGlsZXJPcHRpb25zLFxuICAgICAgaG9zdDogaG9zdC5jb21waWxlckhvc3QsXG4gICAgfSlcblxuICAgIHJldHVybiB7XG4gICAgICBwcm9ncmFtLFxuICAgICAgc3lzdGVtLFxuICAgICAgaG9zdCxcbiAgICAgIGZzTWFwLFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgVFMgUHJvZ3JhbSwgaWYgeW91J3JlIGRvaW5nIGFueXRoaW5nIGNvbXBsZXhcbiAgICogaXQncyBsaWtlbHkgeW91IHdhbnQgc2V0dXBUU1ZGUyBpbnN0ZWFkIGFuZCBjYW4gcHVsbCBwcm9ncmFtIG91dCBmcm9tIHRoYXRcbiAgICpcbiAgICogV2FybmluZzogUnVucyBvbiB0aGUgbWFpbiB0aHJlYWRcbiAgICovXG4gIGNvbnN0IGNyZWF0ZVRTUHJvZ3JhbSA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB0c3ZmcyA9IGF3YWl0IHNldHVwVFNWRlMoKVxuICAgIHJldHVybiB0c3Zmcy5wcm9ncmFtXG4gIH1cblxuICBjb25zdCBnZXRBU1QgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgcHJvZ3JhbSA9IGF3YWl0IGNyZWF0ZVRTUHJvZ3JhbSgpXG4gICAgcHJvZ3JhbS5lbWl0KClcbiAgICByZXR1cm4gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGVQYXRoLnBhdGgpIVxuICB9XG5cbiAgLy8gUGFzcyBhbG9uZyB0aGUgc3VwcG9ydGVkIHJlbGVhc2VzIGZvciB0aGUgcGxheWdyb3VuZFxuICBjb25zdCBzdXBwb3J0ZWRWZXJzaW9ucyA9IHN1cHBvcnRlZFJlbGVhc2VzXG5cbiAgdGV4dFVwZGF0ZWQoKVxuXG4gIHJldHVybiB7XG4gICAgLyoqIFRoZSBzYW1lIGNvbmZpZyB5b3UgcGFzc2VkIGluICovXG4gICAgY29uZmlnLFxuICAgIC8qKiBBIGxpc3Qgb2YgVHlwZVNjcmlwdCB2ZXJzaW9ucyB5b3UgY2FuIHVzZSB3aXRoIHRoZSBUeXBlU2NyaXB0IHNhbmRib3ggKi9cbiAgICBzdXBwb3J0ZWRWZXJzaW9ucyxcbiAgICAvKiogVGhlIG1vbmFjbyBlZGl0b3IgaW5zdGFuY2UgKi9cbiAgICBlZGl0b3IsXG4gICAgLyoqIEVpdGhlciBcInR5cGVzY3JpcHRcIiBvciBcImphdmFzY3JpcHRcIiBkZXBlbmRpbmcgb24geW91ciBjb25maWcgKi9cbiAgICBsYW5ndWFnZSxcbiAgICAvKiogVGhlIG91dGVyIG1vbmFjbyBtb2R1bGUsIHRoZSByZXN1bHQgb2YgcmVxdWlyZShcIm1vbmFjby1lZGl0b3JcIikgICovXG4gICAgbW9uYWNvLFxuICAgIC8qKiBHZXRzIGEgbW9uYWNvLXR5cGVzY3JpcHQgd29ya2VyLCB0aGlzIHdpbGwgZ2l2ZSB5b3UgYWNjZXNzIHRvIGEgbGFuZ3VhZ2Ugc2VydmVyLiBOb3RlOiBwcmVmZXIgdGhpcyBmb3IgbGFuZ3VhZ2Ugc2VydmVyIHdvcmsgYmVjYXVzZSBpdCBoYXBwZW5zIG9uIGEgd2Vid29ya2VyIC4gKi9cbiAgICBnZXRXb3JrZXJQcm9jZXNzLFxuICAgIC8qKiBBIGNvcHkgb2YgcmVxdWlyZShcIkB0eXBlc2NyaXB0L3Zmc1wiKSB0aGlzIGNhbiBiZSB1c2VkIHRvIHF1aWNrbHkgc2V0IHVwIGFuIGluLW1lbW9yeSBjb21waWxlciBydW5zIGZvciBBU1RzLCBvciB0byBnZXQgY29tcGxleCBsYW5ndWFnZSBzZXJ2ZXIgcmVzdWx0cyAoYW55dGhpbmcgYWJvdmUgaGFzIHRvIGJlIHNlcmlhbGl6ZWQgd2hlbiBwYXNzZWQpKi9cbiAgICB0c3ZmcyxcbiAgICAvKiogR2V0IGFsbCB0aGUgZGlmZmVyZW50IGVtaXR0ZWQgZmlsZXMgYWZ0ZXIgVHlwZVNjcmlwdCBpcyBydW4gKi9cbiAgICBnZXRFbWl0UmVzdWx0LFxuICAgIC8qKiBHZXRzIGp1c3QgdGhlIEphdmFTY3JpcHQgZm9yIHlvdXIgc2FuZGJveCwgd2lsbCB0cmFuc3BpbGUgaWYgaW4gVFMgb25seSAqL1xuICAgIGdldFJ1bm5hYmxlSlMsXG4gICAgLyoqIEdldHMgdGhlIERUUyBvdXRwdXQgb2YgdGhlIG1haW4gY29kZSBpbiB0aGUgZWRpdG9yICovXG4gICAgZ2V0RFRTRm9yQ29kZSxcbiAgICAvKiogVGhlIG1vbmFjby1lZGl0b3IgZG9tIG5vZGUsIHVzZWQgZm9yIHNob3dpbmcvaGlkaW5nIHRoZSBlZGl0b3IgKi9cbiAgICBnZXREb21Ob2RlLFxuICAgIC8qKiBUaGUgbW9kZWwgaXMgYW4gb2JqZWN0IHdoaWNoIG1vbmFjbyB1c2VzIHRvIGtlZXAgdHJhY2sgb2YgdGV4dCBpbiB0aGUgZWRpdG9yLiBVc2UgdGhpcyB0byBkaXJlY3RseSBtb2RpZnkgdGhlIHRleHQgaW4gdGhlIGVkaXRvciAqL1xuICAgIGdldE1vZGVsLFxuICAgIC8qKiBHZXRzIHRoZSB0ZXh0IG9mIHRoZSBtYWluIG1vZGVsLCB3aGljaCBpcyB0aGUgdGV4dCBpbiB0aGUgZWRpdG9yICovXG4gICAgZ2V0VGV4dCxcbiAgICAvKiogU2hvcnRjdXQgZm9yIHNldHRpbmcgdGhlIG1vZGVsJ3MgdGV4dCBjb250ZW50IHdoaWNoIHdvdWxkIHVwZGF0ZSB0aGUgZWRpdG9yICovXG4gICAgc2V0VGV4dCxcbiAgICAvKiogR2V0cyB0aGUgQVNUIG9mIHRoZSBjdXJyZW50IHRleHQgaW4gbW9uYWNvIC0gdXNlcyBgY3JlYXRlVFNQcm9ncmFtYCwgc28gdGhlIHBlcmZvcm1hbmNlIGNhdmVhdCBhcHBsaWVzIHRoZXJlIHRvbyAqL1xuICAgIGdldEFTVCxcbiAgICAvKiogVGhlIG1vZHVsZSB5b3UgZ2V0IGZyb20gcmVxdWlyZShcInR5cGVzY3JpcHRcIikgKi9cbiAgICB0cyxcbiAgICAvKiogQ3JlYXRlIGEgbmV3IFByb2dyYW0sIGEgVHlwZVNjcmlwdCBkYXRhIG1vZGVsIHdoaWNoIHJlcHJlc2VudHMgdGhlIGVudGlyZSBwcm9qZWN0LiBBcyB3ZWxsIGFzIHNvbWUgb2YgdGhlXG4gICAgICogcHJpbWl0aXZlIG9iamVjdHMgeW91IHdvdWxkIG5vcm1hbGx5IG5lZWQgdG8gZG8gd29yayB3aXRoIHRoZSBmaWxlcy5cbiAgICAgKlxuICAgICAqIFRoZSBmaXJzdCB0aW1lIHRoaXMgaXMgY2FsbGVkIGl0IGhhcyB0byBkb3dubG9hZCBhbGwgdGhlIERUUyBmaWxlcyB3aGljaCBpcyBuZWVkZWQgZm9yIGFuIGV4YWN0IGNvbXBpbGVyIHJ1bi4gV2hpY2hcbiAgICAgKiBhdCBtYXggaXMgYWJvdXQgMS41TUIgLSBhZnRlciB0aGF0IHN1YnNlcXVlbnQgZG93bmxvYWRzIG9mIGR0cyBsaWIgZmlsZXMgY29tZSBmcm9tIGxvY2FsU3RvcmFnZS5cbiAgICAgKlxuICAgICAqIFRyeSB0byB1c2UgdGhpcyBzcGFyaW5nbHkgYXMgaXQgY2FuIGJlIGNvbXB1dGF0aW9uYWxseSBleHBlbnNpdmUsIGF0IHRoZSBtaW5pbXVtIHlvdSBzaG91bGQgYmUgdXNpbmcgdGhlIGRlYm91bmNlZCBzZXR1cC5cbiAgICAgKlxuICAgICAqIEFjY2VwdHMgYW4gb3B0aW9uYWwgZnNNYXAgd2hpY2ggeW91IGNhbiB1c2UgdG8gYWRkIGFueSBmaWxlcywgb3Igb3ZlcndyaXRlIHRoZSBkZWZhdWx0IGZpbGUuXG4gICAgICpcbiAgICAgKiBUT0RPOiBJdCB3b3VsZCBiZSBnb29kIHRvIGNyZWF0ZSBhbiBlYXN5IHdheSB0byBoYXZlIGEgc2luZ2xlIHByb2dyYW0gaW5zdGFuY2Ugd2hpY2ggaXMgdXBkYXRlZCBmb3IgeW91XG4gICAgICogd2hlbiB0aGUgbW9uYWNvIG1vZGVsIGNoYW5nZXMuXG4gICAgICovXG4gICAgc2V0dXBUU1ZGUyxcbiAgICAvKiogVXNlcyB0aGUgYWJvdmUgY2FsbCBzZXR1cFRTVkZTLCBidXQgb25seSByZXR1cm5zIHRoZSBwcm9ncmFtICovXG4gICAgY3JlYXRlVFNQcm9ncmFtLFxuICAgIC8qKiBUaGUgU2FuZGJveCdzIGRlZmF1bHQgY29tcGlsZXIgb3B0aW9ucyAgKi9cbiAgICBjb21waWxlckRlZmF1bHRzLFxuICAgIC8qKiBUaGUgU2FuZGJveCdzIGN1cnJlbnQgY29tcGlsZXIgb3B0aW9ucyAqL1xuICAgIGdldENvbXBpbGVyT3B0aW9ucyxcbiAgICAvKiogUmVwbGFjZSB0aGUgU2FuZGJveCdzIGNvbXBpbGVyIG9wdGlvbnMgKi9cbiAgICBzZXRDb21waWxlclNldHRpbmdzLFxuICAgIC8qKiBPdmVyd3JpdGUgdGhlIFNhbmRib3gncyBjb21waWxlciBvcHRpb25zICovXG4gICAgdXBkYXRlQ29tcGlsZXJTZXR0aW5nLFxuICAgIC8qKiBVcGRhdGUgYSBzaW5nbGUgY29tcGlsZXIgb3B0aW9uIGluIHRoZSBTQW5kYm94ICovXG4gICAgdXBkYXRlQ29tcGlsZXJTZXR0aW5ncyxcbiAgICAvKiogQSB3YXkgdG8gZ2V0IGNhbGxiYWNrcyB3aGVuIGNvbXBpbGVyIHNldHRpbmdzIGhhdmUgY2hhbmdlZCAqL1xuICAgIHNldERpZFVwZGF0ZUNvbXBpbGVyU2V0dGluZ3MsXG4gICAgLyoqIEEgY29weSBvZiBsenN0cmluZywgd2hpY2ggaXMgdXNlZCB0byBhcmNoaXZlL3VuYXJjaGl2ZSBjb2RlICovXG4gICAgbHpzdHJpbmcsXG4gICAgLyoqIFJldHVybnMgY29tcGlsZXIgb3B0aW9ucyBmb3VuZCBpbiB0aGUgcGFyYW1zIG9mIHRoZSBjdXJyZW50IHBhZ2UgKi9cbiAgICBjcmVhdGVVUkxRdWVyeVdpdGhDb21waWxlck9wdGlvbnMsXG4gICAgLyoqXG4gICAgICogQGRlcHJlY2F0ZWQgVXNlIGBnZXRUd29TbGFzaENvbXBpbGVyT3B0aW9uc2AgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIFJldHVybnMgY29tcGlsZXIgb3B0aW9ucyBpbiB0aGUgc291cmNlIGNvZGUgdXNpbmcgdHdvc2xhc2ggbm90YXRpb25cbiAgICAgKi9cbiAgICBnZXRUd29TbGFzaENvbXBsaWVyT3B0aW9uczogZ2V0VHdvU2xhc2hDb21waWxlck9wdGlvbnMsXG4gICAgLyoqIFJldHVybnMgY29tcGlsZXIgb3B0aW9ucyBpbiB0aGUgc291cmNlIGNvZGUgdXNpbmcgdHdvc2xhc2ggbm90YXRpb24gKi9cbiAgICBnZXRUd29TbGFzaENvbXBpbGVyT3B0aW9ucyxcbiAgICAvKiogR2V0cyB0byB0aGUgY3VycmVudCBtb25hY28tbGFuZ3VhZ2UsIHRoaXMgaXMgaG93IHlvdSB0YWxrIHRvIHRoZSBiYWNrZ3JvdW5kIHdlYndvcmtlcnMgKi9cbiAgICBsYW5ndWFnZVNlcnZpY2VEZWZhdWx0czogZGVmYXVsdHMsXG4gICAgLyoqIFRoZSBwYXRoIHdoaWNoIHJlcHJlc2VudHMgdGhlIGN1cnJlbnQgZmlsZSB1c2luZyB0aGUgY3VycmVudCBjb21waWxlciBvcHRpb25zICovXG4gICAgZmlsZXBhdGg6IGZpbGVQYXRoLnBhdGgsXG4gICAgLyoqIEFkZHMgYSBmaWxlIHRvIHRoZSB2ZnMgdXNlZCBieSB0aGUgZWRpdG9yICovXG4gICAgYWRkTGlicmFyeVRvUnVudGltZSxcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBTYW5kYm94ID0gUmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlVHlwZVNjcmlwdFNhbmRib3g+XG4iXX0=