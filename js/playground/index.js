define(["require", "exports", "./createElements", "./sidebar/runtime", "./exporter", "./createUI", "./getExample", "./monaco/ExampleHighlight", "./createConfigDropdown", "./sidebar/plugins", "./pluginUtils", "./sidebar/settings", "./navigation"], function (require, exports, createElements_1, runtime_1, exporter_1, createUI_1, getExample_1, ExampleHighlight_1, createConfigDropdown_1, plugins_1, pluginUtils_1, settings_1, navigation_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setupPlayground = void 0;
    const setupPlayground = (sandbox, monaco, config, i, react) => {
        const playgroundParent = sandbox.getDomNode().parentElement.parentElement.parentElement;
        // UI to the left
        const leftNav = (0, createElements_1.createNavigationSection)();
        playgroundParent.insertBefore(leftNav, sandbox.getDomNode().parentElement.parentElement);
        const dragBarLeft = (0, createElements_1.createDragBar)("left");
        playgroundParent.insertBefore(dragBarLeft, sandbox.getDomNode().parentElement.parentElement);
        leftNav.style.display = "none";
        dragBarLeft.style.display = "none";
        const showNav = () => {
            const right = document.getElementsByClassName("playground-sidebar").item(0);
            const middle = document.getElementById("editor-container");
            middle.style.width = `calc(100% - ${right.clientWidth + 180}px)`;
            leftNav.style.display = "block";
            leftNav.style.width = "180px";
            leftNav.style.minWidth = "180px";
            leftNav.style.maxWidth = "180px";
            dragBarLeft.style.display = "block";
        };
        // UI to the right
        const dragBar = (0, createElements_1.createDragBar)("right");
        playgroundParent.appendChild(dragBar);
        const sidebar = (0, createElements_1.createSidebar)();
        playgroundParent.appendChild(sidebar);
        const tabBar = (0, createElements_1.createTabBar)();
        sidebar.appendChild(tabBar);
        const container = (0, createElements_1.createPluginContainer)();
        sidebar.appendChild(container);
        const plugins = [];
        const tabs = [];
        // Let's things like the workbench hook into tab changes
        let didUpdateTab;
        const registerPlugin = (plugin) => {
            plugins.push(plugin);
            const tab = (0, createElements_1.createTabForPlugin)(plugin);
            tabs.push(tab);
            const tabClicked = e => {
                const previousPlugin = getCurrentPlugin();
                let newTab = e.target;
                // It could be a notification you clicked on
                if (newTab.tagName === "DIV")
                    newTab = newTab.parentElement;
                const newPlugin = plugins.find(p => `playground-plugin-tab-${p.id}` == newTab.id);
                (0, createElements_1.activatePlugin)(newPlugin, previousPlugin, sandbox, tabBar, container);
                didUpdateTab && didUpdateTab(newPlugin, previousPlugin);
            };
            tabBar.appendChild(tab);
            tab.onclick = tabClicked;
        };
        const setDidUpdateTab = (func) => {
            didUpdateTab = func;
        };
        const getCurrentPlugin = () => {
            const selectedTab = tabs.find(t => t.classList.contains("active"));
            return plugins[tabs.indexOf(selectedTab)];
        };
        const defaultPlugins = config.plugins || (0, settings_1.getPlaygroundPlugins)();
        const utils = (0, pluginUtils_1.createUtils)(sandbox, react);
        const initialPlugins = defaultPlugins.map(f => f(i, utils));
        initialPlugins.forEach(p => registerPlugin(p));
        // Choose which should be selected
        const priorityPlugin = plugins.find(plugin => plugin.shouldBeSelected && plugin.shouldBeSelected());
        const selectedPlugin = priorityPlugin || plugins[0];
        const selectedTab = tabs[plugins.indexOf(selectedPlugin)];
        selectedTab.onclick({ target: selectedTab });
        let debouncingTimer = false;
        sandbox.editor.onDidChangeModelContent(_event => {
            const plugin = getCurrentPlugin();
            if (plugin.modelChanged)
                plugin.modelChanged(sandbox, sandbox.getModel(), container);
            // This needs to be last in the function
            if (debouncingTimer)
                return;
            debouncingTimer = true;
            setTimeout(() => {
                debouncingTimer = false;
                playgroundDebouncedMainFunction();
                // Only call the plugin function once every 0.3s
                if (plugin.modelChangedDebounce && plugin.id === getCurrentPlugin().id) {
                    plugin.modelChangedDebounce(sandbox, sandbox.getModel(), container);
                }
            }, 300);
        });
        // If you set this to true, then the next time the playground would
        // have set the user's hash it would be skipped - used for setting
        // the text in examples
        let suppressNextTextChangeForHashChange = false;
        // Sets the URL and storage of the sandbox string
        const playgroundDebouncedMainFunction = () => {
            localStorage.setItem("sandbox-history", sandbox.getText());
        };
        sandbox.editor.onDidBlurEditorText(() => {
            const alwaysUpdateURL = !localStorage.getItem("disable-save-on-type");
            if (alwaysUpdateURL) {
                if (suppressNextTextChangeForHashChange) {
                    suppressNextTextChangeForHashChange = false;
                    return;
                }
                const newURL = sandbox.createURLQueryWithCompilerOptions(sandbox);
                window.history.replaceState({}, "", newURL);
            }
        });
        // When any compiler flags are changed, trigger a potential change to the URL
        sandbox.setDidUpdateCompilerSettings(() => {
            playgroundDebouncedMainFunction();
            // @ts-ignore
            window.appInsights && window.appInsights.trackEvent({ name: "Compiler Settings changed" });
            const model = sandbox.editor.getModel();
            const plugin = getCurrentPlugin();
            if (model && plugin.modelChanged)
                plugin.modelChanged(sandbox, model, container);
            if (model && plugin.modelChangedDebounce)
                plugin.modelChangedDebounce(sandbox, model, container);
            const alwaysUpdateURL = !localStorage.getItem("disable-save-on-type");
            if (alwaysUpdateURL) {
                const newURL = sandbox.createURLQueryWithCompilerOptions(sandbox);
                window.history.replaceState({}, "", newURL);
            }
        });
        const skipInitiallySettingHash = document.location.hash && document.location.hash.includes("example/");
        if (!skipInitiallySettingHash)
            playgroundDebouncedMainFunction();
        // Setup working with the existing UI, once it's loaded
        // Versions of TypeScript
        // Set up the label for the dropdown
        const versionButton = document.querySelectorAll("#versions > a").item(0);
        versionButton.innerHTML = "v" + sandbox.ts.version + " <span class='caret'/>";
        versionButton.setAttribute("aria-label", `Select version of TypeScript, currently ${sandbox.ts.version}`);
        // Add the versions to the dropdown
        const versionsMenu = document.querySelectorAll("#versions > ul").item(0);
        // Enable all submenus
        document.querySelectorAll("nav ul li").forEach(e => e.classList.add("active"));
        const notWorkingInPlayground = ["3.1.6", "3.0.1", "2.8.1", "2.7.2", "2.4.1"];
        const allVersions = [...sandbox.supportedVersions.filter(f => !notWorkingInPlayground.includes(f)), "Nightly"];
        allVersions.forEach((v) => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.textContent = v;
            a.href = "#";
            if (v === "Nightly") {
                li.classList.add("nightly");
            }
            if (v.toLowerCase().includes("beta")) {
                li.classList.add("beta");
            }
            li.onclick = () => {
                const currentURL = sandbox.createURLQueryWithCompilerOptions(sandbox);
                const params = new URLSearchParams(currentURL.split("#")[0]);
                const version = v === "Nightly" ? "next" : v;
                params.set("ts", version);
                const hash = document.location.hash.length ? document.location.hash : "";
                const newURL = `${document.location.protocol}//${document.location.host}${document.location.pathname}?${params}${hash}`;
                // @ts-ignore - it is allowed
                document.location = newURL;
            };
            li.appendChild(a);
            versionsMenu.appendChild(li);
        });
        // Support dropdowns
        document.querySelectorAll(".navbar-sub li.dropdown > a").forEach(link => {
            const a = link;
            a.onclick = _e => {
                if (a.parentElement.classList.contains("open")) {
                    document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                    a.setAttribute("aria-expanded", "false");
                }
                else {
                    document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                    a.parentElement.classList.toggle("open");
                    a.setAttribute("aria-expanded", "true");
                    const exampleContainer = a.closest("li").getElementsByTagName("ul").item(0);
                    const firstLabel = exampleContainer.querySelector("label");
                    if (firstLabel)
                        firstLabel.focus();
                    // Set exact height and widths for the popovers for the main playground navigation
                    const isPlaygroundSubmenu = !!a.closest("nav");
                    if (isPlaygroundSubmenu) {
                        const playgroundContainer = document.getElementById("playground-container");
                        exampleContainer.style.height = `calc(${playgroundContainer.getBoundingClientRect().height + 26}px - 4rem)`;
                        const sideBarWidth = document.querySelector(".playground-sidebar").offsetWidth;
                        exampleContainer.style.width = `calc(100% - ${sideBarWidth}px - 71px)`;
                        // All this is to make sure that tabbing stays inside the dropdown for tsconfig/examples
                        const buttons = exampleContainer.querySelectorAll("input");
                        const lastButton = buttons.item(buttons.length - 1);
                        if (lastButton) {
                            redirectTabPressTo(lastButton, exampleContainer, ".examples-close");
                        }
                        else {
                            const sections = document.querySelectorAll("ul.examples-dropdown .section-content");
                            sections.forEach(s => {
                                const buttons = s.querySelectorAll("a.example-link");
                                const lastButton = buttons.item(buttons.length - 1);
                                if (lastButton) {
                                    redirectTabPressTo(lastButton, exampleContainer, ".examples-close");
                                }
                            });
                        }
                    }
                }
                return false;
            };
        });
        // Handle escape closing dropdowns etc
        document.onkeydown = function (evt) {
            evt = evt || window.event;
            var isEscape = false;
            if ("key" in evt) {
                isEscape = evt.key === "Escape" || evt.key === "Esc";
            }
            else {
                // @ts-ignore - this used to be the case
                isEscape = evt.keyCode === 27;
            }
            if (isEscape) {
                document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                document.querySelectorAll(".navbar-sub li").forEach(i => i.setAttribute("aria-expanded", "false"));
            }
        };
        const shareAction = {
            id: "copy-clipboard",
            label: "Save to clipboard",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
            contextMenuGroupId: "run",
            contextMenuOrder: 1.5,
            run: function () {
                // Update the URL, then write that to the clipboard
                const newURL = sandbox.createURLQueryWithCompilerOptions(sandbox);
                window.history.replaceState({}, "", newURL);
                window.navigator.clipboard.writeText(location.href.toString()).then(() => ui.flashInfo(i("play_export_clipboard")), (e) => alert(e));
            },
        };
        const shareButton = document.getElementById("share-button");
        if (shareButton) {
            shareButton.onclick = e => {
                e.preventDefault();
                shareAction.run();
                return false;
            };
            // Set up some key commands
            sandbox.editor.addAction(shareAction);
            sandbox.editor.addAction({
                id: "run-js",
                label: "Run the evaluated JavaScript for your TypeScript file",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                contextMenuGroupId: "run",
                contextMenuOrder: 1.5,
                run: function (ed) {
                    const runButton = document.getElementById("run-button");
                    runButton && runButton.onclick && runButton.onclick({});
                },
            });
        }
        const runButton = document.getElementById("run-button");
        if (runButton) {
            runButton.onclick = () => {
                const run = sandbox.getRunnableJS();
                const runPlugin = plugins.find(p => p.id === "logs");
                (0, createElements_1.activatePlugin)(runPlugin, getCurrentPlugin(), sandbox, tabBar, container);
                (0, runtime_1.runWithCustomLogs)(run, i);
                const isJS = sandbox.config.filetype === "js";
                ui.flashInfo(i(isJS ? "play_run_js" : "play_run_ts"));
                return false;
            };
        }
        // Handle the close buttons on the examples
        document.querySelectorAll("button.examples-close").forEach(b => {
            const button = b;
            button.onclick = (e) => {
                const button = e.target;
                const navLI = button.closest("li");
                navLI === null || navLI === void 0 ? void 0 : navLI.classList.remove("open");
            };
        });
        (0, createElements_1.setupSidebarToggle)();
        if (document.getElementById("config-container")) {
            (0, createConfigDropdown_1.createConfigDropdown)(sandbox, monaco);
            (0, createConfigDropdown_1.updateConfigDropdownForCompilerOptions)(sandbox, monaco);
        }
        if (document.getElementById("playground-settings")) {
            const settingsToggle = document.getElementById("playground-settings");
            settingsToggle.onclick = () => {
                const open = settingsToggle.parentElement.classList.contains("open");
                const sidebarTabs = document.querySelector(".playground-plugin-tabview");
                const sidebarContent = document.querySelector(".playground-plugin-container");
                let settingsContent = document.querySelector(".playground-settings-container");
                if (!settingsContent) {
                    settingsContent = document.createElement("div");
                    settingsContent.className = "playground-settings-container playground-plugin-container";
                    const settings = (0, settings_1.settingsPlugin)(i, utils);
                    settings.didMount && settings.didMount(sandbox, settingsContent);
                    document.querySelector(".playground-sidebar").appendChild(settingsContent);
                    // When the last tab item is hit, go back to the settings button
                    const labels = document.querySelectorAll(".playground-sidebar input");
                    const lastLabel = labels.item(labels.length - 1);
                    if (lastLabel) {
                        redirectTabPressTo(lastLabel, undefined, "#playground-settings");
                    }
                }
                if (open) {
                    sidebarTabs.style.display = "flex";
                    sidebarContent.style.display = "block";
                    settingsContent.style.display = "none";
                }
                else {
                    sidebarTabs.style.display = "none";
                    sidebarContent.style.display = "none";
                    settingsContent.style.display = "block";
                    document.querySelector(".playground-sidebar label").focus();
                }
                settingsToggle.parentElement.classList.toggle("open");
            };
            settingsToggle.addEventListener("keydown", e => {
                const isOpen = settingsToggle.parentElement.classList.contains("open");
                if (e.key === "Tab" && isOpen) {
                    const result = document.querySelector(".playground-options li input");
                    result.focus();
                    e.preventDefault();
                }
            });
        }
        // Support grabbing examples from the location hash
        if (location.hash.startsWith("#example")) {
            const exampleName = location.hash.replace("#example/", "").trim();
            sandbox.config.logger.log("Loading example:", exampleName);
            (0, getExample_1.getExampleSourceCode)(config.prefix, config.lang, exampleName).then(ex => {
                if (ex.example && ex.code) {
                    const { example, code } = ex;
                    // Update the localstorage showing that you've seen this page
                    if (localStorage) {
                        const seenText = localStorage.getItem("examples-seen") || "{}";
                        const seen = JSON.parse(seenText);
                        seen[example.id] = example.hash;
                        localStorage.setItem("examples-seen", JSON.stringify(seen));
                    }
                    const allLinks = document.querySelectorAll("example-link");
                    // @ts-ignore
                    for (const link of allLinks) {
                        if (link.textContent === example.title) {
                            link.classList.add("highlight");
                        }
                    }
                    document.title = "TypeScript Playground - " + example.title;
                    suppressNextTextChangeForHashChange = true;
                    sandbox.setText(code);
                }
                else {
                    suppressNextTextChangeForHashChange = true;
                    sandbox.setText("// There was an issue getting the example, bad URL? Check the console in the developer tools");
                }
            });
        }
        const model = sandbox.getModel();
        model.onDidChangeDecorations(() => {
            const markers = sandbox.monaco.editor.getModelMarkers({ resource: model.uri }).filter(m => m.severity !== 1);
            utils.setNotifications("errors", markers.length);
        });
        // Sets up a way to click between examples
        monaco.languages.registerLinkProvider(sandbox.language, new ExampleHighlight_1.ExampleHighlighter());
        const languageSelector = document.getElementById("language-selector");
        if (languageSelector) {
            const params = new URLSearchParams(location.search);
            const options = ["ts", "d.ts", "js"];
            languageSelector.options.selectedIndex = options.indexOf(params.get("filetype") || "ts");
            languageSelector.onchange = () => {
                const filetype = options[Number(languageSelector.selectedIndex || 0)];
                const query = sandbox.createURLQueryWithCompilerOptions(sandbox, { filetype });
                const fullURL = `${document.location.protocol}//${document.location.host}${document.location.pathname}${query}`;
                // @ts-ignore
                document.location = fullURL;
            };
        }
        // Ensure that the editor is full-width when the screen resizes
        window.addEventListener("resize", () => {
            sandbox.editor.layout();
        });
        const ui = (0, createUI_1.createUI)();
        const exporter = (0, exporter_1.createExporter)(sandbox, monaco, ui);
        const playground = {
            exporter,
            ui,
            registerPlugin,
            plugins,
            getCurrentPlugin,
            tabs,
            setDidUpdateTab,
            createUtils: pluginUtils_1.createUtils,
        };
        window.ts = sandbox.ts;
        window.sandbox = sandbox;
        window.playground = playground;
        console.log(`Using TypeScript ${window.ts.version}`);
        console.log("Available globals:");
        console.log("\twindow.ts", window.ts);
        console.log("\twindow.sandbox", window.sandbox);
        console.log("\twindow.playground", window.playground);
        console.log("\twindow.react", window.react);
        console.log("\twindow.reactDOM", window.reactDOM);
        /** A plugin */
        const activateExternalPlugin = (plugin, autoActivate) => {
            let readyPlugin;
            // Can either be a factory, or object
            if (typeof plugin === "function") {
                const utils = (0, pluginUtils_1.createUtils)(sandbox, react);
                readyPlugin = plugin(utils);
            }
            else {
                readyPlugin = plugin;
            }
            if (autoActivate) {
                console.log(readyPlugin);
            }
            playground.registerPlugin(readyPlugin);
            // Auto-select the dev plugin
            const pluginWantsFront = readyPlugin.shouldBeSelected && readyPlugin.shouldBeSelected();
            if (pluginWantsFront || autoActivate) {
                // Auto-select the dev plugin
                (0, createElements_1.activatePlugin)(readyPlugin, getCurrentPlugin(), sandbox, tabBar, container);
            }
        };
        // Dev mode plugin
        if (config.supportCustomPlugins && (0, plugins_1.allowConnectingToLocalhost)()) {
            window.exports = {};
            console.log("Connecting to dev plugin");
            try {
                // @ts-ignore
                const re = window.require;
                re(["local/index"], (devPlugin) => {
                    console.log("Set up dev plugin from localhost:5000");
                    try {
                        activateExternalPlugin(devPlugin, true);
                    }
                    catch (error) {
                        console.error(error);
                        setTimeout(() => {
                            ui.flashInfo("Error: Could not load dev plugin from localhost:5000");
                        }, 700);
                    }
                });
            }
            catch (error) {
                console.error("Problem loading up the dev plugin");
                console.error(error);
            }
        }
        const downloadPlugin = (plugin, autoEnable) => {
            try {
                // @ts-ignore
                const re = window.require;
                re([`unpkg/${plugin}@latest/dist/index`], (devPlugin) => {
                    activateExternalPlugin(devPlugin, autoEnable);
                });
            }
            catch (error) {
                console.error("Problem loading up the plugin:", plugin);
                console.error(error);
            }
        };
        if (config.supportCustomPlugins) {
            // Grab ones from localstorage
            (0, plugins_1.activePlugins)().forEach(p => downloadPlugin(p.id, false));
            // Offer to install one if 'install-plugin' is a query param
            const params = new URLSearchParams(location.search);
            const pluginToInstall = params.get("install-plugin");
            if (pluginToInstall) {
                const alreadyInstalled = (0, plugins_1.activePlugins)().find(p => p.id === pluginToInstall);
                if (!alreadyInstalled) {
                    const shouldDoIt = confirm("Would you like to install the third party plugin?\n\n" + pluginToInstall);
                    if (shouldDoIt) {
                        (0, plugins_1.addCustomPlugin)(pluginToInstall);
                        downloadPlugin(pluginToInstall, true);
                    }
                }
            }
        }
        if (location.hash.startsWith("#show-examples")) {
            setTimeout(() => {
                var _a;
                (_a = document.getElementById("examples-button")) === null || _a === void 0 ? void 0 : _a.click();
            }, 100);
        }
        if (location.hash.startsWith("#show-whatisnew")) {
            setTimeout(() => {
                var _a;
                (_a = document.getElementById("whatisnew-button")) === null || _a === void 0 ? void 0 : _a.click();
            }, 100);
        }
        // Grab the contents of a Gist
        if (location.hash.startsWith("#gist/")) {
            (0, navigation_1.gistPoweredNavBar)(sandbox, ui, showNav);
        }
        return playground;
    };
    exports.setupPlayground = setupPlayground;
    const redirectTabPressTo = (element, container, query) => {
        element.addEventListener("keydown", e => {
            if (e.key === "Tab") {
                const host = container || document;
                const result = host.querySelector(query);
                if (!result)
                    throw new Error(`Expected to find a result for keydown`);
                result.focus();
                e.preventDefault();
            }
        });
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wbGF5Z3JvdW5kL3NyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0lBd0VPLE1BQU0sZUFBZSxHQUFHLENBQzdCLE9BQWdCLEVBQ2hCLE1BQWMsRUFDZCxNQUF3QixFQUN4QixDQUEwQixFQUMxQixLQUFtQixFQUNuQixFQUFFO1FBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsYUFBYyxDQUFDLGFBQWMsQ0FBQyxhQUFjLENBQUE7UUFDMUYsaUJBQWlCO1FBRWpCLE1BQU0sT0FBTyxHQUFHLElBQUEsd0NBQXVCLEdBQUUsQ0FBQTtRQUN6QyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxhQUFjLENBQUMsYUFBYyxDQUFDLENBQUE7UUFFMUYsTUFBTSxXQUFXLEdBQUcsSUFBQSw4QkFBYSxFQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ3pDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLGFBQWMsQ0FBQyxhQUFjLENBQUMsQ0FBQTtRQUU5RixPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUE7UUFDOUIsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFBO1FBRWxDLE1BQU0sT0FBTyxHQUFHLEdBQUcsRUFBRTtZQUNuQixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFFLENBQUE7WUFDNUUsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBRSxDQUFBO1lBQzNELE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLGVBQWUsS0FBSyxDQUFDLFdBQVcsR0FB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QUU7O2dCQUNkLE1BQUEsUUFBUSxDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQywwQ0FBRSxLQUFLLEVBQUUsQ0FBQTtZQUN0RCxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7U0FDUjtRQUVELDhCQUE4QjtRQUM5QixJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3RDLElBQUEsOEJBQWlCLEVBQUMsT0FBTyxFQUFFLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQTtTQUN4QztRQUVELE9BQU8sVUFBVSxDQUFBO0lBQ25CLENBQUMsQ0FBQTtJQXZrQlksUUFBQSxlQUFlLG1CQXVrQjNCO0lBSUQsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLE9BQW9CLEVBQUUsU0FBa0MsRUFBRSxLQUFhLEVBQUUsRUFBRTtRQUNyRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ3RDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxLQUFLLEVBQUU7Z0JBQ25CLE1BQU0sSUFBSSxHQUFHLFNBQVMsSUFBSSxRQUFRLENBQUE7Z0JBQ2xDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFRLENBQUE7Z0JBQy9DLElBQUksQ0FBQyxNQUFNO29CQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQTtnQkFDckUsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFBO2dCQUNkLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQTthQUNuQjtRQUNILENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsidHlwZSBTYW5kYm94ID0gaW1wb3J0KFwiQHR5cGVzY3JpcHQvc2FuZGJveFwiKS5TYW5kYm94XG50eXBlIE1vbmFjbyA9IHR5cGVvZiBpbXBvcnQoXCJtb25hY28tZWRpdG9yXCIpXG5cbmRlY2xhcmUgY29uc3Qgd2luZG93OiBhbnlcblxuaW1wb3J0IHtcbiAgY3JlYXRlU2lkZWJhcixcbiAgY3JlYXRlVGFiRm9yUGx1Z2luLFxuICBjcmVhdGVUYWJCYXIsXG4gIGNyZWF0ZVBsdWdpbkNvbnRhaW5lcixcbiAgYWN0aXZhdGVQbHVnaW4sXG4gIGNyZWF0ZURyYWdCYXIsXG4gIHNldHVwU2lkZWJhclRvZ2dsZSxcbiAgY3JlYXRlTmF2aWdhdGlvblNlY3Rpb24sXG59IGZyb20gXCIuL2NyZWF0ZUVsZW1lbnRzXCJcbmltcG9ydCB7IHJ1bldpdGhDdXN0b21Mb2dzIH0gZnJvbSBcIi4vc2lkZWJhci9ydW50aW1lXCJcbmltcG9ydCB7IGNyZWF0ZUV4cG9ydGVyIH0gZnJvbSBcIi4vZXhwb3J0ZXJcIlxuaW1wb3J0IHsgY3JlYXRlVUkgfSBmcm9tIFwiLi9jcmVhdGVVSVwiXG5pbXBvcnQgeyBnZXRFeGFtcGxlU291cmNlQ29kZSB9IGZyb20gXCIuL2dldEV4YW1wbGVcIlxuaW1wb3J0IHsgRXhhbXBsZUhpZ2hsaWdodGVyIH0gZnJvbSBcIi4vbW9uYWNvL0V4YW1wbGVIaWdobGlnaHRcIlxuaW1wb3J0IHsgY3JlYXRlQ29uZmlnRHJvcGRvd24sIHVwZGF0ZUNvbmZpZ0Ryb3Bkb3duRm9yQ29tcGlsZXJPcHRpb25zIH0gZnJvbSBcIi4vY3JlYXRlQ29uZmlnRHJvcGRvd25cIlxuaW1wb3J0IHsgYWxsb3dDb25uZWN0aW5nVG9Mb2NhbGhvc3QsIGFjdGl2ZVBsdWdpbnMsIGFkZEN1c3RvbVBsdWdpbiB9IGZyb20gXCIuL3NpZGViYXIvcGx1Z2luc1wiXG5pbXBvcnQgeyBjcmVhdGVVdGlscywgUGx1Z2luVXRpbHMgfSBmcm9tIFwiLi9wbHVnaW5VdGlsc1wiXG5pbXBvcnQgdHlwZSBSZWFjdCBmcm9tIFwicmVhY3RcIlxuaW1wb3J0IHsgc2V0dGluZ3NQbHVnaW4sIGdldFBsYXlncm91bmRQbHVnaW5zIH0gZnJvbSBcIi4vc2lkZWJhci9zZXR0aW5nc1wiXG5pbXBvcnQgeyBnaXN0UG93ZXJlZE5hdkJhciB9IGZyb20gXCIuL25hdmlnYXRpb25cIlxuXG5leHBvcnQgeyBQbHVnaW5VdGlscyB9IGZyb20gXCIuL3BsdWdpblV0aWxzXCJcblxuZXhwb3J0IHR5cGUgUGx1Z2luRmFjdG9yeSA9IHtcbiAgKGk6IChrZXk6IHN0cmluZywgY29tcG9uZW50cz86IGFueSkgPT4gc3RyaW5nLCB1dGlsczogUGx1Z2luVXRpbHMpOiBQbGF5Z3JvdW5kUGx1Z2luXG59XG5cbi8qKiBUaGUgaW50ZXJmYWNlIG9mIGFsbCBzaWRlYmFyIHBsdWdpbnMgKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGxheWdyb3VuZFBsdWdpbiB7XG4gIC8qKiBOb3QgcHVibGljIGZhY2luZywgYnV0IHVzZWQgYnkgdGhlIHBsYXlncm91bmQgdG8gdW5pcXVlbHkgaWRlbnRpZnkgcGx1Z2lucyAqL1xuICBpZDogc3RyaW5nXG4gIC8qKiBUbyBzaG93IGluIHRoZSB0YWJzICovXG4gIGRpc3BsYXlOYW1lOiBzdHJpbmdcbiAgLyoqIFNob3VsZCB0aGlzIHBsdWdpbiBiZSBzZWxlY3RlZCB3aGVuIHRoZSBwbHVnaW4gaXMgZmlyc3QgbG9hZGVkPyBMZXRzIHlvdSBjaGVjayBmb3IgcXVlcnkgdmFycyBldGMgdG8gbG9hZCBhIHBhcnRpY3VsYXIgcGx1Z2luICovXG4gIHNob3VsZEJlU2VsZWN0ZWQ/OiAoKSA9PiBib29sZWFuXG4gIC8qKiBCZWZvcmUgd2Ugc2hvdyB0aGUgdGFiLCB1c2UgdGhpcyB0byBzZXQgdXAgeW91ciBIVE1MIC0gaXQgd2lsbCBhbGwgYmUgcmVtb3ZlZCBieSB0aGUgcGxheWdyb3VuZCB3aGVuIHNvbWVvbmUgbmF2aWdhdGVzIG9mZiB0aGUgdGFiICovXG4gIHdpbGxNb3VudD86IChzYW5kYm94OiBTYW5kYm94LCBjb250YWluZXI6IEhUTUxEaXZFbGVtZW50KSA9PiB2b2lkXG4gIC8qKiBBZnRlciB3ZSBzaG93IHRoZSB0YWIgKi9cbiAgZGlkTW91bnQ/OiAoc2FuZGJveDogU2FuZGJveCwgY29udGFpbmVyOiBIVE1MRGl2RWxlbWVudCkgPT4gdm9pZFxuICAvKiogTW9kZWwgY2hhbmdlcyB3aGlsZSB0aGlzIHBsdWdpbiBpcyBhY3RpdmVseSBzZWxlY3RlZCAgKi9cbiAgbW9kZWxDaGFuZ2VkPzogKHNhbmRib3g6IFNhbmRib3gsIG1vZGVsOiBpbXBvcnQoXCJtb25hY28tZWRpdG9yXCIpLmVkaXRvci5JVGV4dE1vZGVsLCBjb250YWluZXI6IEhUTUxEaXZFbGVtZW50KSA9PiB2b2lkXG4gIC8qKiBEZWxheWVkIG1vZGVsIGNoYW5nZXMgd2hpbGUgdGhpcyBwbHVnaW4gaXMgYWN0aXZlbHkgc2VsZWN0ZWQsIHVzZWZ1bCB3aGVuIHlvdSBhcmUgd29ya2luZyB3aXRoIHRoZSBUUyBBUEkgYmVjYXVzZSBpdCB3b24ndCBydW4gb24gZXZlcnkga2V5cHJlc3MgKi9cbiAgbW9kZWxDaGFuZ2VkRGVib3VuY2U/OiAoXG4gICAgc2FuZGJveDogU2FuZGJveCxcbiAgICBtb2RlbDogaW1wb3J0KFwibW9uYWNvLWVkaXRvclwiKS5lZGl0b3IuSVRleHRNb2RlbCxcbiAgICBjb250YWluZXI6IEhUTUxEaXZFbGVtZW50XG4gICkgPT4gdm9pZFxuICAvKiogQmVmb3JlIHdlIHJlbW92ZSB0aGUgdGFiICovXG4gIHdpbGxVbm1vdW50PzogKHNhbmRib3g6IFNhbmRib3gsIGNvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQpID0+IHZvaWRcbiAgLyoqIEFmdGVyIHdlIHJlbW92ZSB0aGUgdGFiICovXG4gIGRpZFVubW91bnQ/OiAoc2FuZGJveDogU2FuZGJveCwgY29udGFpbmVyOiBIVE1MRGl2RWxlbWVudCkgPT4gdm9pZFxuICAvKiogQW4gb2JqZWN0IHlvdSBjYW4gdXNlIHRvIGtlZXAgZGF0YSBhcm91bmQgaW4gdGhlIHNjb3BlIG9mIHlvdXIgcGx1Z2luIG9iamVjdCAqL1xuICBkYXRhPzogYW55XG59XG5cbmludGVyZmFjZSBQbGF5Z3JvdW5kQ29uZmlnIHtcbiAgLyoqIExhbmd1YWdlIGxpa2UgXCJlblwiIC8gXCJqYVwiIGV0YyAqL1xuICBsYW5nOiBzdHJpbmdcbiAgLyoqIFNpdGUgcHJlZml4LCBsaWtlIFwidjJcIiBkdXJpbmcgdGhlIHByZS1yZWxlYXNlICovXG4gIHByZWZpeDogc3RyaW5nXG4gIC8qKiBPcHRpb25hbCBwbHVnaW5zIHNvIHRoYXQgd2UgY2FuIHJlLXVzZSB0aGUgcGxheWdyb3VuZCB3aXRoIGRpZmZlcmVudCBzaWRlYmFycyAqL1xuICBwbHVnaW5zPzogUGx1Z2luRmFjdG9yeVtdXG4gIC8qKiBTaG91bGQgdGhpcyBwbGF5Z3JvdW5kIGxvYWQgdXAgY3VzdG9tIHBsdWdpbnMgZnJvbSBsb2NhbFN0b3JhZ2U/ICovXG4gIHN1cHBvcnRDdXN0b21QbHVnaW5zOiBib29sZWFuXG59XG5cbmV4cG9ydCBjb25zdCBzZXR1cFBsYXlncm91bmQgPSAoXG4gIHNhbmRib3g6IFNhbmRib3gsXG4gIG1vbmFjbzogTW9uYWNvLFxuICBjb25maWc6IFBsYXlncm91bmRDb25maWcsXG4gIGk6IChrZXk6IHN0cmluZykgPT4gc3RyaW5nLFxuICByZWFjdDogdHlwZW9mIFJlYWN0XG4pID0+IHtcbiAgY29uc3QgcGxheWdyb3VuZFBhcmVudCA9IHNhbmRib3guZ2V0RG9tTm9kZSgpLnBhcmVudEVsZW1lbnQhLnBhcmVudEVsZW1lbnQhLnBhcmVudEVsZW1lbnQhXG4gIC8vIFVJIHRvIHRoZSBsZWZ0XG5cbiAgY29uc3QgbGVmdE5hdiA9IGNyZWF0ZU5hdmlnYXRpb25TZWN0aW9uKClcbiAgcGxheWdyb3VuZFBhcmVudC5pbnNlcnRCZWZvcmUobGVmdE5hdiwgc2FuZGJveC5nZXREb21Ob2RlKCkucGFyZW50RWxlbWVudCEucGFyZW50RWxlbWVudCEpXG5cbiAgY29uc3QgZHJhZ0JhckxlZnQgPSBjcmVhdGVEcmFnQmFyKFwibGVmdFwiKVxuICBwbGF5Z3JvdW5kUGFyZW50Lmluc2VydEJlZm9yZShkcmFnQmFyTGVmdCwgc2FuZGJveC5nZXREb21Ob2RlKCkucGFyZW50RWxlbWVudCEucGFyZW50RWxlbWVudCEpXG5cbiAgbGVmdE5hdi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcbiAgZHJhZ0JhckxlZnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cbiAgY29uc3Qgc2hvd05hdiA9ICgpID0+IHtcbiAgICBjb25zdCByaWdodCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJwbGF5Z3JvdW5kLXNpZGViYXJcIikuaXRlbSgwKSFcbiAgICBjb25zdCBtaWRkbGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImVkaXRvci1jb250YWluZXJcIikhXG4gICAgbWlkZGxlLnN0eWxlLndpZHRoID0gYGNhbGMoMTAwJSAtICR7cmlnaHQuY2xpZW50V2lkdGggKyAxODB9cHgpYFxuXG4gICAgbGVmdE5hdi5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiXG4gICAgbGVmdE5hdi5zdHlsZS53aWR0aCA9IFwiMTgwcHhcIlxuICAgIGxlZnROYXYuc3R5bGUubWluV2lkdGggPSBcIjE4MHB4XCJcbiAgICBsZWZ0TmF2LnN0eWxlLm1heFdpZHRoID0gXCIxODBweFwiXG4gICAgZHJhZ0JhckxlZnQuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIlxuICB9XG5cbiAgLy8gVUkgdG8gdGhlIHJpZ2h0XG4gIGNvbnN0IGRyYWdCYXIgPSBjcmVhdGVEcmFnQmFyKFwicmlnaHRcIilcbiAgcGxheWdyb3VuZFBhcmVudC5hcHBlbmRDaGlsZChkcmFnQmFyKVxuXG4gIGNvbnN0IHNpZGViYXIgPSBjcmVhdGVTaWRlYmFyKClcbiAgcGxheWdyb3VuZFBhcmVudC5hcHBlbmRDaGlsZChzaWRlYmFyKVxuXG4gIGNvbnN0IHRhYkJhciA9IGNyZWF0ZVRhYkJhcigpXG4gIHNpZGViYXIuYXBwZW5kQ2hpbGQodGFiQmFyKVxuXG4gIGNvbnN0IGNvbnRhaW5lciA9IGNyZWF0ZVBsdWdpbkNvbnRhaW5lcigpXG4gIHNpZGViYXIuYXBwZW5kQ2hpbGQoY29udGFpbmVyKVxuXG4gIGNvbnN0IHBsdWdpbnMgPSBbXSBhcyBQbGF5Z3JvdW5kUGx1Z2luW11cbiAgY29uc3QgdGFicyA9IFtdIGFzIEhUTUxCdXR0b25FbGVtZW50W11cblxuICAvLyBMZXQncyB0aGluZ3MgbGlrZSB0aGUgd29ya2JlbmNoIGhvb2sgaW50byB0YWIgY2hhbmdlc1xuICBsZXQgZGlkVXBkYXRlVGFiOiAobmV3UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luLCBwcmV2aW91c1BsdWdpbjogUGxheWdyb3VuZFBsdWdpbikgPT4gdm9pZCB8IHVuZGVmaW5lZFxuXG4gIGNvbnN0IHJlZ2lzdGVyUGx1Z2luID0gKHBsdWdpbjogUGxheWdyb3VuZFBsdWdpbikgPT4ge1xuICAgIHBsdWdpbnMucHVzaChwbHVnaW4pXG5cbiAgICBjb25zdCB0YWIgPSBjcmVhdGVUYWJGb3JQbHVnaW4ocGx1Z2luKVxuXG4gICAgdGFicy5wdXNoKHRhYilcblxuICAgIGNvbnN0IHRhYkNsaWNrZWQ6IEhUTUxFbGVtZW50W1wib25jbGlja1wiXSA9IGUgPT4ge1xuICAgICAgY29uc3QgcHJldmlvdXNQbHVnaW4gPSBnZXRDdXJyZW50UGx1Z2luKClcbiAgICAgIGxldCBuZXdUYWIgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudFxuICAgICAgLy8gSXQgY291bGQgYmUgYSBub3RpZmljYXRpb24geW91IGNsaWNrZWQgb25cbiAgICAgIGlmIChuZXdUYWIudGFnTmFtZSA9PT0gXCJESVZcIikgbmV3VGFiID0gbmV3VGFiLnBhcmVudEVsZW1lbnQhXG4gICAgICBjb25zdCBuZXdQbHVnaW4gPSBwbHVnaW5zLmZpbmQocCA9PiBgcGxheWdyb3VuZC1wbHVnaW4tdGFiLSR7cC5pZH1gID09IG5ld1RhYi5pZCkhXG4gICAgICBhY3RpdmF0ZVBsdWdpbihuZXdQbHVnaW4sIHByZXZpb3VzUGx1Z2luLCBzYW5kYm94LCB0YWJCYXIsIGNvbnRhaW5lcilcbiAgICAgIGRpZFVwZGF0ZVRhYiAmJiBkaWRVcGRhdGVUYWIobmV3UGx1Z2luLCBwcmV2aW91c1BsdWdpbilcbiAgICB9XG5cbiAgICB0YWJCYXIuYXBwZW5kQ2hpbGQodGFiKVxuICAgIHRhYi5vbmNsaWNrID0gdGFiQ2xpY2tlZFxuICB9XG5cbiAgY29uc3Qgc2V0RGlkVXBkYXRlVGFiID0gKGZ1bmM6IChuZXdQbHVnaW46IFBsYXlncm91bmRQbHVnaW4sIHByZXZpb3VzUGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luKSA9PiB2b2lkKSA9PiB7XG4gICAgZGlkVXBkYXRlVGFiID0gZnVuY1xuICB9XG5cbiAgY29uc3QgZ2V0Q3VycmVudFBsdWdpbiA9ICgpID0+IHtcbiAgICBjb25zdCBzZWxlY3RlZFRhYiA9IHRhYnMuZmluZCh0ID0+IHQuY2xhc3NMaXN0LmNvbnRhaW5zKFwiYWN0aXZlXCIpKSFcbiAgICByZXR1cm4gcGx1Z2luc1t0YWJzLmluZGV4T2Yoc2VsZWN0ZWRUYWIpXVxuICB9XG5cbiAgY29uc3QgZGVmYXVsdFBsdWdpbnMgPSBjb25maWcucGx1Z2lucyB8fCBnZXRQbGF5Z3JvdW5kUGx1Z2lucygpXG4gIGNvbnN0IHV0aWxzID0gY3JlYXRlVXRpbHMoc2FuZGJveCwgcmVhY3QpXG4gIGNvbnN0IGluaXRpYWxQbHVnaW5zID0gZGVmYXVsdFBsdWdpbnMubWFwKGYgPT4gZihpLCB1dGlscykpXG4gIGluaXRpYWxQbHVnaW5zLmZvckVhY2gocCA9PiByZWdpc3RlclBsdWdpbihwKSlcblxuICAvLyBDaG9vc2Ugd2hpY2ggc2hvdWxkIGJlIHNlbGVjdGVkXG4gIGNvbnN0IHByaW9yaXR5UGx1Z2luID0gcGx1Z2lucy5maW5kKHBsdWdpbiA9PiBwbHVnaW4uc2hvdWxkQmVTZWxlY3RlZCAmJiBwbHVnaW4uc2hvdWxkQmVTZWxlY3RlZCgpKVxuICBjb25zdCBzZWxlY3RlZFBsdWdpbiA9IHByaW9yaXR5UGx1Z2luIHx8IHBsdWdpbnNbMF1cbiAgY29uc3Qgc2VsZWN0ZWRUYWIgPSB0YWJzW3BsdWdpbnMuaW5kZXhPZihzZWxlY3RlZFBsdWdpbildIVxuICBzZWxlY3RlZFRhYi5vbmNsaWNrISh7IHRhcmdldDogc2VsZWN0ZWRUYWIgfSBhcyBhbnkpXG5cbiAgbGV0IGRlYm91bmNpbmdUaW1lciA9IGZhbHNlXG4gIHNhbmRib3guZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KF9ldmVudCA9PiB7XG4gICAgY29uc3QgcGx1Z2luID0gZ2V0Q3VycmVudFBsdWdpbigpXG4gICAgaWYgKHBsdWdpbi5tb2RlbENoYW5nZWQpIHBsdWdpbi5tb2RlbENoYW5nZWQoc2FuZGJveCwgc2FuZGJveC5nZXRNb2RlbCgpLCBjb250YWluZXIpXG5cbiAgICAvLyBUaGlzIG5lZWRzIHRvIGJlIGxhc3QgaW4gdGhlIGZ1bmN0aW9uXG4gICAgaWYgKGRlYm91bmNpbmdUaW1lcikgcmV0dXJuXG4gICAgZGVib3VuY2luZ1RpbWVyID0gdHJ1ZVxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZGVib3VuY2luZ1RpbWVyID0gZmFsc2VcbiAgICAgIHBsYXlncm91bmREZWJvdW5jZWRNYWluRnVuY3Rpb24oKVxuXG4gICAgICAvLyBPbmx5IGNhbGwgdGhlIHBsdWdpbiBmdW5jdGlvbiBvbmNlIGV2ZXJ5IDAuM3NcbiAgICAgIGlmIChwbHVnaW4ubW9kZWxDaGFuZ2VkRGVib3VuY2UgJiYgcGx1Z2luLmlkID09PSBnZXRDdXJyZW50UGx1Z2luKCkuaWQpIHtcbiAgICAgICAgcGx1Z2luLm1vZGVsQ2hhbmdlZERlYm91bmNlKHNhbmRib3gsIHNhbmRib3guZ2V0TW9kZWwoKSwgY29udGFpbmVyKVxuICAgICAgfVxuICAgIH0sIDMwMClcbiAgfSlcblxuICAvLyBJZiB5b3Ugc2V0IHRoaXMgdG8gdHJ1ZSwgdGhlbiB0aGUgbmV4dCB0aW1lIHRoZSBwbGF5Z3JvdW5kIHdvdWxkXG4gIC8vIGhhdmUgc2V0IHRoZSB1c2VyJ3MgaGFzaCBpdCB3b3VsZCBiZSBza2lwcGVkIC0gdXNlZCBmb3Igc2V0dGluZ1xuICAvLyB0aGUgdGV4dCBpbiBleGFtcGxlc1xuICBsZXQgc3VwcHJlc3NOZXh0VGV4dENoYW5nZUZvckhhc2hDaGFuZ2UgPSBmYWxzZVxuXG4gIC8vIFNldHMgdGhlIFVSTCBhbmQgc3RvcmFnZSBvZiB0aGUgc2FuZGJveCBzdHJpbmdcbiAgY29uc3QgcGxheWdyb3VuZERlYm91bmNlZE1haW5GdW5jdGlvbiA9ICgpID0+IHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInNhbmRib3gtaGlzdG9yeVwiLCBzYW5kYm94LmdldFRleHQoKSlcbiAgfVxuXG4gIHNhbmRib3guZWRpdG9yLm9uRGlkQmx1ckVkaXRvclRleHQoKCkgPT4ge1xuICAgIGNvbnN0IGFsd2F5c1VwZGF0ZVVSTCA9ICFsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImRpc2FibGUtc2F2ZS1vbi10eXBlXCIpXG4gICAgaWYgKGFsd2F5c1VwZGF0ZVVSTCkge1xuICAgICAgaWYgKHN1cHByZXNzTmV4dFRleHRDaGFuZ2VGb3JIYXNoQ2hhbmdlKSB7XG4gICAgICAgIHN1cHByZXNzTmV4dFRleHRDaGFuZ2VGb3JIYXNoQ2hhbmdlID0gZmFsc2VcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBjb25zdCBuZXdVUkwgPSBzYW5kYm94LmNyZWF0ZVVSTFF1ZXJ5V2l0aENvbXBpbGVyT3B0aW9ucyhzYW5kYm94KVxuICAgICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHt9LCBcIlwiLCBuZXdVUkwpXG4gICAgfVxuICB9KVxuXG4gIC8vIFdoZW4gYW55IGNvbXBpbGVyIGZsYWdzIGFyZSBjaGFuZ2VkLCB0cmlnZ2VyIGEgcG90ZW50aWFsIGNoYW5nZSB0byB0aGUgVVJMXG4gIHNhbmRib3guc2V0RGlkVXBkYXRlQ29tcGlsZXJTZXR0aW5ncygoKSA9PiB7XG4gICAgcGxheWdyb3VuZERlYm91bmNlZE1haW5GdW5jdGlvbigpXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHdpbmRvdy5hcHBJbnNpZ2h0cyAmJiB3aW5kb3cuYXBwSW5zaWdodHMudHJhY2tFdmVudCh7IG5hbWU6IFwiQ29tcGlsZXIgU2V0dGluZ3MgY2hhbmdlZFwiIH0pXG5cbiAgICBjb25zdCBtb2RlbCA9IHNhbmRib3guZWRpdG9yLmdldE1vZGVsKClcbiAgICBjb25zdCBwbHVnaW4gPSBnZXRDdXJyZW50UGx1Z2luKClcbiAgICBpZiAobW9kZWwgJiYgcGx1Z2luLm1vZGVsQ2hhbmdlZCkgcGx1Z2luLm1vZGVsQ2hhbmdlZChzYW5kYm94LCBtb2RlbCwgY29udGFpbmVyKVxuICAgIGlmIChtb2RlbCAmJiBwbHVnaW4ubW9kZWxDaGFuZ2VkRGVib3VuY2UpIHBsdWdpbi5tb2RlbENoYW5nZWREZWJvdW5jZShzYW5kYm94LCBtb2RlbCwgY29udGFpbmVyKVxuXG4gICAgY29uc3QgYWx3YXlzVXBkYXRlVVJMID0gIWxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiZGlzYWJsZS1zYXZlLW9uLXR5cGVcIilcbiAgICBpZiAoYWx3YXlzVXBkYXRlVVJMKSB7XG4gICAgICBjb25zdCBuZXdVUkwgPSBzYW5kYm94LmNyZWF0ZVVSTFF1ZXJ5V2l0aENvbXBpbGVyT3B0aW9ucyhzYW5kYm94KVxuICAgICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHt9LCBcIlwiLCBuZXdVUkwpXG4gICAgfVxuICB9KVxuXG4gIGNvbnN0IHNraXBJbml0aWFsbHlTZXR0aW5nSGFzaCA9IGRvY3VtZW50LmxvY2F0aW9uLmhhc2ggJiYgZG9jdW1lbnQubG9jYXRpb24uaGFzaC5pbmNsdWRlcyhcImV4YW1wbGUvXCIpXG4gIGlmICghc2tpcEluaXRpYWxseVNldHRpbmdIYXNoKSBwbGF5Z3JvdW5kRGVib3VuY2VkTWFpbkZ1bmN0aW9uKClcblxuICAvLyBTZXR1cCB3b3JraW5nIHdpdGggdGhlIGV4aXN0aW5nIFVJLCBvbmNlIGl0J3MgbG9hZGVkXG5cbiAgLy8gVmVyc2lvbnMgb2YgVHlwZVNjcmlwdFxuXG4gIC8vIFNldCB1cCB0aGUgbGFiZWwgZm9yIHRoZSBkcm9wZG93blxuICBjb25zdCB2ZXJzaW9uQnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIiN2ZXJzaW9ucyA+IGFcIikuaXRlbSgwKVxuICB2ZXJzaW9uQnV0dG9uLmlubmVySFRNTCA9IFwidlwiICsgc2FuZGJveC50cy52ZXJzaW9uICsgXCIgPHNwYW4gY2xhc3M9J2NhcmV0Jy8+XCJcbiAgdmVyc2lvbkJ1dHRvbi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIGBTZWxlY3QgdmVyc2lvbiBvZiBUeXBlU2NyaXB0LCBjdXJyZW50bHkgJHtzYW5kYm94LnRzLnZlcnNpb259YClcblxuICAvLyBBZGQgdGhlIHZlcnNpb25zIHRvIHRoZSBkcm9wZG93blxuICBjb25zdCB2ZXJzaW9uc01lbnUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiI3ZlcnNpb25zID4gdWxcIikuaXRlbSgwKVxuXG4gIC8vIEVuYWJsZSBhbGwgc3VibWVudXNcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIm5hdiB1bCBsaVwiKS5mb3JFYWNoKGUgPT4gZS5jbGFzc0xpc3QuYWRkKFwiYWN0aXZlXCIpKVxuXG4gIGNvbnN0IG5vdFdvcmtpbmdJblBsYXlncm91bmQgPSBbXCIzLjEuNlwiLCBcIjMuMC4xXCIsIFwiMi44LjFcIiwgXCIyLjcuMlwiLCBcIjIuNC4xXCJdXG5cbiAgY29uc3QgYWxsVmVyc2lvbnMgPSBbLi4uc2FuZGJveC5zdXBwb3J0ZWRWZXJzaW9ucy5maWx0ZXIoZiA9PiAhbm90V29ya2luZ0luUGxheWdyb3VuZC5pbmNsdWRlcyhmKSksIFwiTmlnaHRseVwiXVxuXG4gIGFsbFZlcnNpb25zLmZvckVhY2goKHY6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpXG4gICAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpXG4gICAgYS50ZXh0Q29udGVudCA9IHZcbiAgICBhLmhyZWYgPSBcIiNcIlxuXG4gICAgaWYgKHYgPT09IFwiTmlnaHRseVwiKSB7XG4gICAgICBsaS5jbGFzc0xpc3QuYWRkKFwibmlnaHRseVwiKVxuICAgIH1cblxuICAgIGlmICh2LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoXCJiZXRhXCIpKSB7XG4gICAgICBsaS5jbGFzc0xpc3QuYWRkKFwiYmV0YVwiKVxuICAgIH1cblxuICAgIGxpLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50VVJMID0gc2FuZGJveC5jcmVhdGVVUkxRdWVyeVdpdGhDb21waWxlck9wdGlvbnMoc2FuZGJveClcbiAgICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoY3VycmVudFVSTC5zcGxpdChcIiNcIilbMF0pXG4gICAgICBjb25zdCB2ZXJzaW9uID0gdiA9PT0gXCJOaWdodGx5XCIgPyBcIm5leHRcIiA6IHZcbiAgICAgIHBhcmFtcy5zZXQoXCJ0c1wiLCB2ZXJzaW9uKVxuXG4gICAgICBjb25zdCBoYXNoID0gZG9jdW1lbnQubG9jYXRpb24uaGFzaC5sZW5ndGggPyBkb2N1bWVudC5sb2NhdGlvbi5oYXNoIDogXCJcIlxuICAgICAgY29uc3QgbmV3VVJMID0gYCR7ZG9jdW1lbnQubG9jYXRpb24ucHJvdG9jb2x9Ly8ke2RvY3VtZW50LmxvY2F0aW9uLmhvc3R9JHtkb2N1bWVudC5sb2NhdGlvbi5wYXRobmFtZX0/JHtwYXJhbXN9JHtoYXNofWBcblxuICAgICAgLy8gQHRzLWlnbm9yZSAtIGl0IGlzIGFsbG93ZWRcbiAgICAgIGRvY3VtZW50LmxvY2F0aW9uID0gbmV3VVJMXG4gICAgfVxuXG4gICAgbGkuYXBwZW5kQ2hpbGQoYSlcbiAgICB2ZXJzaW9uc01lbnUuYXBwZW5kQ2hpbGQobGkpXG4gIH0pXG5cbiAgLy8gU3VwcG9ydCBkcm9wZG93bnNcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5uYXZiYXItc3ViIGxpLmRyb3Bkb3duID4gYVwiKS5mb3JFYWNoKGxpbmsgPT4ge1xuICAgIGNvbnN0IGEgPSBsaW5rIGFzIEhUTUxBbmNob3JFbGVtZW50XG4gICAgYS5vbmNsaWNrID0gX2UgPT4ge1xuICAgICAgaWYgKGEucGFyZW50RWxlbWVudCEuY2xhc3NMaXN0LmNvbnRhaW5zKFwib3BlblwiKSkge1xuICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLm5hdmJhci1zdWIgbGkub3BlblwiKS5mb3JFYWNoKGkgPT4gaS5jbGFzc0xpc3QucmVtb3ZlKFwib3BlblwiKSlcbiAgICAgICAgYS5zZXRBdHRyaWJ1dGUoXCJhcmlhLWV4cGFuZGVkXCIsIFwiZmFsc2VcIilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIubmF2YmFyLXN1YiBsaS5vcGVuXCIpLmZvckVhY2goaSA9PiBpLmNsYXNzTGlzdC5yZW1vdmUoXCJvcGVuXCIpKVxuICAgICAgICBhLnBhcmVudEVsZW1lbnQhLmNsYXNzTGlzdC50b2dnbGUoXCJvcGVuXCIpXG4gICAgICAgIGEuc2V0QXR0cmlidXRlKFwiYXJpYS1leHBhbmRlZFwiLCBcInRydWVcIilcblxuICAgICAgICBjb25zdCBleGFtcGxlQ29udGFpbmVyID0gYS5jbG9zZXN0KFwibGlcIikhLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwidWxcIikuaXRlbSgwKSFcblxuICAgICAgICBjb25zdCBmaXJzdExhYmVsID0gZXhhbXBsZUNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKFwibGFiZWxcIikgYXMgSFRNTEVsZW1lbnRcbiAgICAgICAgaWYgKGZpcnN0TGFiZWwpIGZpcnN0TGFiZWwuZm9jdXMoKVxuXG4gICAgICAgIC8vIFNldCBleGFjdCBoZWlnaHQgYW5kIHdpZHRocyBmb3IgdGhlIHBvcG92ZXJzIGZvciB0aGUgbWFpbiBwbGF5Z3JvdW5kIG5hdmlnYXRpb25cbiAgICAgICAgY29uc3QgaXNQbGF5Z3JvdW5kU3VibWVudSA9ICEhYS5jbG9zZXN0KFwibmF2XCIpXG4gICAgICAgIGlmIChpc1BsYXlncm91bmRTdWJtZW51KSB7XG4gICAgICAgICAgY29uc3QgcGxheWdyb3VuZENvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicGxheWdyb3VuZC1jb250YWluZXJcIikhXG4gICAgICAgICAgZXhhbXBsZUNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgY2FsYygke3BsYXlncm91bmRDb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0ICsgMjZ9cHggLSA0cmVtKWBcblxuICAgICAgICAgIGNvbnN0IHNpZGVCYXJXaWR0aCA9IChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtc2lkZWJhclwiKSBhcyBhbnkpLm9mZnNldFdpZHRoXG4gICAgICAgICAgZXhhbXBsZUNvbnRhaW5lci5zdHlsZS53aWR0aCA9IGBjYWxjKDEwMCUgLSAke3NpZGVCYXJXaWR0aH1weCAtIDcxcHgpYFxuXG4gICAgICAgICAgLy8gQWxsIHRoaXMgaXMgdG8gbWFrZSBzdXJlIHRoYXQgdGFiYmluZyBzdGF5cyBpbnNpZGUgdGhlIGRyb3Bkb3duIGZvciB0c2NvbmZpZy9leGFtcGxlc1xuICAgICAgICAgIGNvbnN0IGJ1dHRvbnMgPSBleGFtcGxlQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoXCJpbnB1dFwiKVxuICAgICAgICAgIGNvbnN0IGxhc3RCdXR0b24gPSBidXR0b25zLml0ZW0oYnV0dG9ucy5sZW5ndGggLSAxKSBhcyBIVE1MRWxlbWVudFxuICAgICAgICAgIGlmIChsYXN0QnV0dG9uKSB7XG4gICAgICAgICAgICByZWRpcmVjdFRhYlByZXNzVG8obGFzdEJ1dHRvbiwgZXhhbXBsZUNvbnRhaW5lciwgXCIuZXhhbXBsZXMtY2xvc2VcIilcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwidWwuZXhhbXBsZXMtZHJvcGRvd24gLnNlY3Rpb24tY29udGVudFwiKVxuICAgICAgICAgICAgc2VjdGlvbnMuZm9yRWFjaChzID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgYnV0dG9ucyA9IHMucXVlcnlTZWxlY3RvckFsbChcImEuZXhhbXBsZS1saW5rXCIpXG4gICAgICAgICAgICAgIGNvbnN0IGxhc3RCdXR0b24gPSBidXR0b25zLml0ZW0oYnV0dG9ucy5sZW5ndGggLSAxKSBhcyBIVE1MRWxlbWVudFxuICAgICAgICAgICAgICBpZiAobGFzdEJ1dHRvbikge1xuICAgICAgICAgICAgICAgIHJlZGlyZWN0VGFiUHJlc3NUbyhsYXN0QnV0dG9uLCBleGFtcGxlQ29udGFpbmVyLCBcIi5leGFtcGxlcy1jbG9zZVwiKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9KVxuXG4gIC8vIEhhbmRsZSBlc2NhcGUgY2xvc2luZyBkcm9wZG93bnMgZXRjXG4gIGRvY3VtZW50Lm9ua2V5ZG93biA9IGZ1bmN0aW9uIChldnQpIHtcbiAgICBldnQgPSBldnQgfHwgd2luZG93LmV2ZW50XG4gICAgdmFyIGlzRXNjYXBlID0gZmFsc2VcbiAgICBpZiAoXCJrZXlcIiBpbiBldnQpIHtcbiAgICAgIGlzRXNjYXBlID0gZXZ0LmtleSA9PT0gXCJFc2NhcGVcIiB8fCBldnQua2V5ID09PSBcIkVzY1wiXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEB0cy1pZ25vcmUgLSB0aGlzIHVzZWQgdG8gYmUgdGhlIGNhc2VcbiAgICAgIGlzRXNjYXBlID0gZXZ0LmtleUNvZGUgPT09IDI3XG4gICAgfVxuICAgIGlmIChpc0VzY2FwZSkge1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5uYXZiYXItc3ViIGxpLm9wZW5cIikuZm9yRWFjaChpID0+IGkuY2xhc3NMaXN0LnJlbW92ZShcIm9wZW5cIikpXG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLm5hdmJhci1zdWIgbGlcIikuZm9yRWFjaChpID0+IGkuc2V0QXR0cmlidXRlKFwiYXJpYS1leHBhbmRlZFwiLCBcImZhbHNlXCIpKVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHNoYXJlQWN0aW9uID0ge1xuICAgIGlkOiBcImNvcHktY2xpcGJvYXJkXCIsXG4gICAgbGFiZWw6IFwiU2F2ZSB0byBjbGlwYm9hcmRcIixcbiAgICBrZXliaW5kaW5nczogW21vbmFjby5LZXlNb2QuQ3RybENtZCB8IG1vbmFjby5LZXlDb2RlLktFWV9TXSxcblxuICAgIGNvbnRleHRNZW51R3JvdXBJZDogXCJydW5cIixcbiAgICBjb250ZXh0TWVudU9yZGVyOiAxLjUsXG5cbiAgICBydW46IGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIFVwZGF0ZSB0aGUgVVJMLCB0aGVuIHdyaXRlIHRoYXQgdG8gdGhlIGNsaXBib2FyZFxuICAgICAgY29uc3QgbmV3VVJMID0gc2FuZGJveC5jcmVhdGVVUkxRdWVyeVdpdGhDb21waWxlck9wdGlvbnMoc2FuZGJveClcbiAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgXCJcIiwgbmV3VVJMKVxuICAgICAgd2luZG93Lm5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGxvY2F0aW9uLmhyZWYudG9TdHJpbmcoKSkudGhlbihcbiAgICAgICAgKCkgPT4gdWkuZmxhc2hJbmZvKGkoXCJwbGF5X2V4cG9ydF9jbGlwYm9hcmRcIikpLFxuICAgICAgICAoZTogYW55KSA9PiBhbGVydChlKVxuICAgICAgKVxuICAgIH0sXG4gIH1cblxuICBjb25zdCBzaGFyZUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2hhcmUtYnV0dG9uXCIpXG4gIGlmIChzaGFyZUJ1dHRvbikge1xuICAgIHNoYXJlQnV0dG9uLm9uY2xpY2sgPSBlID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgc2hhcmVBY3Rpb24ucnVuKClcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIC8vIFNldCB1cCBzb21lIGtleSBjb21tYW5kc1xuICAgIHNhbmRib3guZWRpdG9yLmFkZEFjdGlvbihzaGFyZUFjdGlvbilcblxuICAgIHNhbmRib3guZWRpdG9yLmFkZEFjdGlvbih7XG4gICAgICBpZDogXCJydW4tanNcIixcbiAgICAgIGxhYmVsOiBcIlJ1biB0aGUgZXZhbHVhdGVkIEphdmFTY3JpcHQgZm9yIHlvdXIgVHlwZVNjcmlwdCBmaWxlXCIsXG4gICAgICBrZXliaW5kaW5nczogW21vbmFjby5LZXlNb2QuQ3RybENtZCB8IG1vbmFjby5LZXlDb2RlLkVudGVyXSxcblxuICAgICAgY29udGV4dE1lbnVHcm91cElkOiBcInJ1blwiLFxuICAgICAgY29udGV4dE1lbnVPcmRlcjogMS41LFxuXG4gICAgICBydW46IGZ1bmN0aW9uIChlZCkge1xuICAgICAgICBjb25zdCBydW5CdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInJ1bi1idXR0b25cIilcbiAgICAgICAgcnVuQnV0dG9uICYmIHJ1bkJ1dHRvbi5vbmNsaWNrICYmIHJ1bkJ1dHRvbi5vbmNsaWNrKHt9IGFzIGFueSlcbiAgICAgIH0sXG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IHJ1bkJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicnVuLWJ1dHRvblwiKVxuICBpZiAocnVuQnV0dG9uKSB7XG4gICAgcnVuQnV0dG9uLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICBjb25zdCBydW4gPSBzYW5kYm94LmdldFJ1bm5hYmxlSlMoKVxuICAgICAgY29uc3QgcnVuUGx1Z2luID0gcGx1Z2lucy5maW5kKHAgPT4gcC5pZCA9PT0gXCJsb2dzXCIpIVxuICAgICAgYWN0aXZhdGVQbHVnaW4ocnVuUGx1Z2luLCBnZXRDdXJyZW50UGx1Z2luKCksIHNhbmRib3gsIHRhYkJhciwgY29udGFpbmVyKVxuXG4gICAgICBydW5XaXRoQ3VzdG9tTG9ncyhydW4sIGkpXG5cbiAgICAgIGNvbnN0IGlzSlMgPSBzYW5kYm94LmNvbmZpZy5maWxldHlwZSA9PT0gXCJqc1wiXG4gICAgICB1aS5mbGFzaEluZm8oaShpc0pTID8gXCJwbGF5X3J1bl9qc1wiIDogXCJwbGF5X3J1bl90c1wiKSlcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIC8vIEhhbmRsZSB0aGUgY2xvc2UgYnV0dG9ucyBvbiB0aGUgZXhhbXBsZXNcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvbi5leGFtcGxlcy1jbG9zZVwiKS5mb3JFYWNoKGIgPT4ge1xuICAgIGNvbnN0IGJ1dHRvbiA9IGIgYXMgSFRNTEJ1dHRvbkVsZW1lbnRcbiAgICBidXR0b24ub25jbGljayA9IChlOiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IGJ1dHRvbiA9IGUudGFyZ2V0IGFzIEhUTUxCdXR0b25FbGVtZW50XG4gICAgICBjb25zdCBuYXZMSSA9IGJ1dHRvbi5jbG9zZXN0KFwibGlcIilcbiAgICAgIG5hdkxJPy5jbGFzc0xpc3QucmVtb3ZlKFwib3BlblwiKVxuICAgIH1cbiAgfSlcblxuICBzZXR1cFNpZGViYXJUb2dnbGUoKVxuXG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNvbmZpZy1jb250YWluZXJcIikpIHtcbiAgICBjcmVhdGVDb25maWdEcm9wZG93bihzYW5kYm94LCBtb25hY28pXG4gICAgdXBkYXRlQ29uZmlnRHJvcGRvd25Gb3JDb21waWxlck9wdGlvbnMoc2FuZGJveCwgbW9uYWNvKVxuICB9XG5cbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicGxheWdyb3VuZC1zZXR0aW5nc1wiKSkge1xuICAgIGNvbnN0IHNldHRpbmdzVG9nZ2xlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF5Z3JvdW5kLXNldHRpbmdzXCIpIVxuXG4gICAgc2V0dGluZ3NUb2dnbGUub25jbGljayA9ICgpID0+IHtcbiAgICAgIGNvbnN0IG9wZW4gPSBzZXR0aW5nc1RvZ2dsZS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuY29udGFpbnMoXCJvcGVuXCIpXG4gICAgICBjb25zdCBzaWRlYmFyVGFicyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1wbHVnaW4tdGFidmlld1wiKSBhcyBIVE1MRGl2RWxlbWVudFxuICAgICAgY29uc3Qgc2lkZWJhckNvbnRlbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtcGx1Z2luLWNvbnRhaW5lclwiKSBhcyBIVE1MRGl2RWxlbWVudFxuICAgICAgbGV0IHNldHRpbmdzQ29udGVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1zZXR0aW5ncy1jb250YWluZXJcIikgYXMgSFRNTERpdkVsZW1lbnRcblxuICAgICAgaWYgKCFzZXR0aW5nc0NvbnRlbnQpIHtcbiAgICAgICAgc2V0dGluZ3NDb250ZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICAgICAgICBzZXR0aW5nc0NvbnRlbnQuY2xhc3NOYW1lID0gXCJwbGF5Z3JvdW5kLXNldHRpbmdzLWNvbnRhaW5lciBwbGF5Z3JvdW5kLXBsdWdpbi1jb250YWluZXJcIlxuICAgICAgICBjb25zdCBzZXR0aW5ncyA9IHNldHRpbmdzUGx1Z2luKGksIHV0aWxzKVxuICAgICAgICBzZXR0aW5ncy5kaWRNb3VudCAmJiBzZXR0aW5ncy5kaWRNb3VudChzYW5kYm94LCBzZXR0aW5nc0NvbnRlbnQpXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1zaWRlYmFyXCIpIS5hcHBlbmRDaGlsZChzZXR0aW5nc0NvbnRlbnQpXG5cbiAgICAgICAgLy8gV2hlbiB0aGUgbGFzdCB0YWIgaXRlbSBpcyBoaXQsIGdvIGJhY2sgdG8gdGhlIHNldHRpbmdzIGJ1dHRvblxuICAgICAgICBjb25zdCBsYWJlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnBsYXlncm91bmQtc2lkZWJhciBpbnB1dFwiKVxuICAgICAgICBjb25zdCBsYXN0TGFiZWwgPSBsYWJlbHMuaXRlbShsYWJlbHMubGVuZ3RoIC0gMSkgYXMgSFRNTEVsZW1lbnRcbiAgICAgICAgaWYgKGxhc3RMYWJlbCkge1xuICAgICAgICAgIHJlZGlyZWN0VGFiUHJlc3NUbyhsYXN0TGFiZWwsIHVuZGVmaW5lZCwgXCIjcGxheWdyb3VuZC1zZXR0aW5nc1wiKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChvcGVuKSB7XG4gICAgICAgIHNpZGViYXJUYWJzLnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuICAgICAgICBzaWRlYmFyQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiXG4gICAgICAgIHNldHRpbmdzQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNpZGViYXJUYWJzLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuICAgICAgICBzaWRlYmFyQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcbiAgICAgICAgc2V0dGluZ3NDb250ZW50LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCJcbiAgICAgICAgOyhkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtc2lkZWJhciBsYWJlbFwiKSBhcyBhbnkpLmZvY3VzKClcbiAgICAgIH1cbiAgICAgIHNldHRpbmdzVG9nZ2xlLnBhcmVudEVsZW1lbnQhLmNsYXNzTGlzdC50b2dnbGUoXCJvcGVuXCIpXG4gICAgfVxuXG4gICAgc2V0dGluZ3NUb2dnbGUuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgZSA9PiB7XG4gICAgICBjb25zdCBpc09wZW4gPSBzZXR0aW5nc1RvZ2dsZS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuY29udGFpbnMoXCJvcGVuXCIpXG4gICAgICBpZiAoZS5rZXkgPT09IFwiVGFiXCIgJiYgaXNPcGVuKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1vcHRpb25zIGxpIGlucHV0XCIpIGFzIGFueVxuICAgICAgICByZXN1bHQuZm9jdXMoKVxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgLy8gU3VwcG9ydCBncmFiYmluZyBleGFtcGxlcyBmcm9tIHRoZSBsb2NhdGlvbiBoYXNoXG4gIGlmIChsb2NhdGlvbi5oYXNoLnN0YXJ0c1dpdGgoXCIjZXhhbXBsZVwiKSkge1xuICAgIGNvbnN0IGV4YW1wbGVOYW1lID0gbG9jYXRpb24uaGFzaC5yZXBsYWNlKFwiI2V4YW1wbGUvXCIsIFwiXCIpLnRyaW0oKVxuICAgIHNhbmRib3guY29uZmlnLmxvZ2dlci5sb2coXCJMb2FkaW5nIGV4YW1wbGU6XCIsIGV4YW1wbGVOYW1lKVxuICAgIGdldEV4YW1wbGVTb3VyY2VDb2RlKGNvbmZpZy5wcmVmaXgsIGNvbmZpZy5sYW5nLCBleGFtcGxlTmFtZSkudGhlbihleCA9PiB7XG4gICAgICBpZiAoZXguZXhhbXBsZSAmJiBleC5jb2RlKSB7XG4gICAgICAgIGNvbnN0IHsgZXhhbXBsZSwgY29kZSB9ID0gZXhcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIGxvY2Fsc3RvcmFnZSBzaG93aW5nIHRoYXQgeW91J3ZlIHNlZW4gdGhpcyBwYWdlXG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICBjb25zdCBzZWVuVGV4dCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiZXhhbXBsZXMtc2VlblwiKSB8fCBcInt9XCJcbiAgICAgICAgICBjb25zdCBzZWVuID0gSlNPTi5wYXJzZShzZWVuVGV4dClcbiAgICAgICAgICBzZWVuW2V4YW1wbGUuaWRdID0gZXhhbXBsZS5oYXNoXG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJleGFtcGxlcy1zZWVuXCIsIEpTT04uc3RyaW5naWZ5KHNlZW4pKVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWxsTGlua3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiZXhhbXBsZS1saW5rXCIpXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgZm9yIChjb25zdCBsaW5rIG9mIGFsbExpbmtzKSB7XG4gICAgICAgICAgaWYgKGxpbmsudGV4dENvbnRlbnQgPT09IGV4YW1wbGUudGl0bGUpIHtcbiAgICAgICAgICAgIGxpbmsuY2xhc3NMaXN0LmFkZChcImhpZ2hsaWdodFwiKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGRvY3VtZW50LnRpdGxlID0gXCJUeXBlU2NyaXB0IFBsYXlncm91bmQgLSBcIiArIGV4YW1wbGUudGl0bGVcbiAgICAgICAgc3VwcHJlc3NOZXh0VGV4dENoYW5nZUZvckhhc2hDaGFuZ2UgPSB0cnVlXG4gICAgICAgIHNhbmRib3guc2V0VGV4dChjb2RlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3VwcHJlc3NOZXh0VGV4dENoYW5nZUZvckhhc2hDaGFuZ2UgPSB0cnVlXG4gICAgICAgIHNhbmRib3guc2V0VGV4dChcIi8vIFRoZXJlIHdhcyBhbiBpc3N1ZSBnZXR0aW5nIHRoZSBleGFtcGxlLCBiYWQgVVJMPyBDaGVjayB0aGUgY29uc29sZSBpbiB0aGUgZGV2ZWxvcGVyIHRvb2xzXCIpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IG1vZGVsID0gc2FuZGJveC5nZXRNb2RlbCgpXG4gIG1vZGVsLm9uRGlkQ2hhbmdlRGVjb3JhdGlvbnMoKCkgPT4ge1xuICAgIGNvbnN0IG1hcmtlcnMgPSBzYW5kYm94Lm1vbmFjby5lZGl0b3IuZ2V0TW9kZWxNYXJrZXJzKHsgcmVzb3VyY2U6IG1vZGVsLnVyaSB9KS5maWx0ZXIobSA9PiBtLnNldmVyaXR5ICE9PSAxKVxuICAgIHV0aWxzLnNldE5vdGlmaWNhdGlvbnMoXCJlcnJvcnNcIiwgbWFya2Vycy5sZW5ndGgpXG4gIH0pXG5cbiAgLy8gU2V0cyB1cCBhIHdheSB0byBjbGljayBiZXR3ZWVuIGV4YW1wbGVzXG4gIG1vbmFjby5sYW5ndWFnZXMucmVnaXN0ZXJMaW5rUHJvdmlkZXIoc2FuZGJveC5sYW5ndWFnZSwgbmV3IEV4YW1wbGVIaWdobGlnaHRlcigpKVxuXG4gIGNvbnN0IGxhbmd1YWdlU2VsZWN0b3IgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxhbmd1YWdlLXNlbGVjdG9yXCIpIGFzIEhUTUxTZWxlY3RFbGVtZW50XG4gIGlmIChsYW5ndWFnZVNlbGVjdG9yKSB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhsb2NhdGlvbi5zZWFyY2gpXG4gICAgY29uc3Qgb3B0aW9ucyA9IFtcInRzXCIsIFwiZC50c1wiLCBcImpzXCJdXG4gICAgbGFuZ3VhZ2VTZWxlY3Rvci5vcHRpb25zLnNlbGVjdGVkSW5kZXggPSBvcHRpb25zLmluZGV4T2YocGFyYW1zLmdldChcImZpbGV0eXBlXCIpIHx8IFwidHNcIilcblxuICAgIGxhbmd1YWdlU2VsZWN0b3Iub25jaGFuZ2UgPSAoKSA9PiB7XG4gICAgICBjb25zdCBmaWxldHlwZSA9IG9wdGlvbnNbTnVtYmVyKGxhbmd1YWdlU2VsZWN0b3Iuc2VsZWN0ZWRJbmRleCB8fCAwKV1cbiAgICAgIGNvbnN0IHF1ZXJ5ID0gc2FuZGJveC5jcmVhdGVVUkxRdWVyeVdpdGhDb21waWxlck9wdGlvbnMoc2FuZGJveCwgeyBmaWxldHlwZSB9KVxuICAgICAgY29uc3QgZnVsbFVSTCA9IGAke2RvY3VtZW50LmxvY2F0aW9uLnByb3RvY29sfS8vJHtkb2N1bWVudC5sb2NhdGlvbi5ob3N0fSR7ZG9jdW1lbnQubG9jYXRpb24ucGF0aG5hbWV9JHtxdWVyeX1gXG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBkb2N1bWVudC5sb2NhdGlvbiA9IGZ1bGxVUkxcbiAgICB9XG4gIH1cblxuICAvLyBFbnN1cmUgdGhhdCB0aGUgZWRpdG9yIGlzIGZ1bGwtd2lkdGggd2hlbiB0aGUgc2NyZWVuIHJlc2l6ZXNcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgKCkgPT4ge1xuICAgIHNhbmRib3guZWRpdG9yLmxheW91dCgpXG4gIH0pXG5cbiAgY29uc3QgdWkgPSBjcmVhdGVVSSgpXG4gIGNvbnN0IGV4cG9ydGVyID0gY3JlYXRlRXhwb3J0ZXIoc2FuZGJveCwgbW9uYWNvLCB1aSlcblxuICBjb25zdCBwbGF5Z3JvdW5kID0ge1xuICAgIGV4cG9ydGVyLFxuICAgIHVpLFxuICAgIHJlZ2lzdGVyUGx1Z2luLFxuICAgIHBsdWdpbnMsXG4gICAgZ2V0Q3VycmVudFBsdWdpbixcbiAgICB0YWJzLFxuICAgIHNldERpZFVwZGF0ZVRhYixcbiAgICBjcmVhdGVVdGlscyxcbiAgfVxuXG4gIHdpbmRvdy50cyA9IHNhbmRib3gudHNcbiAgd2luZG93LnNhbmRib3ggPSBzYW5kYm94XG4gIHdpbmRvdy5wbGF5Z3JvdW5kID0gcGxheWdyb3VuZFxuXG4gIGNvbnNvbGUubG9nKGBVc2luZyBUeXBlU2NyaXB0ICR7d2luZG93LnRzLnZlcnNpb259YClcblxuICBjb25zb2xlLmxvZyhcIkF2YWlsYWJsZSBnbG9iYWxzOlwiKVxuICBjb25zb2xlLmxvZyhcIlxcdHdpbmRvdy50c1wiLCB3aW5kb3cudHMpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnNhbmRib3hcIiwgd2luZG93LnNhbmRib3gpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnBsYXlncm91bmRcIiwgd2luZG93LnBsYXlncm91bmQpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnJlYWN0XCIsIHdpbmRvdy5yZWFjdClcbiAgY29uc29sZS5sb2coXCJcXHR3aW5kb3cucmVhY3RET01cIiwgd2luZG93LnJlYWN0RE9NKVxuXG4gIC8qKiBBIHBsdWdpbiAqL1xuICBjb25zdCBhY3RpdmF0ZUV4dGVybmFsUGx1Z2luID0gKFxuICAgIHBsdWdpbjogUGxheWdyb3VuZFBsdWdpbiB8ICgodXRpbHM6IFBsdWdpblV0aWxzKSA9PiBQbGF5Z3JvdW5kUGx1Z2luKSxcbiAgICBhdXRvQWN0aXZhdGU6IGJvb2xlYW5cbiAgKSA9PiB7XG4gICAgbGV0IHJlYWR5UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luXG4gICAgLy8gQ2FuIGVpdGhlciBiZSBhIGZhY3RvcnksIG9yIG9iamVjdFxuICAgIGlmICh0eXBlb2YgcGx1Z2luID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNvbnN0IHV0aWxzID0gY3JlYXRlVXRpbHMoc2FuZGJveCwgcmVhY3QpXG4gICAgICByZWFkeVBsdWdpbiA9IHBsdWdpbih1dGlscylcbiAgICB9IGVsc2Uge1xuICAgICAgcmVhZHlQbHVnaW4gPSBwbHVnaW5cbiAgICB9XG5cbiAgICBpZiAoYXV0b0FjdGl2YXRlKSB7XG4gICAgICBjb25zb2xlLmxvZyhyZWFkeVBsdWdpbilcbiAgICB9XG5cbiAgICBwbGF5Z3JvdW5kLnJlZ2lzdGVyUGx1Z2luKHJlYWR5UGx1Z2luKVxuXG4gICAgLy8gQXV0by1zZWxlY3QgdGhlIGRldiBwbHVnaW5cbiAgICBjb25zdCBwbHVnaW5XYW50c0Zyb250ID0gcmVhZHlQbHVnaW4uc2hvdWxkQmVTZWxlY3RlZCAmJiByZWFkeVBsdWdpbi5zaG91bGRCZVNlbGVjdGVkKClcblxuICAgIGlmIChwbHVnaW5XYW50c0Zyb250IHx8IGF1dG9BY3RpdmF0ZSkge1xuICAgICAgLy8gQXV0by1zZWxlY3QgdGhlIGRldiBwbHVnaW5cbiAgICAgIGFjdGl2YXRlUGx1Z2luKHJlYWR5UGx1Z2luLCBnZXRDdXJyZW50UGx1Z2luKCksIHNhbmRib3gsIHRhYkJhciwgY29udGFpbmVyKVxuICAgIH1cbiAgfVxuXG4gIC8vIERldiBtb2RlIHBsdWdpblxuICBpZiAoY29uZmlnLnN1cHBvcnRDdXN0b21QbHVnaW5zICYmIGFsbG93Q29ubmVjdGluZ1RvTG9jYWxob3N0KCkpIHtcbiAgICB3aW5kb3cuZXhwb3J0cyA9IHt9XG4gICAgY29uc29sZS5sb2coXCJDb25uZWN0aW5nIHRvIGRldiBwbHVnaW5cIilcbiAgICB0cnkge1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgY29uc3QgcmUgPSB3aW5kb3cucmVxdWlyZVxuICAgICAgcmUoW1wibG9jYWwvaW5kZXhcIl0sIChkZXZQbHVnaW46IGFueSkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcIlNldCB1cCBkZXYgcGx1Z2luIGZyb20gbG9jYWxob3N0OjUwMDBcIilcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhY3RpdmF0ZUV4dGVybmFsUGx1Z2luKGRldlBsdWdpbiwgdHJ1ZSlcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKVxuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdWkuZmxhc2hJbmZvKFwiRXJyb3I6IENvdWxkIG5vdCBsb2FkIGRldiBwbHVnaW4gZnJvbSBsb2NhbGhvc3Q6NTAwMFwiKVxuICAgICAgICAgIH0sIDcwMClcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIlByb2JsZW0gbG9hZGluZyB1cCB0aGUgZGV2IHBsdWdpblwiKVxuICAgICAgY29uc29sZS5lcnJvcihlcnJvcilcbiAgICB9XG4gIH1cblxuICBjb25zdCBkb3dubG9hZFBsdWdpbiA9IChwbHVnaW46IHN0cmluZywgYXV0b0VuYWJsZTogYm9vbGVhbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBjb25zdCByZSA9IHdpbmRvdy5yZXF1aXJlXG4gICAgICByZShbYHVucGtnLyR7cGx1Z2lufUBsYXRlc3QvZGlzdC9pbmRleGBdLCAoZGV2UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luKSA9PiB7XG4gICAgICAgIGFjdGl2YXRlRXh0ZXJuYWxQbHVnaW4oZGV2UGx1Z2luLCBhdXRvRW5hYmxlKVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIlByb2JsZW0gbG9hZGluZyB1cCB0aGUgcGx1Z2luOlwiLCBwbHVnaW4pXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKVxuICAgIH1cbiAgfVxuXG4gIGlmIChjb25maWcuc3VwcG9ydEN1c3RvbVBsdWdpbnMpIHtcbiAgICAvLyBHcmFiIG9uZXMgZnJvbSBsb2NhbHN0b3JhZ2VcbiAgICBhY3RpdmVQbHVnaW5zKCkuZm9yRWFjaChwID0+IGRvd25sb2FkUGx1Z2luKHAuaWQsIGZhbHNlKSlcblxuICAgIC8vIE9mZmVyIHRvIGluc3RhbGwgb25lIGlmICdpbnN0YWxsLXBsdWdpbicgaXMgYSBxdWVyeSBwYXJhbVxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMobG9jYXRpb24uc2VhcmNoKVxuICAgIGNvbnN0IHBsdWdpblRvSW5zdGFsbCA9IHBhcmFtcy5nZXQoXCJpbnN0YWxsLXBsdWdpblwiKVxuICAgIGlmIChwbHVnaW5Ub0luc3RhbGwpIHtcbiAgICAgIGNvbnN0IGFscmVhZHlJbnN0YWxsZWQgPSBhY3RpdmVQbHVnaW5zKCkuZmluZChwID0+IHAuaWQgPT09IHBsdWdpblRvSW5zdGFsbClcbiAgICAgIGlmICghYWxyZWFkeUluc3RhbGxlZCkge1xuICAgICAgICBjb25zdCBzaG91bGREb0l0ID0gY29uZmlybShcIldvdWxkIHlvdSBsaWtlIHRvIGluc3RhbGwgdGhlIHRoaXJkIHBhcnR5IHBsdWdpbj9cXG5cXG5cIiArIHBsdWdpblRvSW5zdGFsbClcbiAgICAgICAgaWYgKHNob3VsZERvSXQpIHtcbiAgICAgICAgICBhZGRDdXN0b21QbHVnaW4ocGx1Z2luVG9JbnN0YWxsKVxuICAgICAgICAgIGRvd25sb2FkUGx1Z2luKHBsdWdpblRvSW5zdGFsbCwgdHJ1ZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChsb2NhdGlvbi5oYXNoLnN0YXJ0c1dpdGgoXCIjc2hvdy1leGFtcGxlc1wiKSkge1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJleGFtcGxlcy1idXR0b25cIik/LmNsaWNrKClcbiAgICB9LCAxMDApXG4gIH1cblxuICBpZiAobG9jYXRpb24uaGFzaC5zdGFydHNXaXRoKFwiI3Nob3ctd2hhdGlzbmV3XCIpKSB7XG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIndoYXRpc25ldy1idXR0b25cIik/LmNsaWNrKClcbiAgICB9LCAxMDApXG4gIH1cblxuICAvLyBHcmFiIHRoZSBjb250ZW50cyBvZiBhIEdpc3RcbiAgaWYgKGxvY2F0aW9uLmhhc2guc3RhcnRzV2l0aChcIiNnaXN0L1wiKSkge1xuICAgIGdpc3RQb3dlcmVkTmF2QmFyKHNhbmRib3gsIHVpLCBzaG93TmF2KVxuICB9XG5cbiAgcmV0dXJuIHBsYXlncm91bmRcbn1cblxuZXhwb3J0IHR5cGUgUGxheWdyb3VuZCA9IFJldHVyblR5cGU8dHlwZW9mIHNldHVwUGxheWdyb3VuZD5cblxuY29uc3QgcmVkaXJlY3RUYWJQcmVzc1RvID0gKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkLCBxdWVyeTogc3RyaW5nKSA9PiB7XG4gIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgZSA9PiB7XG4gICAgaWYgKGUua2V5ID09PSBcIlRhYlwiKSB7XG4gICAgICBjb25zdCBob3N0ID0gY29udGFpbmVyIHx8IGRvY3VtZW50XG4gICAgICBjb25zdCByZXN1bHQgPSBob3N0LnF1ZXJ5U2VsZWN0b3IocXVlcnkpIGFzIGFueVxuICAgICAgaWYgKCFyZXN1bHQpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgdG8gZmluZCBhIHJlc3VsdCBmb3Iga2V5ZG93bmApXG4gICAgICByZXN1bHQuZm9jdXMoKVxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuICB9KVxufVxuIl19