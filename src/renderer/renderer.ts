import { MainAPI } from "../main/preload";
import * as feather from "feather-icons";
import validatorEscape from "validator/es/lib/escape";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { prosemirrorSetup, schema } from "./prosemirror";
import { JsonProperty, Serializable, deserialize } from "typescript-json-serializer";
import { v4 as GenerateUUID } from "uuid";

/* Expose the variables/functions sent through the preload.ts */

type BridgedWindow = Window & typeof globalThis & {
    mainAPI: any
}

const api: MainAPI = (window as BridgedWindow).mainAPI.api;

/* Type definitions */

class UserPrefs {
    theme = 0;
    codeStyle = "atom-one-dark";
    accentColor = "#FF7A27";
    defaultZoom = 1.0;
    defaultMaximized = false;
    dataDir = defaultDataDir;
    pdfBreakOnH1 = false;
    pdfDarkMode = false;
    openPDFonExport = true;
    tabSize = 4;
    sidebarWidth = 275;
    showCodeOverlay = true;
    codeWordWrap = false;
    firstUse = true;
    showMenuBar = true;
}

enum NotebookItemType {
    NOTEBOOK,
    SECTION,
    PAGE
}

@Serializable()
class NotebookItem {

    @JsonProperty()
    type: NotebookItemType;

    @JsonProperty()
    id: string;

    @JsonProperty()
    name: string;

    @JsonProperty()
    color = "#000000";

    @JsonProperty()
    icon = "book";

    @JsonProperty({ required: false })
    fileName: string;

    @JsonProperty({ required: false })
    favorite = false;

    @JsonProperty({ required: false })
    expanded = false;

    @JsonProperty({ type: NotebookItem, required: false })
    children: NotebookItem[] = [];

    constructor(name: string, type: NotebookItemType) {
        this.name = name;
        this.id = GenerateUUID();
        this.type = type;

        if (this.type === NotebookItemType.NOTEBOOK) {
            this.icon = "book";
        }
        else if (this.type === NotebookItemType.SECTION) {
            this.icon = "folder";
        }
        if (this.type === NotebookItemType.PAGE) {
            this.fileName = this.id + ".json";
            this.icon = "file-text";
        }
    }

    toString() {
        return this.id;
    }

    getAllPages(): NotebookItem[] {

        const list: NotebookItem[] = [];

        function recurseAdd(item: NotebookItem) {
            if (item.type === NotebookItemType.NOTEBOOK || item.type === NotebookItemType.SECTION) {
                item.children.forEach(child => {
                    recurseAdd(child);
                });
            }
            else if (item.type === NotebookItemType.PAGE) {
                list.push(item);
            }
        }

        this.children.forEach(child => {
            recurseAdd(child);
        });

        return list;
    }

    static getParent(item: NotebookItem): NotebookItem {

        let parent: NotebookItem = null;
        let done = false;

        function recurseSearch(x: NotebookItem) {

            if (done === false) {
                if (x.type === NotebookItemType.NOTEBOOK || x.type === NotebookItemType.SECTION) {
                    if (x.children.indexOf(item) > -1) {
                        parent = x;
                        done = true;
                        return;
                    }
                    else {
                        x.children.forEach(child => {
                            recurseSearch(child);
                        });
                    }
                }
            }
            
        }

        save.notebooks.forEach(nb => {
            if (done === false)
                recurseSearch(nb);
        });

        return parent;
    }
}

@Serializable()
class Save {
    @JsonProperty({ type: NotebookItem })
    notebooks: NotebookItem[] = [];

    @JsonProperty()
    version = "2.0.0";
}

/* Global variables */

// TODO remove this decorator later
/* eslint-disable prefer-const */
let darkStyleLink: HTMLLinkElement;

let save: Save;
let idToObjectMap = new Map<string, NotebookItem>();

export let prefs: UserPrefs;

const defaultDataDir: string = api.ipcSendSync("defaultDataDir");

let editorView: EditorView = null;

let fadeInSaveIndicator: NodeJS.Timeout;

let selectedItem: NotebookItem;
let createNewItemMode: NotebookItemType;
let openedPage: NotebookItem;

let canSaveData = false;
let canSavePrefs = false;
let zoomLevel = 1.000;

let sidebarWidth = 275;

const lightThemes = [ "a11y-light", "arduino-light", "ascetic", "atelier-cave-light", "atelier-dune-light", "atelier-estuary-light", "atelier-forest-light", "atelier-heath-light", "atelier-lakeside-light", "atelier-plateau-light", "atelier-savanna-light", "atelier-seaside-light", "atelier-sulphurpool-light", "atom-one-light", "color-brewer", "default", "docco", "foundation", "github-gist", "github", "font-weight: bold;", "googlecode", "grayscale", "gruvbox-light", "idea", "isbl-editor-light", "kimbie.light", "lightfair", "magula", "mono-blue", "nnfx", "paraiso-light", "purebasic", "qtcreator_light", "routeros", "solarized-light", "tomorrow", "vs", "xcode" ];
//const darkThemes = [ "a11y-dark", "agate", "androidstudio", "an-old-hope", "arta", "atelier-cave-dark", "atelier-dune-dark", "atelier-estuary-dark", "atelier-forest-dark", "atelier-heath-dark", "atelier-lakeside-dark", "atelier-plateau-dark", "atelier-savanna-dark", "atelier-seaside-dark", "atelier-sulphurpool-dark", "atom-one-dark-reasonable", "atom-one-dark", "font-weight: bold;", "codepen-embed", "darcula", "dark", "dracula", "far", "gml", "gradient-dark", "gruvbox-dark", "hopscotch", "hybrid", "ir-black", "isbl-editor-dark", "kimbie.dark", "lioshi", "monokai-sublime", "monokai", "night-owl", "nnfx-dark", "nord", "ocean", "obsidian", "paraiso-dark", "pojoaque", "qtcreator_dark", "railscasts", "rainbow", "shades-of-purple", "solarized-dark", "srcery", "sunburst", "tomorrow-night-blue", "tomorrow-night-bright", "tomorrow-night-eighties", "tomorrow-night", "vs2015", "xt256", "zenburn" ];
/* eslint-enable prefer-const */



/* Initialization */

// window.onbeforeunload = (e) => {


//     //cache which notebooks are opened
//     prefs.openedNotebooks = [];


//     if (destroyOpenedNotebooks == false) {
//         for (let i = 0; i < save.notebooks.length; i++) {

//             const nbList = document.getElementById(`nb-${i}-list`);
//             if (nbList.classList.contains("show")) {
//                 prefs.openedNotebooks[prefs.openedNotebooks.length] = i;
//             }
//         }
//     }


//     saveData();
//     savePrefs();
// };

function init(): void {

    // These prevent ctrl or middle-clicking on <a>'s causing
    // a new window to pop up
    window.addEventListener("auxclick", (event) => {
        if (event.button === 1) {
            event.preventDefault();
        }
    });
    window.addEventListener("click", (event) => {
        if (event.ctrlKey) {
            event.preventDefault();
        }
    });


    // Get user preferences
    if (api.fsExistsSync(defaultDataDir + "/prefs.json")) {
        try {
            const json = api.fsReadFileSync(defaultDataDir + "/prefs.json");
            prefs = JSON.parse(json);

            fixPrefs();
            applyPrefsAtStart();
            canSavePrefs = true;
        }
        catch (ex) {
            console.error(ex);
            errorPopup("Your prefs.json file could not be parsed.", "Check the developer console for more information");
        }
    }
    else {
        prefs = new UserPrefs();
        canSavePrefs = true;
        savePrefs();
        applyPrefsAtStart();
    }


    // Get notebooks save file
    if (api.fsExistsSync(prefs.dataDir + "/save.json")) {
        const json = api.fsReadFileSync(prefs.dataDir + "/save.json");

        // Check for old save from before 2.0.0
        const testObject = JSON.parse(json);
        if (testObject["version"] === undefined) {
            try {
                save = convertOldSave(testObject);
                canSaveData = true;
            }
            catch (ex) {
                canSaveData = false;
                console.error(ex);
                errorPopup("Could not convert old save.json to new format.", "Check the developer console for more information and report this to the GitHub Issues page. If nothing else works, you can rename your save.json to something else, reopen Codex, recreate your notebooks/notes, and edit the new save.json to point those pages to the old files in the /notes/ folder.");
            }

            if (canSaveData)
                saveData();
        }
        else {
            try {
                save = deserialize<Save>(json, Save);
                canSaveData = true;
            }
            catch (err) {
                canSaveData = false;
                console.error(err);
                errorPopup("Your save file could not be parsed correctly.", "Please make sure your save.json JSON file is intact");
            }
        }
    }
    else {
        
        //TODO REMOVE
        save = new Save();

        const nb1 = new NotebookItem("cs 340", NotebookItemType.NOTEBOOK);
        nb1.children.push(new NotebookItem("Introduction", NotebookItemType.PAGE));

        const s1 = new NotebookItem("UNIX", NotebookItemType.SECTION);
        s1.children.push(new NotebookItem("Permissions", NotebookItemType.PAGE));
        s1.children.push(new NotebookItem("Common Commands", NotebookItemType.PAGE));

        const s1s1 = new NotebookItem("Different types of linuxes", NotebookItemType.SECTION);
        s1s1.children.push(new NotebookItem("Ubuntu", NotebookItemType.PAGE));
        s1s1.children.push(new NotebookItem("Mint", NotebookItemType.PAGE));
        s1s1.children.push(new NotebookItem("Arch", NotebookItemType.PAGE));

        s1.children.push(s1s1);

        nb1.children.push(s1);

        const nb2 = new NotebookItem("cs 321", NotebookItemType.NOTEBOOK);

        const page = new NotebookItem("design vocab", NotebookItemType.PAGE);
        page.fileName = page.id + ".json";

        nb2.children.push(page);

        save.notebooks.push(nb1);
        save.notebooks.push(nb2);
        
        canSaveData = true;
        saveData();
    }

    if (api.fsExistsSync(prefs.dataDir + "/notes/") === false) {
        api.fsMkDirSync(prefs.dataDir + "/notes/");
    }

    // Custom user stylesheet
    if (!api.fsExistsSync(defaultDataDir + "/customStylesheet.css")) {
        api.fsWriteFileSync(defaultDataDir + "/customStylesheet.css", "/*\n    Enter custom CSS rules for Codex in this file.\n    Use Inspect Element in the DevTools (Ctrl-Shift-I) in Codex to find id's and classes.\n*/");
    }
    (document.getElementById("customStylesheetLink") as HTMLLinkElement).href = "file:///" + defaultDataDir + "/customStylesheet.css";

    document.querySelectorAll(".my-sidebar-link").forEach(function (item) {
        item.addEventListener("click", () => {
            //change selected sidebar item

            document.querySelectorAll(".my-sidebar-link").forEach(function (x) {
                x.classList.toggle("active", false);
            });

            item.classList.toggle("active", true);

        });
    });

    // Hide context menus on resize, and hide sidebar if window becomes too small
    window.addEventListener("resize", () => {

        document.getElementById("notebook-context-menu").style.display = "none";
        document.getElementById("section-context-menu").style.display = "none";
        document.getElementById("page-context-menu").style.display = "none";

        // Sidebar behavior
        if (document.body.clientWidth <= (sidebarWidth + 810)) {
            document.getElementById("mainContainer").style.marginLeft = "0px";
            document.getElementById("editorRibbon").style.left = "0px";
            toggleSidebar(false);
        }
        else {
            document.getElementById("mainContainer").style.marginLeft = "var(--sidebar-width)";
            document.getElementById("editorRibbon").style.left = "var(--sidebar-width)";
            toggleSidebar(true);
        }

    });

    document.addEventListener("click", (e) => {
        if (e.target != document.getElementById("notebook-context-menu") && e.target != document.getElementById("section-context-menu") && e.target != document.getElementById("page-context-menu")) {
            document.getElementById("notebook-context-menu").style.display = "none";
            document.getElementById("section-context-menu").style.display = "none";
            document.getElementById("page-context-menu").style.display = "none";
        }
    });

    processNotebooks();

    // open the notebooks which were open before
    /*for (let i = 0; i < prefs.openedNotebooks.length; i++) {
        try {
            const nbList = document.getElementById(`nb-${prefs.openedNotebooks[i]}-list`);
            nbList.classList.add("show");
            document.getElementById(`nb-${prefs.openedNotebooks[i]}`).setAttribute("aria-expanded", "true");
        }
        catch (error) {
            console.error(error);
            errorPopup("Error while trying to load notebooks.", "Check the developer console for more information.");
        }
    }*/


    // TOOLTIPS

    document.getElementById("revertToDefaultDataDirBtnTooltip").title = "Revert to" + defaultDataDir;
    $("#revertToDefaultDataDirBtnTooltip").tooltip({
        trigger: "hover"
    });
    $("#dataDirButton").tooltip({
        trigger: "hover"
    });

    $("#newNotebookBtn").tooltip({
        boundary: document.documentElement,
        container: "body",
        placement: "right",
        trigger: "hover"
    });

    $("#newNotebookColorPicker").tooltip({
        trigger: "hover",
        placement: "bottom"
    });

    $("#accentColorPicker").tooltip({
        trigger: "hover",
        placement: "bottom"
    });

    $("#editNotebookColorPicker").tooltip({
        trigger: "hover",
        placement: "bottom"
    });

    $("#newNotebookIconHelp").tooltip({
        trigger: "hover",
        placement: "right"
    });

    $("#editNotebookIconHelp").tooltip({
        trigger: "hover",
        placement: "right"
    });


    //TODO see if these even do anything
    document.execCommand("enableObjectResizing", false, "false");
    document.execCommand("enableInlineTableEditing", false, "false");


    // first time use popup
    if (prefs.firstUse == true) {
        //probably first use
        setTimeout(() => { $("#firstUseModal").modal("show"); }, 500);
    }


    // Sidebar resizer events
    const sidebarResizer = document.getElementById("sidebarResizer");
    sidebarResizer.addEventListener("mousedown", () => {
        window.addEventListener("mousemove", handleSidebarResizerDrag, false);
        window.addEventListener("mouseup", () => {
            window.removeEventListener("mousemove", handleSidebarResizerDrag, false);
        }, false);
    });


    // Set up Icon Selectors for notebook modals
    const newItemIconSelect = <HTMLSelectElement>document.getElementById("newItemIconSelect");
    const editItemIconSelect = <HTMLSelectElement>document.getElementById("editItemIconSelect");

    Object.keys(feather.icons).forEach(element => {
        const op1 = document.createElement("option");
        op1.text = element;
        op1.value = element;
        newItemIconSelect.appendChild(op1);

        const op2 = document.createElement("option");
        op2.text = element;
        op2.value = element;
        editItemIconSelect.appendChild(op2);
    });

    newItemIconSelect.value = "book";

    newItemIconSelect.addEventListener("change", () => {
        document.getElementById("newItemIconPreview").setAttribute("data-feather", (document.getElementById("newItemIconSelect") as HTMLSelectElement).value);
        feather.replace();
    });

    document.getElementById("newItemColorPicker").addEventListener("change", () => {
        document.getElementById("newItemIconPreview").style.color = (document.getElementById("newItemColorPicker") as HTMLInputElement).value;
    });

    editItemIconSelect.addEventListener("change", () => {
        document.getElementById("editItemIconPreview").setAttribute("data-feather", (document.getElementById("editItemIconSelect") as HTMLSelectElement).value);
        feather.replace();
    });

    document.getElementById("editItemColorPicker").addEventListener("change", () => {
        document.getElementById("editItemIconPreview").style.color = (document.getElementById("editItemColorPicker") as HTMLInputElement).value;
    });


    // Feather icons
    feather.replace();
}

init();

/* Functions */

export function fixPrefs(): void {

    if (prefs.theme === undefined)
        prefs.theme = 0;

    if (prefs.codeStyle === undefined)
        prefs.codeStyle = "atom-one-dark";

    if (prefs.accentColor === undefined)
        prefs.accentColor = "#FF7A27";

    if (prefs.defaultZoom === undefined)
        prefs.defaultZoom = 1.0;

    if (prefs.defaultMaximized === undefined)
        prefs.defaultMaximized = false;

    if (prefs.dataDir === undefined)
        prefs.dataDir = defaultDataDir;

    if (prefs.pdfBreakOnH1 === undefined)
        prefs.pdfBreakOnH1 = false;

    if (prefs.pdfDarkMode === undefined)
        prefs.pdfDarkMode = false;

    if (prefs.openPDFonExport === undefined)
        prefs.openPDFonExport = true;

    if (prefs.tabSize === undefined)
        prefs.tabSize = 4;

    if (prefs.sidebarWidth === undefined)
        prefs.sidebarWidth = 275;

    if (prefs.showCodeOverlay === undefined)
        prefs.showCodeOverlay = true;

    if (prefs.codeWordWrap === undefined)
        prefs.codeWordWrap = false;

    if (prefs.firstUse === undefined)
        prefs.firstUse = true;

    if (prefs.showMenuBar === undefined)
        prefs.showMenuBar = true;

}

export function savePrefs(): void {
    if (canSavePrefs) {
        prefs.defaultMaximized = api.ipcSendSync("isWindowMaximized");

        try {
            api.fsWriteFileSync(defaultDataDir + "/prefs.json", JSON.stringify(prefs, null, 2));
        }
        catch (err) {
            console.error(err);
            errorPopup("Couldn't save preferences file.", "Check the developer console for more information.");
        }
    }
}

export function applyPrefsAtStart(): void {
    (document.getElementById("themeSelect") as HTMLSelectElement).value = prefs.theme.toString();
    const header = document.getElementsByTagName("head")[0];
    if (prefs.theme == 1) {
        darkStyleLink = document.createElement("link");
        darkStyleLink.rel = "stylesheet";
        darkStyleLink.type = "text/css";
        darkStyleLink.href = "../css/dark.css";
        darkStyleLink.media = "all";
        header.appendChild(darkStyleLink);
        api.ipcSend("setNativeThemeSource", "dark");
    }
    else if (prefs.theme == 0) {
        api.ipcSend("setNativeThemeSource", "light");
        if (darkStyleLink != null) {
            header.removeChild(darkStyleLink);
            darkStyleLink = null;
        }
    }
    else if (prefs.theme == 2) {
        api.ipcSend("setNativeThemeSource", "system");
        if (api.ipcSendSync("nativeThemeShouldUseDarkColors") === true) {
            darkStyleLink = document.createElement("link");
            darkStyleLink.rel = "stylesheet";
            darkStyleLink.type = "text/css";
            darkStyleLink.href = "../css/dark.css";
            darkStyleLink.media = "all";
            header.appendChild(darkStyleLink);
        }
    }
    else {
        prefs.theme = 0;
        api.ipcSend("setNativeThemeSource", "light");
    }

    (document.getElementById("codeStyleSelect") as HTMLSelectElement).value = prefs.codeStyle;
    (document.getElementById("codeStyleLink") as HTMLLinkElement).href = `../node_modules/highlight.js/styles/${prefs.codeStyle}.css`;

    if (lightThemes.includes(prefs.codeStyle)) {
        document.documentElement.style.setProperty("--code-overlay-bg-brightness", "0.95");
        document.documentElement.style.setProperty("--code-scrollbar-color", "0");
        document.documentElement.style.setProperty("--code-scrollbar-opacity", "0.07");
    }
    else {
        document.documentElement.style.setProperty("--code-overlay-bg-brightness", "1.25");
        document.documentElement.style.setProperty("--code-scrollbar-color", "255");
        document.documentElement.style.setProperty("--code-scrollbar-opacity", "0.3");
    }

    (document.getElementById("accentColorPicker") as HTMLInputElement).value = prefs.accentColor;
    document.documentElement.style.setProperty("--accent-color", prefs.accentColor);

    (document.getElementById("tabSizeSelect") as HTMLSelectElement).value = prefs.tabSize.toString();

    if (prefs.defaultMaximized) {
        api.ipcSend("maximize");
    }

    zoomLevel = prefs.defaultZoom;
    updateZoom();

    $("#exportBreakPageOnH1Check").prop("checked", prefs.pdfBreakOnH1);
    $("#darkmodePDFCheck").prop("checked", prefs.pdfDarkMode);
    $("#openPDFonExportCheck").prop("checked", prefs.openPDFonExport);

    if (api.fsExistsSync(prefs.dataDir)) {
        document.getElementById("dataDirInput").innerText = prefs.dataDir;

        if (prefs.dataDir == defaultDataDir) {
            (document.getElementById("revertToDefaultDataDirBtn") as HTMLButtonElement).disabled = true;
            document.getElementById("revertToDefaultDataDirBtn").style.pointerEvents = "none";
            document.getElementById("revertToDefaultDataDirBtnTooltip").title = "You're already in the default location.";
            $("#revertToDefaultDataDirBtnTooltip").tooltip("dispose");
            $("#revertToDefaultDataDirBtnTooltip").tooltip();
        }
        else {
            (document.getElementById("revertToDefaultDataDirBtn") as HTMLButtonElement).disabled = false;
            document.getElementById("revertToDefaultDataDirBtn").style.pointerEvents = "auto";
            document.getElementById("revertToDefaultDataDirBtnTooltip").title = "Revert to " + defaultDataDir;
            $("#revertToDefaultDataDirBtnTooltip").tooltip("dispose");
            $("#revertToDefaultDataDirBtnTooltip").tooltip();
        }
    }
    else {
        alert("Your Save location (" + prefs.dataDir + ") could not be accessed. Reverting to the default (" + defaultDataDir + ")");
        prefs.dataDir = defaultDataDir;
        document.getElementById("dataDirInput").innerText = prefs.dataDir;
    }

    resizeSidebar(prefs.sidebarWidth);

    $("#showLanguageOverlayCheck").prop("checked", prefs.showCodeOverlay);
    if (prefs.showCodeOverlay === true) {
        (document.getElementById("codeOverlayLink") as HTMLLinkElement).href = "../css/codeoverlay.css";
    }

    $("#codeWordWrapCheck").prop("checked", prefs.codeWordWrap);
    if (prefs.codeWordWrap === true) {
        document.documentElement.style.setProperty("--code-white-space", "pre-wrap");
    }
    else {
        document.documentElement.style.setProperty("--code-white-space", "pre");
    }

    api.ipcSend("setMenuBarVisibility", prefs.showMenuBar);
}

export function applyPrefsRuntime(needsRestart = false): void {

    prefs.codeStyle = (document.getElementById("codeStyleSelect") as HTMLSelectElement).value;
    (document.getElementById("codeStyleLink") as HTMLLinkElement).href = `../node_modules/highlight.js/styles/${prefs.codeStyle}.css`;

    if (lightThemes.includes(prefs.codeStyle)) {
        document.documentElement.style.setProperty("--code-overlay-bg-brightness", "0.95");
        document.documentElement.style.setProperty("--code-scrollbar-color", "0");
        document.documentElement.style.setProperty("--code-scrollbar-opacity", "0.07");
    }
    else {
        document.documentElement.style.setProperty("--code-overlay-bg-brightness", "1.25");
        document.documentElement.style.setProperty("--code-scrollbar-color", "255");
        document.documentElement.style.setProperty("--code-scrollbar-opacity", "0.3");
    }

    prefs.theme = parseInt((document.getElementById("themeSelect") as HTMLSelectElement).value);
    const header = document.getElementsByTagName("head")[0];
    if (prefs.theme == 1) {
        if (darkStyleLink == null) {
            darkStyleLink = document.createElement("link");
            darkStyleLink.rel = "stylesheet";
            darkStyleLink.type = "text/css";
            darkStyleLink.href = "../css/dark.css";
            darkStyleLink.media = "all";
            header.appendChild(darkStyleLink);
            api.ipcSend("setNativeThemeSource", "dark");
        }
    }
    else if (prefs.theme == 0) {
        api.ipcSend("setNativeThemeSource", "light");
        if (darkStyleLink != null) {
            header.removeChild(darkStyleLink);
            darkStyleLink = null;
        }
    }
    else if (prefs.theme == 2) {
        api.ipcSend("setNativeThemeSource", "system");
        if (api.ipcSendSync("nativeThemeShouldUseDarkColors") === true) {
            darkStyleLink = document.createElement("link");
            darkStyleLink.rel = "stylesheet";
            darkStyleLink.type = "text/css";
            darkStyleLink.href = "../css/dark.css";
            darkStyleLink.media = "all";
            header.appendChild(darkStyleLink);
        }
        else {
            if (darkStyleLink != null) {
                header.removeChild(darkStyleLink);
                darkStyleLink = null;
            }
        }
    }
    else {
        prefs.theme = 0;
    }

    prefs.accentColor = (document.getElementById("accentColorPicker") as HTMLInputElement).value;
    document.documentElement.style.setProperty("--accent-color", prefs.accentColor);

    prefs.tabSize = parseInt((document.getElementById("tabSizeSelect") as HTMLSelectElement).value);

    prefs.pdfBreakOnH1 = $("#exportBreakPageOnH1Check").is(":checked");
    prefs.pdfDarkMode = $("#darkmodePDFCheck").is(":checked");
    prefs.openPDFonExport = $("#openPDFonExportCheck").is(":checked");

    //check to make sure this path is valid
    prefs.dataDir = document.getElementById("dataDirInput").innerText;

    if (api.fsExistsSync(prefs.dataDir)) {
        document.getElementById("dataDirInput").innerText = prefs.dataDir;

        if (prefs.dataDir == defaultDataDir) {
            (document.getElementById("revertToDefaultDataDirBtn") as HTMLButtonElement).disabled = true;
            document.getElementById("revertToDefaultDataDirBtn").style.pointerEvents = "none";
            document.getElementById("revertToDefaultDataDirBtnTooltip").title = "You're already in the default location.";
            $("#revertToDefaultDataDirBtnTooltip").tooltip("dispose");
            $("#revertToDefaultDataDirBtnTooltip").tooltip();
        }
        else {
            (document.getElementById("revertToDefaultDataDirBtn") as HTMLButtonElement).disabled = false;
            document.getElementById("revertToDefaultDataDirBtn").style.pointerEvents = "auto";
            document.getElementById("revertToDefaultDataDirBtnTooltip").title = "Revert to " + defaultDataDir;
            $("#revertToDefaultDataDirBtnTooltip").tooltip("dispose");
            $("#revertToDefaultDataDirBtnTooltip").tooltip();
        }
    }
    else {
        prefs.dataDir = defaultDataDir;
        document.getElementById("dataDirInput").innerText = prefs.dataDir;
        alert("The specified save directory could not be accessed. Reverting to default.");
    }

    savePrefs();

    if (needsRestart) {
        api.ipcSend("restart");
    }

    prefs.sidebarWidth = sidebarWidth;

    prefs.showCodeOverlay = $("#showLanguageOverlayCheck").is(":checked");
    if (prefs.showCodeOverlay === true) {
        (document.getElementById("codeOverlayLink") as HTMLLinkElement).href = "../css/codeoverlay.css";
    }
    else {
        (document.getElementById("codeOverlayLink") as HTMLLinkElement).href = "";
    }

    prefs.codeWordWrap = $("#codeWordWrapCheck").is(":checked");
    if (prefs.codeWordWrap === true) {
        document.documentElement.style.setProperty("--code-white-space", "pre-wrap");
    }
    else {
        document.documentElement.style.setProperty("--code-white-space", "pre");
    }

}

export function saveData(): void {
    if (canSaveData) {
        try {
            api.fsWriteFileSync(prefs.dataDir + "/save.json", JSON.stringify(save, null, 4));
            //TODO
            //saveSelectedPage();
        }
        catch (err) {
            console.error(err);
            errorPopup("Couldn't save the save.json file", "Check the developer console for more information");
        }
    }
}

export function errorPopup(message: string, detail: string) {
    api.ipcSend("errorPopup", message, detail);
}

export function showUIPage(id: "homePage" | "settingsPage" | "editorPage"): void {
    const ids = ["homePage", "settingsPage", "editorPage"];

    document.querySelectorAll(".my-sidebar-link").forEach(function (x) {
        x.classList.remove("active");
    });

    if (ids.indexOf(id) != -1) {
        ids.splice(ids.indexOf(id), 1);

        ids.forEach(element => {
            document.getElementById(element).style.display = "none";
        });

        document.getElementById(id).style.display = "block";

        document.getElementById("mainContainer").scrollTo(0, 0);
    }

	if (id == "editorPage") {
		api.ipcSend("editingMenu");
	}
	else {
		api.ipcSend("normalMenu");
        openedPage = null;
	}

    if (id == "homePage")
        document.getElementById("homeTab").classList.toggle("active", true);
    else if (id == "settingsPage")
        document.getElementById("settingsTab").classList.toggle("active", true);
}

export function zoomIn(): void {
    if (openedPage != null) {
        if (zoomLevel < 4.000) {
            zoomLevel += 0.100;
            updateZoom();
        }
    }
}

export function zoomOut(): void {
    if (openedPage != null) {
        if (zoomLevel > 0.700) {
            zoomLevel -= 0.100;
            updateZoom();
        }
    }
}

export function defaultZoom(): void {
    if (openedPage != null) {
        zoomLevel = 1.000;
        updateZoom();
    }
}

export function openHelpPage(): void {
    api.ipcSend("openHelpPage");
}

export function updateZoom(): void {
    prefs.defaultZoom = zoomLevel;

    const ec = document.getElementById("editorContent");
    const mainContainer = document.getElementById("mainContainer");

    const oldScrollTop = mainContainer.scrollTop;
    const oldScrollHeight = mainContainer.scrollHeight;

    // The zoom variable is not part of any standard but seems to work how
    // how I want it to for now
    // @ts-ignore
    ec.style.zoom = `${zoomLevel}`;

    mainContainer.scrollTop = (oldScrollTop / oldScrollHeight) * mainContainer.scrollHeight;
}

export function resizeSidebar(width: number): void {
    if (width >= 200 && width <= 600) {
        sidebarWidth = width;
        prefs.sidebarWidth = sidebarWidth;

        if (document.documentElement.style.getPropertyValue("--sidebar-width") != "0px") {
            document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);   
        }
    }
}

export function handleSidebarResizerDrag(event: MouseEvent): void {
    resizeSidebar(event.clientX);
}

export function toggleSidebar(value: boolean): void {

    if (value != null) {
        if (value == true) {
            document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
            document.getElementById("sidebarToggler").setAttribute("flipped", "false");
            document.getElementById("sidebarResizer").style.display = "block";
            return;
        }
        else {
            document.documentElement.style.setProperty("--sidebar-width", "0px");
            document.getElementById("sidebarToggler").setAttribute("flipped", "true");
            document.getElementById("sidebarResizer").style.display = "none";
            return;
        }
    }

    if (document.documentElement.style.getPropertyValue("--sidebar-width") == "0px") {
        document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
        document.getElementById("sidebarToggler").setAttribute("flipped", "false");
        document.getElementById("sidebarResizer").style.display = "block";
        return;
    }
    else {
        document.documentElement.style.setProperty("--sidebar-width", "0px");
        document.getElementById("sidebarToggler").setAttribute("flipped", "true");
        document.getElementById("sidebarResizer").style.display = "none";
        return;
    }
}

export function processNotebooks(): void {

    let marginLeft = 0;

    function draw(item: NotebookItem, container: HTMLElement) {

        idToObjectMap.set(item.id, item);

        if (item.type === NotebookItemType.NOTEBOOK || item.type === NotebookItemType.SECTION) {

            const el = document.createElement("li");

            container.appendChild(el);

            el.outerHTML = `
                <li class="nav-item my-sidebar-item" draggable="false">
                    <a id="${validatorEscape(item.id)}" href="#list-${validatorEscape(item.id)}" class="nav-link notebook unselectable" data-toggle="collapse" aria-expanded="${item.expanded}" title="${validatorEscape(item.name)}" style="padding-left: calc(1rem + ${marginLeft}px);">
                        <div class="row">
                            <div class="col-auto pr-0">
                                <span data-feather="${validatorEscape(item.icon)}" style="color: ${validatorEscape(item.color)}"></span>
                            </div>
                            <div class="col pr-1" style="padding-left: 5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${validatorEscape(item.name)}</div>
                            <div class="col-auto" style="padding-right: 20px">
                                <span class="caret"></span>
                            </div>
                        </div>
                    </a>
                    <ul id="list-${validatorEscape(item.id)}" class="nav collapse ${item.expanded ? "show" : ""}">

                    </ul>
                </li>
            `;

            marginLeft += 20;

            item.children.forEach(child => {
                draw(child, document.getElementById(`list-${validatorEscape(item.id)}`));
            });

            if (item.children.length == 0) {
                const emptyIndicator = document.createElement("li");

                document.getElementById(`list-${validatorEscape(item.id)}`).appendChild(emptyIndicator);
                emptyIndicator.outerHTML = `
                    <li class="nav-item emptyIndicator">
                        <i class="nav-link font-weight-light unselectable" style="padding-left: calc(1rem + ${marginLeft}px);">Nothing here yet...</i>
                    </li>
                `;
            }

            marginLeft -= 20;
        }
        else if (item.type === NotebookItemType.PAGE) {

            const el = document.createElement("li");

            container.appendChild(el);

            el.outerHTML = `
                <li class="nav-item my-sidebar-item" draggable="false">
                    <a id="${validatorEscape(item.id)}" href="#" class="nav-link my-sidebar-link notebook unselectable" title="${validatorEscape(item.name)}" style="padding-left: calc(1rem + ${marginLeft}px);">
                        <div class="row">
                            <div class="col-auto pr-0">
                                <span data-feather="${validatorEscape(item.icon)}" style="color: ${validatorEscape(item.color)}"></span>
                            </div>
                            <div class="col pr-1" style="padding-left: 5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${validatorEscape(item.name)}</div>
                        </div>
                    </a>
                </li>
            `;

            if (openedPage == item) {
                document.getElementById(validatorEscape(item.id)).classList.toggle("active", true);
            }
        }

        document.getElementById(validatorEscape(item.id)).addEventListener("contextmenu", function (e) {
            e.preventDefault();

            selectedItem = idToObjectMap.get(this.id);

            document.getElementById("notebook-context-menu").style.display = "none";
            document.getElementById("section-context-menu").style.display = "none";
            document.getElementById("page-context-menu").style.display = "none";

            let cm = null;

            if (selectedItem.type === NotebookItemType.NOTEBOOK)
                cm = document.getElementById("notebook-context-menu");
            else if (selectedItem.type === NotebookItemType.SECTION)
                cm = document.getElementById("section-context-menu");
            else if (selectedItem.type === NotebookItemType.PAGE)
                cm = document.getElementById("page-context-menu");

            cm.style.display = "block";
            cm.style.left = `${e.clientX}px`;
    
            // Put the menu above the cursor if it's going to go off screen
            if (window.innerHeight - e.clientY < cm.clientHeight) {
                cm.style.top = `${e.clientY - cm.clientHeight}px`;
            }
            else {
                cm.style.top = `${e.clientY}px`;
            }
        });

        if (item.type === NotebookItemType.PAGE) {
            document.getElementById(validatorEscape(item.id)).addEventListener("click", () => {
                loadPage(idToObjectMap.get(item.id));

                document.querySelectorAll(".my-sidebar-link").forEach(function (tab) {
                    tab.classList.toggle("active", false);
                });
    
                document.getElementById(validatorEscape(item.id)).classList.toggle("active", true);
            });
        }
        else {
            document.getElementById(validatorEscape(item.id)).addEventListener("click", () => {
                const i = idToObjectMap.get(item.id);
                i.expanded = !i.expanded;
            });
        }

    }

    //clear the list
    document.getElementById("notebookList").innerHTML = "";

    idToObjectMap.clear();

    try {
        save.notebooks.forEach(nb => {
            draw(nb, document.getElementById("notebookList"));
        });
    }
    catch (ex) {
        console.log(ex);
    }

    feather.replace();
}

export function revertAccentColor(): void {
    prefs.accentColor = "#FF7A27";
    (document.getElementById("accentColorPicker") as HTMLInputElement).value = "#FF7A27";
    document.documentElement.style.setProperty("--accent-color", prefs.accentColor);
}

function loadPage(page: NotebookItem) {
    showUIPage("editorPage");
    saveOpenedPage();

    if (page.type === NotebookItemType.PAGE) {
        openedPage = page;

        const filePath = prefs.dataDir + "/notes/" + page.fileName;

        if (api.fsExistsSync(filePath) === false) {
            api.fsWriteFileSync(filePath, "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}");
        }

        const content = api.fsReadFileSync(prefs.dataDir + "/notes/" + page.fileName);

        if (editorView != null) {
            editorView.destroy();
        }
        editorView = new EditorView(document.getElementById("editor"), {
            state: EditorState.create({
                doc: schema.nodeFromJSON(JSON.parse(content)),
                plugins: prosemirrorSetup(prefs.tabSize)
            })
        });

        document.getElementById("mainContainer").scrollTo(0, 0);
    }
}

export function saveOpenedPage(showIndicator = false) {
    if (openedPage != null && openedPage.type === NotebookItemType.PAGE && editorView != null && canSaveData === true) {
        try {
            const cont = JSON.stringify(editorView.state.doc.toJSON());

            api.fsWriteFileSync(prefs.dataDir + "/notes/" + openedPage.fileName, cont);

            let title = openedPage.name;
            if (title.length > 40) {
                title = title.substring(0, 40) + "...";
            }

            if (showIndicator) {
                clearTimeout(fadeInSaveIndicator);

                document.getElementById("saveIndicatorTitle").textContent = `"${title}" saved!`;
                document.getElementById("saveIndicator").style.opacity = "1";

                fadeInSaveIndicator = setTimeout(() => {
                    document.getElementById("saveIndicator").style.opacity = "0";
                }, 3000);
            }
        }
        catch (err) {
            errorPopup("Failed to save page", err.toString());
            console.error(err);
        }
    }
}

export function openDataDir() {
    api.ipcSend("openDataDir", prefs.dataDir);
}

function convertOldSave(oldSave: any): Save {

    const newSave = new Save();
    const notebooks: any[] = oldSave["notebooks"];

    notebooks.forEach(oldNb => {
        const nb = new NotebookItem("", NotebookItemType.NOTEBOOK);
        nb.name = oldNb["name"];
        nb.color = oldNb["color"];
        nb.icon = oldNb["icon"];

        const pages: any[] = oldNb["pages"];
        pages.forEach(oldPage => {
            const page = new NotebookItem("", NotebookItemType.PAGE);
            page.name = oldPage["title"];
            page.fileName = oldPage["fileName"];
            page.favorite = oldPage["favorite"];

            nb.children.push(page);
        });

        newSave.notebooks.push(nb);
    });

    return newSave;
}


document.getElementById("newNotebookBtn").addEventListener("click", () => {
    createNewItemMode = NotebookItemType.NOTEBOOK;
    selectedItem = null;

    $("#newItemModal").modal("show");
});



/* NEW ITEM MODAL */
document.getElementById("newItemForm").addEventListener("submit", (e) => {
    e.preventDefault(); // Prevents the page from trying to send the data to a url

    const name = (document.getElementById("newItemNameInput") as HTMLInputElement).value;
    const color = (document.getElementById("newItemColorPicker") as HTMLInputElement).value;
    const icon = (document.getElementById("newItemIconSelect") as HTMLSelectElement).value;

    if (name !== "") {

        if (createNewItemMode === NotebookItemType.NOTEBOOK) {
            const nb = new NotebookItem(name, NotebookItemType.NOTEBOOK);
            nb.color = color;
            nb.icon = icon;
            save.notebooks.push(nb);
        }
        else if (createNewItemMode === NotebookItemType.SECTION) {
            const section = new NotebookItem(name, NotebookItemType.SECTION);
            section.color = color;
            section.icon = icon;

            if (selectedItem !== null) {
                const parent = selectedItem;
                if (parent.type !== NotebookItemType.PAGE) {
                    parent.children.push(section);
                }
            }
        }
        else if (createNewItemMode === NotebookItemType.PAGE) {
            const page = new NotebookItem(name, NotebookItemType.PAGE);
            page.color = color;
            page.icon = icon;

            if (selectedItem !== null) {
                const parent = selectedItem;
                if (parent.type !== NotebookItemType.PAGE) {
                    parent.children.push(page);
                }
            }
        }

        $("#newItemModal").modal("hide");

        saveData();
        processNotebooks();

        document.getElementById("newItemNameInput").classList.remove("is-invalid");
        (document.getElementById("newItemNameInput") as HTMLInputElement).value = "";
        (document.getElementById("newItemColorPicker") as HTMLInputElement).value = "#000000";
        (document.getElementById("newItemIconSelect") as HTMLSelectElement).value = "book";
        document.getElementById("newItemIconPreview").setAttribute("data-feather", "book");
        document.getElementById("newItemIconPreview").style.color = "black";

        feather.replace();
    }
    else {
        document.getElementById("newItemNameInput").classList.add("is-invalid");
    }
});

$("#newItemModal").on("shown.bs.modal", () => {
    document.getElementById("newItemNameInput").focus();
});

$("#newItemModal").on("hidden.bs.modal", () => {
    document.getElementById("newItemNameInput").classList.remove("is-invalid");
});

/* EDIT ITEM MODAL */
document.getElementById("editItemForm").addEventListener("submit", (e) => {
    e.preventDefault(); // Prevents the page from trying to send the data to a url

    const newName = (document.getElementById("editItemNameInput") as HTMLInputElement).value;
    const newColor = (document.getElementById("editItemColorPicker") as HTMLInputElement).value;
    const newIcon = (document.getElementById("editItemIconSelect") as HTMLSelectElement).value;

    if (newName !== "") {
        $("#editItemModal").modal("hide");

        selectedItem.name = newName;
        selectedItem.color = newColor;
        selectedItem.icon = newIcon;

        saveData();
        processNotebooks();

        feather.replace();
    }
    else {
        document.getElementById("editItemNameInput").classList.add("is-invalid");
    }
});

$("#editItemModal").on("shown.bs.modal", () => {
    document.getElementById("editItemNameInput").focus();
});

$("#editItemModal").on("hidden.bs.modal", () => {
    document.getElementById("editItemNameInput").classList.remove("is-invalid");
});

/* DELETE ITEM MODAL */
$("#deleteItemButton").on("click", () => {

    saveOpenedPage();
    showUIPage("homePage");

    if (selectedItem.type === NotebookItemType.NOTEBOOK) {
        try {
            const index = save.notebooks.indexOf(selectedItem);
            if (index > -1) {
                save.notebooks.splice(index, 1);
                saveData();
                processNotebooks();
            }
            else {
                errorPopup(`Could not delete the item ${selectedItem.name}`, "Check the developer console and report this error to the GitHub Issues page.");
                console.error(`Notebook with name '${selectedItem.name}' was not found in save.notebooks.`);
            }
        }
        catch (ex) {
            errorPopup(`Could not delete the item ${selectedItem.name}`, "Check the developer console and report this error to the GitHub Issues page.");
            console.error(ex);
        }
    }
    else {
        const parent = NotebookItem.getParent(selectedItem);

        if (parent != null) {
            try {
                const index = parent.children.indexOf(selectedItem);
                if (index > -1) {
                    parent.children.splice(index, 1);
                    saveData();
                    processNotebooks();
                }
                else {
                    errorPopup(`Could not delete the item ${selectedItem.name}`, "Check the developer console and report this error to the GitHub Issues page.");
                    console.error(`Item with name '${selectedItem.name}' was not found directly inside '${parent.name}'.`);
                }
            }
            catch (ex) {
                errorPopup(`Could not delete the item ${selectedItem.name}`, "Check the developer console and report this error to the GitHub Issues page.");
                console.error(ex);
            }
        }
    }
    
    $("#deleteItemModal").modal("hide");
});



$("#NBCM-newPage").on("click", () => {
    document.getElementById("newItemFormTitle").textContent = `New Page in '${selectedItem.name}'`;
    (document.getElementById("newItemIconSelect") as HTMLSelectElement).value = "file-text";
    document.getElementById("newItemIconPreview").setAttribute("data-feather", "file-text");
    feather.replace();
    
    $("#newItemModal").modal("show");
    document.getElementById("newItemNameInput").focus();

    createNewItemMode = NotebookItemType.PAGE;
});

$("#NBCM-newSection").on("click", () => {
    document.getElementById("newItemFormTitle").textContent = `New Section in '${selectedItem.name}'`;
    (document.getElementById("newItemIconSelect") as HTMLSelectElement).value = "folder";
    document.getElementById("newItemIconPreview").setAttribute("data-feather", "folder");
    feather.replace();

    $("#newItemModal").modal("show");
    document.getElementById("newItemNameInput").focus();

    createNewItemMode = NotebookItemType.SECTION;
});

$("#NBCM-editNotebook").on("click", () => {
    document.getElementById("editItemFormTitle").textContent = `Edit '${selectedItem.name}'`;
    (document.getElementById("editItemIconSelect") as HTMLSelectElement).value = selectedItem.icon;
    document.getElementById("editItemIconPreview").setAttribute("data-feather", selectedItem.icon);
    console.log(selectedItem.color);
    (document.getElementById("editItemColorPicker") as HTMLInputElement).value = selectedItem.color;
    document.getElementById("editItemIconPreview").style.color = selectedItem.color;
    (document.getElementById("editItemNameInput") as HTMLInputElement).value = selectedItem.name;
    feather.replace();

    $("#editItemModal").modal("show");
    document.getElementById("editItemNameInput").focus();
});

$("#NBCM-exportAllPages").on("click", () => {
    document.getElementById("exportModalModalTitle").textContent = selectedItem.name;
    document.getElementById("exportModalModalIcon").setAttribute("data-feather", selectedItem.icon);
    document.getElementById("exportModalModalIcon").style.color = selectedItem.color;
    document.getElementById("exportModalModalPageCount").textContent = `${selectedItem.getAllPages().length} pages`;
    feather.replace();

    $("#exportModal").modal("show");
});

$("#NBCM-deleteNotebook").on("click", () => {
    document.getElementById("deleteItemModalTitle").innerHTML = `
        Are you sure you want to delete <b>${validatorEscape(selectedItem.name)}</b>?<br><br>All sections and pages inside this notebook will be deleted, but the pages' actual data will remain in the notes folder.
    `;

    $("#deleteItemModal").modal("show");
});



$("#SCM-newPage").on("click", () => {
    document.getElementById("newItemFormTitle").textContent = `New Page in '${selectedItem.name}'`;
    (document.getElementById("newItemIconSelect") as HTMLSelectElement).value = "file-text";
    document.getElementById("newItemIconPreview").setAttribute("data-feather", "file-text");
    feather.replace();
    
    $("#newItemModal").modal("show");
    document.getElementById("newItemNameInput").focus();

    createNewItemMode = NotebookItemType.PAGE;
});

$("#SCM-newSection").on("click", () => {
    document.getElementById("newItemFormTitle").textContent = `New Section in '${selectedItem.name}'`;
    (document.getElementById("newItemIconSelect") as HTMLSelectElement).value = "folder";
    document.getElementById("newItemIconPreview").setAttribute("data-feather", "folder");
    feather.replace();

    $("#newItemModal").modal("show");
    document.getElementById("newItemNameInput").focus();

    createNewItemMode = NotebookItemType.SECTION;
});

$("#SCM-editSection").on("click", () => {
    document.getElementById("editItemFormTitle").textContent = `Edit '${selectedItem.name}'`;
    (document.getElementById("editItemIconSelect") as HTMLSelectElement).value = selectedItem.icon;
    document.getElementById("editItemIconPreview").setAttribute("data-feather", selectedItem.icon);
    (document.getElementById("editItemColorPicker") as HTMLInputElement).value = selectedItem.color;
    document.getElementById("editItemIconPreview").style.color = selectedItem.color;
    (document.getElementById("editItemNameInput") as HTMLInputElement).value = selectedItem.name;
    feather.replace();

    $("#editItemModal").modal("show");
    document.getElementById("editItemNameInput").focus();
});

$("#SCM-exportAllPages").on("click", () => {
    document.getElementById("exportModalModalTitle").textContent = selectedItem.name;
    document.getElementById("exportModalModalIcon").setAttribute("data-feather", selectedItem.icon);
    document.getElementById("exportModalModalIcon").style.color = selectedItem.color;
    document.getElementById("exportModalModalPageCount").textContent = `${selectedItem.getAllPages().length} pages`;
    feather.replace();

    $("#exportModal").modal("show");
});

$("#SCM-deleteSection").on("click", () => {
    document.getElementById("deleteItemModalTitle").innerHTML = `
        Are you sure you want to delete <b>${validatorEscape(selectedItem.name)}</b>?<br><br>All sections and pages inside this section will be deleted, but the pages' actual data will remain in the notes folder.
    `;

    $("#deleteItemModal").modal("show");
});



$("#PCM-editPage").on("click", () => {
    document.getElementById("editItemFormTitle").textContent = `Edit '${selectedItem.name}'`;
    (document.getElementById("editItemIconSelect") as HTMLSelectElement).value = selectedItem.icon;
    document.getElementById("editItemIconPreview").setAttribute("data-feather", selectedItem.icon);
    (document.getElementById("editItemColorPicker") as HTMLInputElement).value = selectedItem.color;
    document.getElementById("editItemIconPreview").style.color = selectedItem.color;
    (document.getElementById("editItemNameInput") as HTMLInputElement).value = selectedItem.name;
    feather.replace();

    $("#editItemModal").modal("show");
    document.getElementById("editItemNameInput").focus();
});

$("#PCM-favoritePage").on("click", () => {
    if (selectedItem.type === NotebookItemType.PAGE) {
        selectedItem.favorite = !selectedItem.favorite;
    }
});

$("#PCM-exportPDF").on("click", () => {
    //open save dialog
});

$("#PCM-exportMD").on("click", () => {
    //open save dialog
});

$("#PCM-deletePage").on("click", () => {
    document.getElementById("deleteItemModalTitle").innerHTML = `
        Are you sure you want to delete <b>${validatorEscape(selectedItem.name)}</b>?<br><br>The page's actual data will remain in the notes folder.
    `;

    $("#deleteItemModal").modal("show");
});

/* Website functions */

export function openFeedbackForm(): void {
	api.ipcSend("openFeedbackForm");
}

export function openDownloadPage(): void {
	api.ipcSend("openDownloadPage");
}

export function openWebsite(): void {
	api.ipcSend("openWebsite");
}

export function openUpdatesPage(): void {
	api.ipcSend("openUpdatesPage");
}

export function openGithub(): void {
	api.ipcSend("openGithub");
}

export function openGithubIssues(): void {
	api.ipcSend("openGithubIssues");
}

export function openFeatherWebsite(): void {
	api.ipcSend("openFeatherWebsite");
}

/* IPC Handlers */

api.ipcHandle("updateAvailable", (event: any, newVersion: string) => {
    setTimeout(() => {
        document.getElementById("updateBlockText").textContent = `New update available (${newVersion})`;
        $("#updateBlockLI").fadeIn();
    }, 1000);
});

api.ipcHandle("console.log", (event: any, text: string) => {
    console.log(text);
});

api.ipcHandle("console.error", (event: any, text: string) => {
    console.error(text);
});

api.ipcHandle("prefsShowMenuBar", (event: any, value: boolean) => {
    prefs.showMenuBar = value;
});