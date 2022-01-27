import { MainAPI } from "../main/preload";
import * as feather from "feather-icons";
import validatorEscape from "validator/es/lib/escape";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { prosemirrorSetup, schema } from "./prosemirror";

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
    openedNotebooks: number[] = [];
    tabSize = 4;
    sidebarWidth = 275;
    showCodeOverlay = true;
    codeWordWrap = false;
    firstUse = true;
    showMenuBar = true;
}

class Save {
    nextPageIndex = 0;
    notebooks: Notebook[] = [];
}

class Notebook {
    name: string;
    color: string;
    icon = "book";
    pages: Page[] = [];
    constructor(name: string, color: string) {
        this.name = name;
        this.color = color;
        this.pages = [];
    }
}

class Page {
    title: string;
    fileName: string;
    favorite = false;
    constructor(title: string) {
        this.title = title;
        this.fileName = "";
    }
}



/* Global variables */

// TODO remove this decorator later
/* eslint-disable prefer-const */
let darkStyleLink: HTMLLinkElement;

let save: Save;
export let prefs: UserPrefs;
const defaultDataDir: string = api.ipcSendSync("defaultDataDir");
let selectedPage: Page;
let selectedPageContent: string;

let editorView: EditorView = null;

let rightClickedNotebookIndex: number;

// PAGE INDEX IS LOCAL TO THE NOTEBOOK
let rightClickedPageIndex: number;

let expandedNotebooks: Notebook[] = [];
let activePage: Page;

let draggedNotebookIndex: number;
let draggedPageIndex: number;
let draggedPagesNotebookIndex: number;
let draggingNotebook = false;
let draggingPage = false;

let fadeInSaveIndicator: NodeJS.Timeout;

let canSaveData = false;
let canSavePrefs = false;
let zoomLevel = 1.000;

let sidebarWidth = 275;

let favoritePages: Page[] = [];

let destroyOpenedNotebooks = false;

const lightThemes = [ "a11y-light", "arduino-light", "ascetic", "atelier-cave-light", "atelier-dune-light", "atelier-estuary-light", "atelier-forest-light", "atelier-heath-light", "atelier-lakeside-light", "atelier-plateau-light", "atelier-savanna-light", "atelier-seaside-light", "atelier-sulphurpool-light", "atom-one-light", "color-brewer", "default", "docco", "foundation", "github-gist", "github", "font-weight: bold;", "googlecode", "grayscale", "gruvbox-light", "idea", "isbl-editor-light", "kimbie.light", "lightfair", "magula", "mono-blue", "nnfx", "paraiso-light", "purebasic", "qtcreator_light", "routeros", "solarized-light", "tomorrow", "vs", "xcode" ];
const darkThemes = [ "a11y-dark", "agate", "androidstudio", "an-old-hope", "arta", "atelier-cave-dark", "atelier-dune-dark", "atelier-estuary-dark", "atelier-forest-dark", "atelier-heath-dark", "atelier-lakeside-dark", "atelier-plateau-dark", "atelier-savanna-dark", "atelier-seaside-dark", "atelier-sulphurpool-dark", "atom-one-dark-reasonable", "atom-one-dark", "font-weight: bold;", "codepen-embed", "darcula", "dark", "dracula", "far", "gml", "gradient-dark", "gruvbox-dark", "hopscotch", "hybrid", "ir-black", "isbl-editor-dark", "kimbie.dark", "lioshi", "monokai-sublime", "monokai", "night-owl", "nnfx-dark", "nord", "ocean", "obsidian", "paraiso-dark", "pojoaque", "qtcreator_dark", "railscasts", "rainbow", "shades-of-purple", "solarized-dark", "srcery", "sunburst", "tomorrow-night-blue", "tomorrow-night-bright", "tomorrow-night-eighties", "tomorrow-night", "vs2015", "xt256", "zenburn" ];
/* eslint-enable prefer-const */



/* Initialization */

window.onbeforeunload = (e) => {


    //cache which notebooks are opened
    prefs.openedNotebooks = [];


    if (destroyOpenedNotebooks == false) {
        for (let i = 0; i < save.notebooks.length; i++) {

            const nbList = document.getElementById(`nb-${i}-list`);
            if (nbList.classList.contains("show")) {
                prefs.openedNotebooks[prefs.openedNotebooks.length] = i;
            }
        }
    }


    saveData();
    savePrefs();
};

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
        try {
            const json = api.fsReadFileSync(prefs.dataDir + "/save.json");
            save = JSON.parse(json);

            // Add missing icon property
            for (let i = 0; i < save.notebooks.length; i++) {
                if (save.notebooks[i].icon === undefined) {
                    save.notebooks[i].icon = "book";
                }
            }

            canSaveData = true;
        }
        catch (err) {
            canSaveData = false;
            errorPopup("Your save file could not be parsed correctly.", "Please make sure your save.json JSON file is intact");
        }
    }
    else {
        save = new Save();
        save.notebooks = [];
        save.nextPageIndex = 0;
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

    addSidebarLinkEvents();

    // Hide context menus on resize, and hide sidebar if window becomes too small
    window.addEventListener("resize", () => {

        document.getElementById("notebook-context-menu").style.display = "none";
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

    applyModalEventHandlers();

    displayNotebooks();

    // open the notebooks which were open before
    for (let i = 0; i < prefs.openedNotebooks.length; i++) {
        try {
            const nbList = document.getElementById(`nb-${prefs.openedNotebooks[i]}-list`);
            nbList.classList.add("show");
            document.getElementById(`nb-${prefs.openedNotebooks[i]}`).setAttribute("aria-expanded", "true");
        }
        catch (error) {
            console.error(error);
            errorPopup("Error while trying to load notebooks.", "Check the developer console for more information.");
        }
    }


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
    sidebarResizer.addEventListener("mousedown", (e) => {
        window.addEventListener("mousemove", handleSidebarResizerDrag, false);
        window.addEventListener("mouseup", () => {
            window.removeEventListener("mousemove", handleSidebarResizerDrag, false);
        }, false);
    });


    // Set up Icon Selectors for notebook modals
    const newNotebookIconSelect = <HTMLSelectElement>document.getElementById("newNotebookIconSelect");
    const editNotebookIconSelect = <HTMLSelectElement>document.getElementById("editNotebookIconSelect");

    Object.keys(feather.icons).forEach(element => {
        const op1 = document.createElement("option");
        op1.text = element;
        op1.value = element;
        newNotebookIconSelect.appendChild(op1);

        const op2 = document.createElement("option");
        op2.text = element;
        op2.value = element;
        editNotebookIconSelect.appendChild(op2);
    });

    newNotebookIconSelect.value = "book";

    newNotebookIconSelect.addEventListener("change", () => {
        document.getElementById("newNotebookIconPreview").setAttribute("data-feather", (document.getElementById("newNotebookIconSelect") as HTMLSelectElement).value);
        feather.replace();
    });

    document.getElementById("newNotebookColorPicker").addEventListener("change", () => {
        document.getElementById("newNotebookIconPreview").style.color = (document.getElementById("newNotebookColorPicker") as HTMLInputElement).value;
    });

    editNotebookIconSelect.addEventListener("change", () => {
        document.getElementById("editNotebookIconPreview").setAttribute("data-feather", (document.getElementById("editNotebookIconSelect") as HTMLSelectElement).value);
        feather.replace();
    });

    document.getElementById("editNotebookColorPicker").addEventListener("change", () => {
        document.getElementById("editNotebookIconPreview").style.color = (document.getElementById("editNotebookColorPicker") as HTMLInputElement).value;
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

    if (prefs.openedNotebooks === undefined)
        prefs.openedNotebooks = [];

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

        if (destroyOpenedNotebooks) {
            prefs.openedNotebooks = [];
        }

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
            api.fsWriteFileSync(prefs.dataDir + "/save.json", JSON.stringify(save, null, 2));
            //TODO
            //saveSelectedPage();
        }
        catch (err) {
            console.error(err);
            errorPopup("Couldn't save the save.json file", "Check the developer console for more information");
        }
    }
}

export function addSidebarLinkEvents(): void {
    document.querySelectorAll(".my-sidebar-link").forEach(function (item) {
        item.addEventListener("click", () => {
            //change selected sidebar item

            document.querySelectorAll(".my-sidebar-link").forEach(function (item) {
                item.classList.toggle("active", false);
            });

            item.classList.toggle("active", true);

        });
    });

    document.addEventListener("click", (e) => {
        if (e.target != document.getElementById("notebook-context-menu") && e.target != document.getElementById("page-context-menu")) {
            document.getElementById("notebook-context-menu").style.display = "none";
            document.getElementById("page-context-menu").style.display = "none";
        }
    });
}

export function errorPopup(message: string, detail: string) {
    api.ipcSend("errorPopup", message, detail);
}

export function showUIPage(id: "homePage" | "settingsPage" | "editorPage"): void {
    const ids = ["homePage", "settingsPage", "editorPage"];

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
	}
}

export function zoomIn(): void {
    if (selectedPage != null) {
        if (zoomLevel < 4.000) {
            zoomLevel += 0.100;
            updateZoom();
        }
    }
}

export function zoomOut(): void {
    if (selectedPage != null) {
        if (zoomLevel > 0.700) {
            zoomLevel -= 0.100;
            updateZoom();
        }
    }
}

export function defaultZoom(): void {
    if (selectedPage != null) {
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

export function displayNotebooks(): void {

    //clear the list
    document.getElementById("notebookList").innerHTML = "";
    favoritePages = [];

    for (let i = 0; i < save.notebooks.length; i++) {

        addNotebookToList(i);

        if (expandedNotebooks.includes(save.notebooks[i])) {
            document.getElementById(`nb-${i}-list`).classList.add("show");
            document.getElementById(`nb-${i}`).setAttribute("aria-expanded", "true");
        }

        //populate the notebook with its pages
        for (let e = 0; e < save.notebooks[i].pages.length; e++) {

            addPageToAList(i, e);

            if (save.notebooks[i].pages[e] == activePage) {
                const pageA = document.querySelector(`a[notebook-index="${i}"][page-index="${e}"]`);
                pageA.classList.add("active");
            }

            if (save.notebooks[i].pages[e].favorite) {
                favoritePages.push(save.notebooks[i].pages[e]);
            }

        }
    }

    updateFavoritesSection();
}

export function addNotebookToList(index: number) {
    const notebook = save.notebooks[index];

    const el = document.createElement("li");
    el.classList.add("nav-item");
    el.classList.add("my-sidebar-item");
    el.draggable = true;
    el.style.transition = "box-shadow 0.2s ease";

    const a = document.createElement("a");
    a.id = `nb-${index}`;
    a.title = notebook.name;
    a.setAttribute("notebook-index", index.toString());
    a.classList.add("nav-link", "notebook", "unselectable");
    a.href = `#nb-${index}-list`;
    a.setAttribute("data-toggle", "collapse");
    a.setAttribute("aria-expanded", "false");

    a.innerHTML = `
        <div class="row">
            <div class="col-auto pr-0">
                <span data-feather="${validatorEscape(notebook.icon)}" style="color: ${notebook.color}"></span>
            </div>
            <div class="col pr-1" style="padding-left: 5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${validatorEscape(notebook.name)}</div>
            <div class="col-auto" style="padding-right: 20px">
                <span class="caret"></span>
            </div>
        </div>
    `;
    el.appendChild(a);

    const ul = document.createElement("ul");
    ul.classList.add("nav", "collapse");
    ul.id = `nb-${index}-list`;
    el.appendChild(ul);

    if (notebook.pages.length == 0) {
        const emptyIndicator = document.createElement("li");
        emptyIndicator.classList.add("nav-item", "emptyIndicator");
        emptyIndicator.innerHTML = "<i class=\"nav-link indent font-weight-light unselectable\">Nothing here yet...</i>";
        ul.appendChild(emptyIndicator);
    }

    document.getElementById("notebookList").appendChild(el);
    feather.replace();

    //Add necessary event listeners
    a.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        document.getElementById("page-context-menu").style.display = "none";
        const cm = document.getElementById("notebook-context-menu");
        cm.style.display = "block";
        cm.style.left = `${e.clientX}px`;

        // Put the menu above the cursor if it's going to go off screen
        if (window.innerHeight - e.clientY < cm.clientHeight) {
            cm.style.top = `${e.clientY - cm.clientHeight}px`;
        }
        else {
            cm.style.top = `${e.clientY}px`;
        }
        rightClickedNotebookIndex = parseInt(this.getAttribute("notebook-index"));
    });



    //DRAG SORTING
    el.addEventListener("dragstart", function (e) {
        draggedNotebookIndex = parseInt(this.children[0].getAttribute("notebook-index"));
        draggingNotebook = true;
        e.dataTransfer.dropEffect = "move";
        const img = new Image();
        e.dataTransfer.setDragImage(img, 0, 0);
    });
    el.addEventListener("dragover", function (e) {
        e.preventDefault();

        if (draggingNotebook) {

            const otherIndex = draggedNotebookIndex;
            const thisIndex = parseInt(this.children[0].getAttribute("notebook-index"));

            if (otherIndex != thisIndex) {
                e.dataTransfer.dropEffect = "move";
                const relativeY = e.clientY - this.getBoundingClientRect().top;
                if (relativeY > 18) {
                    //PLACE THE OTHER NOTEBOOK BELOW THIS ONE
                    this.style.boxShadow = "0px -2px 0px orange inset";
                }
                else if (relativeY <= 18) {
                    //PLACE THE OTHER NOTEBOOK ABOVE THIS ONE
                    this.style.boxShadow = "0px 2px 0px orange inset";
                }
            }
            else {
                e.dataTransfer.dropEffect = "none";
                return false;
            }
        }
        else if (draggingPage) {
            this.style.boxShadow = "0px -2px 0px pink inset";
        }
        else {
            e.dataTransfer.dropEffect = "none";
            return false;
        }

    });
    el.addEventListener("dragleave", function (e) {
        this.style.boxShadow = "none";
    });
    el.addEventListener("drop", function (e) {
        e.preventDefault();
        //this is called on the element that is being dropped on
        this.style.boxShadow = "none";

        if (draggingNotebook) {
            const myIndex = parseInt(this.children[0].getAttribute("notebook-index"));
            const draggedIndex = draggedNotebookIndex;

            if (myIndex != draggedIndex) {
                const relativeY = e.clientY - this.getBoundingClientRect().top;

                getExpandedNotebookData();
                if (relativeY > 18) {
                    //PLACE MY NOTEBOOK BELOW THE LANDED ONE

                    const nb = save.notebooks[draggedIndex];
                    const fillerNB = new Notebook("empty", "000000");
                    save.notebooks[draggedIndex] = fillerNB;
                    save.notebooks.splice(myIndex + 1, 0, nb);
                    save.notebooks.splice(save.notebooks.indexOf(fillerNB), 1);
                }
                else if (relativeY <= 18) {
                    //PLACE MY NOTEBOOK ABOVE THE LANDED ONE

                    const nb = save.notebooks[draggedIndex];
                    const fillerNB = new Notebook("empty", "000000");
                    save.notebooks[draggedIndex] = fillerNB;
                    save.notebooks.splice(myIndex, 0, nb);
                    save.notebooks.splice(save.notebooks.indexOf(fillerNB), 1);
                }

                saveData();
                displayNotebooks();
            }
        }
        else if (draggingPage) {
            const myNotebookIndex = parseInt(this.children[0].getAttribute("notebook-index"));

            if (myNotebookIndex != draggedPagesNotebookIndex) {
                getExpandedNotebookData();

                const pg = save.notebooks[draggedPagesNotebookIndex].pages[draggedPageIndex];
                save.notebooks[myNotebookIndex].pages.push(pg);
                save.notebooks[draggedPagesNotebookIndex].pages.splice(draggedPageIndex, 1);

                saveData();
                displayNotebooks();
            }
        }
    });
    el.addEventListener("dragend", function (e) {
        draggingNotebook = false;
    });
}

export function addPageToAList(notebookIndex: number, index: number): void {

    const page = save.notebooks[notebookIndex].pages[index];

    const el = document.createElement("li");
    el.classList.add("nav-item");
    el.classList.add("my-sidebar-item");
    el.draggable = true;
    el.style.transition = "box-shadow 0.2s ease";

    const a = document.createElement("a");
    a.id = `page-${index}`;
    a.title = `${page.title}`;
    a.href = "#";
    a.classList.add("nav-link", "my-sidebar-link", "indent", "unselectable");

    if (page.favorite) {
        a.innerHTML = `
        <div class="row">
            <div class="col-auto pr-0">
                <span data-feather="file-text"></span>
            </div>
            <div class="col pr-1" style="padding-left: 5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${validatorEscape(page.title)}</div>
            <div class="col-auto" style="padding-right: 13px">
                <span data-feather="star" style="width: 14px; height: 14px; color: orange; vertical-align: -2px"></span>
            </div>
        </div>
        `;
    }
    else {
        a.innerHTML = `
        <div class="row">
            <div class="col-auto pr-0">
                <span data-feather="file-text"></span>
            </div>
            <div class="col pr-4" style="padding-left: 5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${validatorEscape(page.title)}</div>
        </div>
        `;
    }

    a.setAttribute("notebook-index", `${notebookIndex}`);
    a.setAttribute("page-index", `${index}`);
    el.appendChild(a);

    const nbList = document.getElementById(`nb-${notebookIndex}-list`);

    //Delete empty indicator if it's there
    nbList.querySelectorAll(".emptyIndicator").forEach((indicator) => {
        indicator.parentNode.removeChild(indicator);
    });

    nbList.appendChild(el);
    feather.replace();

    a.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        document.getElementById("notebook-context-menu").style.display = "none";
        const cm = document.getElementById("page-context-menu");
        cm.style.display = "block";
        cm.style.left = `${e.clientX}px`;

        // Put the menu above the cursor if it's going to go off screen
        if (window.innerHeight - e.clientY < cm.clientHeight) {
            cm.style.top = `${e.clientY - cm.clientHeight}px`;
        }
        else {
            cm.style.top = `${e.clientY}px`;
        }

        rightClickedNotebookIndex = parseInt(this.getAttribute("notebook-index"));
        rightClickedPageIndex = parseInt(this.getAttribute("page-index"));

        if (save.notebooks[rightClickedNotebookIndex].pages[rightClickedPageIndex].favorite) {
            document.getElementById("FavoritePageLink").innerText = "Unfavorite page";
        }
        else {
            document.getElementById("FavoritePageLink").innerText = "Favorite page";
        }
    });
    a.addEventListener("click", function () {
        showUIPage("editorPage");
        //TODO
        loadPage(parseInt(this.getAttribute("notebook-index")), parseInt(this.getAttribute("page-index")));

        //change selected sidebar item

        document.querySelectorAll(".my-sidebar-link").forEach((item) => {
            item.classList.toggle("active", false);
        });

        this.classList.toggle("active", true);

    });

    el.addEventListener("dragstart", function (e) {
        e.stopPropagation();
        draggedPagesNotebookIndex = parseInt(this.children[0].getAttribute("notebook-index"));
        draggedPageIndex = parseInt(this.children[0].getAttribute("page-index"));
        draggingPage = true;
        const img = new Image();
        e.dataTransfer.setDragImage(img, 0, 0);
        e.dataTransfer.dropEffect = "move";
    });
    el.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (draggingPage) {

            const otherPageIndex = draggedPageIndex;
            const thisPageIndex = parseInt(this.children[0].getAttribute("page-index"));
            const otherNotebookIndex = draggedPagesNotebookIndex;
            const thisNotebookIndex = parseInt(this.children[0].getAttribute("notebook-index"));

            if (save.notebooks[thisNotebookIndex].pages[thisPageIndex] != save.notebooks[otherNotebookIndex].pages[otherPageIndex]) {
                e.dataTransfer.dropEffect = "move";
                const relativeY = e.clientY - this.getBoundingClientRect().top;
                if (relativeY > 18) {
                    //PLACE THE OTHER NOTEBOOK BELOW THIS ONE
                    this.style.boxShadow = "0px -2px 0px blue inset";
                }
                else if (relativeY <= 18) {
                    //PLACE THE OTHER NOTEBOOK ABOVE THIS ONE
                    this.style.boxShadow = "0px 2px 0px blue inset";
                }
            }
            else {
                e.dataTransfer.dropEffect = "none";
                return false;
            }
        }
        else {
            e.dataTransfer.dropEffect = "none";
            return false;
        }

    });
    el.addEventListener("dragleave", function (e) {
        e.stopPropagation();
        this.style.boxShadow = "none";
    });
    el.addEventListener("drop", function (e) {
        e.stopPropagation();
        e.preventDefault();
        //this is called on the element that is being dropped on
        this.style.boxShadow = "none";

        const otherPageIndex = draggedPageIndex;
        const thisPageIndex = parseInt(this.children[0].getAttribute("page-index"));
        const otherNotebookIndex = draggedPagesNotebookIndex;
        const thisNotebookIndex = parseInt(this.children[0].getAttribute("notebook-index"));

        if (save.notebooks[thisNotebookIndex].pages[thisPageIndex] != save.notebooks[otherNotebookIndex].pages[otherPageIndex]) {

            if (thisNotebookIndex == otherNotebookIndex) {
                //MOVING PAGE IN THE SAME NOTEBOOK
                const relativeY = e.clientY - this.getBoundingClientRect().top;

                getExpandedNotebookData();
                if (relativeY > 18) {
                    //PLACE DRAGGED PAGE BELOW THE LANDED ONE

                    const pg = save.notebooks[otherNotebookIndex].pages[otherPageIndex];
                    const fillerPG = new Page("empty");
                    save.notebooks[otherNotebookIndex].pages[otherPageIndex] = fillerPG;
                    save.notebooks[otherNotebookIndex].pages.splice(thisPageIndex + 1, 0, pg);
                    save.notebooks[otherNotebookIndex].pages.splice(save.notebooks[otherNotebookIndex].pages.indexOf(fillerPG), 1);
                }
                else if (relativeY <= 18) {
                    //PLACE DRAGGED PAGE ABOVE THE LANDED ONE

                    const pg = save.notebooks[otherNotebookIndex].pages[otherPageIndex];
                    const fillerPG = new Page("empty");
                    save.notebooks[otherNotebookIndex].pages[otherPageIndex] = fillerPG;
                    save.notebooks[otherNotebookIndex].pages.splice(thisPageIndex, 0, pg);
                    save.notebooks[otherNotebookIndex].pages.splice(save.notebooks[otherNotebookIndex].pages.indexOf(fillerPG), 1);
                }

                saveData();
                displayNotebooks();
            }
            else {
                //MOVING PAGE INTO ANOTHER NOTEBOOK

                const relativeY = e.clientY - this.getBoundingClientRect().top;

                getExpandedNotebookData();
                if (relativeY > 18) {
                    //PLACE DRAGGED PAGE BELOW THE LANDED ONE

                    const pg = save.notebooks[otherNotebookIndex].pages[otherPageIndex];
                    const fillerPG = new Page("empty");
                    save.notebooks[otherNotebookIndex].pages[otherPageIndex] = fillerPG;
                    save.notebooks[thisNotebookIndex].pages.splice(thisPageIndex + 1, 0, pg);
                    save.notebooks[otherNotebookIndex].pages.splice(save.notebooks[otherNotebookIndex].pages.indexOf(fillerPG), 1);
                }
                else if (relativeY <= 18) {
                    //PLACE DRAGGED PAGE ABOVE THE LANDED ONE

                    const pg = save.notebooks[otherNotebookIndex].pages[otherPageIndex];
                    const fillerPG = new Page("empty");
                    save.notebooks[otherNotebookIndex].pages[otherPageIndex] = fillerPG;
                    save.notebooks[thisNotebookIndex].pages.splice(thisPageIndex, 0, pg);
                    save.notebooks[otherNotebookIndex].pages.splice(save.notebooks[otherNotebookIndex].pages.indexOf(fillerPG), 1);
                }

                saveData();
                displayNotebooks();
            }

        }
    });
    el.addEventListener("dragend", function (e) {
        e.stopPropagation();
        draggingPage = false;
    });
}

export function getExpandedNotebookData(): void {
    expandedNotebooks = [];
    activePage = null;
    for (let i = 0; i < save.notebooks.length; i++) {

        const nbList = document.getElementById(`nb-${i}-list`);
        if (nbList.classList.contains("show")) {
            expandedNotebooks.push(save.notebooks[i]);
        }

        //populate the notebook with its pages
        for (let e = 0; e < save.notebooks[i].pages.length; e++) {

            const pageA = document.querySelector(`a[notebook-index="${i}"][page-index="${e}"]`);
            if (pageA.classList.contains("active")) {
                activePage = save.notebooks[i].pages[e];
            }
        }
    }
}

export function updateFavoritesSection(): void {
    const container = document.getElementById("favoritesContainer");
    container.innerHTML = "";

    if (favoritePages.length == 0) {
            const div1 = document.createElement("div");
            div1.className = "fakeFavoriteBlock";

            div1.innerHTML = `
                <i class="mx-auto" style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden; font-weight: 400; vertical-align: middle; line-height: 34px;">Nothing here yet...</i>
            `;

            container.appendChild(div1);


            const div2 = document.createElement("div");
            div2.className = "fakeFavoriteBlock";

            container.appendChild(div2);

            const div3 = document.createElement("div");
            div3.className = "fakeFavoriteBlock";

            container.appendChild(div3);
    }

    for (let i = 0; i < favoritePages.length; i++) {
        const page = favoritePages[i];

        const a = document.createElement("a");
        a.className = "favoriteBlock shadow-sm";
        a.title = page.title;

        let nbIndex: number;
        let pgIndex: number;
        for (let n = 0; n < save.notebooks.length; n++) {
            for (let p = 0; p < save.notebooks[n].pages.length; p++) {
                if (save.notebooks[n].pages[p] == page) {
                    nbIndex = n;
                    pgIndex = p;
                }
            }
        }

        const parent = save.notebooks[nbIndex];

        a.innerHTML = `        
        <div class="row" style="width: 100%">
            <div class="col-auto">
                <span data-feather="${validatorEscape(parent.icon)}" style="width: 32px; height: 32px; color: ${parent.color}"></span>
            </div>
            <div class="col" style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden; font-weight: 500; vertical-align: middle; line-height: 34px;">${validatorEscape(page.title)}</div>
            <div class="col-auto" style="width: 32px">
                <span data-feather="star" style="width: 24px; height: 24px; color: orange; vertical-align: -12px"></span>
            </div>
        </div>
        `;

        container.appendChild(a);

        a.addEventListener("click", (e) => {
            const tab = document.getElementById(`nb-${nbIndex}`);
            if (tab.getAttribute("aria-expanded") != "true") {
                $(`#nb-${nbIndex}`).click();
            }

            document.querySelectorAll(".my-sidebar-link").forEach(function (item) {
                item.classList.toggle("active", false);
            });
            const page = document.querySelector(`[notebook-index='${nbIndex}'][page-index='${pgIndex}']`);
            page.classList.toggle("active", true);

            showUIPage("editorPage");
            //TODO
            loadPage(nbIndex, pgIndex);
        });

        a.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            document.getElementById("notebook-context-menu").style.display = "none";
            const cm = document.getElementById("page-context-menu");
            cm.style.display = "block";
            cm.style.left = `${e.clientX}px`;

            // Put the menu above the cursor if it's going to go off screen
            if (window.innerHeight - e.clientY < cm.clientHeight) {
                cm.style.top = `${e.clientY - cm.clientHeight}px`;
            }
            else {
                cm.style.top = `${e.clientY}px`;
            }

            rightClickedNotebookIndex = nbIndex;
            rightClickedPageIndex = pgIndex;

            if (save.notebooks[rightClickedNotebookIndex].pages[rightClickedPageIndex].favorite) {
                document.getElementById("FavoritePageLink").innerText = "Unfavorite page";
            }
            else {
                document.getElementById("FavoritePageLink").innerText = "Favorite page";
            }
        });
    }

    feather.replace();
}

export function applyModalEventHandlers(): void {

    /* NEW NOTEBOOK MODAL */
    document.getElementById("newNotebookForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = (document.getElementById("newNotebookNameInput") as HTMLInputElement).value;
        const color = (document.getElementById("newNotebookColorPicker") as HTMLInputElement).value;
        const icon = (document.getElementById("newNotebookIconSelect") as HTMLSelectElement).value;
        if (name !== "") {

            getExpandedNotebookData();

            const nb = new Notebook(name, color);
            nb.icon = icon;
            const index = save.notebooks.length;
            save.notebooks.push(nb);

            $("#newNotebookModal").modal("hide");

            saveData();
            displayNotebooks();
            document.getElementById("newNotebookNameInput").classList.remove("is-invalid");
            (document.getElementById("newNotebookNameInput") as HTMLInputElement).value = "";
            (document.getElementById("newNotebookColorPicker") as HTMLInputElement).value = "#000000";
            (document.getElementById("newNotebookIconSelect") as HTMLSelectElement).value = "book";
            document.getElementById("newNotebookIconPreview").setAttribute("data-feather", "book");
            feather.replace();
            document.getElementById("newNotebookIconPreview").style.color = "black";
        }
        else {
            document.getElementById("newNotebookNameInput").classList.add("is-invalid");
        }
    });

    $("#newNotebookModal").on("shown.bs.modal", (e) => {
        document.getElementById("newNotebookNameInput").focus();
    });

    $("#newNotebookModal").on("hidden.bs.modal", (e) => {
        document.getElementById("newNotebookNameInput").classList.remove("is-invalid");
    });


    /* EDIT NOTEBOOK MODAL */
    document.getElementById("editNotebookForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const newName = (document.getElementById("editNotebookNameInput") as HTMLInputElement).value;
        const newColor = (document.getElementById("editNotebookColorPicker") as HTMLInputElement).value;
        const newIcon = (document.getElementById("editNotebookIconSelect") as HTMLSelectElement).value;

        if (newName !== "") {
            $("#editNotebookModal").modal("hide");

            getExpandedNotebookData();

            save.notebooks[rightClickedNotebookIndex].name = newName;
            save.notebooks[rightClickedNotebookIndex].color = newColor;
            save.notebooks[rightClickedNotebookIndex].icon = newIcon;
            saveData();

            displayNotebooks();
        }
        else {
            document.getElementById("editNotebookNameInput").classList.add("is-invalid");
        }
    });

    $("#editNotebookModal").on("shown.bs.modal", (e) => {
        document.getElementById("editNotebookNameInput").focus();
    });

    $("#editNotebookModal").on("hidden.bs.modal", (e) => {
        document.getElementById("editNotebookNameInput").classList.remove("is-invalid");
    });


    /* NEW PAGE MODAL */
    document.getElementById("newPageForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = (document.getElementById("newPageNameInput") as HTMLInputElement).value;

        if (name !== "") {
            $("#newPageModal").modal("hide");

            getExpandedNotebookData();

            const p = new Page(name);
            p.fileName = save.nextPageIndex.toString() + ".json";
            save.nextPageIndex++;

            const index = save.notebooks[rightClickedNotebookIndex].pages.length;
            save.notebooks[rightClickedNotebookIndex].pages.push(p);

            api.fsWriteFileSync(prefs.dataDir + "/notes/" + p.fileName, "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}");
            saveData();

            displayNotebooks();

            (document.getElementById("newPageNameInput") as HTMLInputElement).value = "";
        }
        else {
            document.getElementById("newPageNameInput").classList.add("is-invalid");
        }
    });

    $("#newPageModal").on("shown.bs.modal", (e) => {
        document.getElementById("newPageNameInput").focus();
    });

    $("#newPageModal").on("hidden.bs.modal", (e) => {
        document.getElementById("newPageNameInput").classList.remove("is-invalid");
    });


    /* EDIT PAGE MODAL */
    document.getElementById("editPageForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const newName = (document.getElementById("editPageNameInput") as HTMLInputElement).value;

        if (newName !== "") {
            $("#editPageModal").modal("hide");

            getExpandedNotebookData();

            save.notebooks[rightClickedNotebookIndex].pages[rightClickedPageIndex].title = newName;
            saveData();
            displayNotebooks();
        }
        else {
            document.getElementById("editPageNameInput").classList.add("is-invalid");
        }
    });

    $("#editPageModal").on("shown.bs.modal", (e) => {
        document.getElementById("editPageNameInput").focus();
    });

    $("#editPageModal").on("hidden.bs.modal", (e) => {
        document.getElementById("editPageNameInput").classList.remove("is-invalid");
    });
}

export function revertAccentColor(): void {
    prefs.accentColor = "#FF7A27";
    (document.getElementById("accentColorPicker") as HTMLInputElement).value = "#FF7A27";
    document.documentElement.style.setProperty("--accent-color", prefs.accentColor);
}

export function editSelectedNotebook(): void {
    $("#editNotebookModal").modal("show");
    (document.getElementById("editNotebookNameInput") as HTMLInputElement).value = save.notebooks[rightClickedNotebookIndex].name;
    (document.getElementById("editNotebookColorPicker") as HTMLInputElement).value = save.notebooks[rightClickedNotebookIndex].color;
    (document.getElementById("editNotebookIconSelect") as HTMLSelectElement).value = save.notebooks[rightClickedNotebookIndex].icon;
    document.getElementById("editNotebookIconPreview").setAttribute("data-feather", save.notebooks[rightClickedNotebookIndex].icon);
    document.getElementById("editNotebookIconPreview").style.color = save.notebooks[rightClickedNotebookIndex].color;
    feather.replace();
}

export function deleteSelectedNotebook(): void {
    getExpandedNotebookData();
    save.notebooks.splice(rightClickedNotebookIndex, 1);
    saveData();
    displayNotebooks();
    showUIPage("homePage");

    document.querySelectorAll(".my-sidebar-link").forEach(function (item) {
        item.classList.toggle("active", false);
    });
    document.getElementById("homeTab").classList.toggle("active", true);
}

export function editSelectedPage(): void {
    $("#editPageModal").modal("show");
    (document.getElementById("editPageNameInput") as HTMLInputElement).value = save.notebooks[rightClickedNotebookIndex].pages[rightClickedPageIndex].title;
}

export function deleteSelectedPage(): void {
    getExpandedNotebookData();
    save.notebooks[rightClickedNotebookIndex].pages.splice(rightClickedPageIndex, 1);
    saveData();
    displayNotebooks();

    showUIPage("homePage");

    document.querySelectorAll(".my-sidebar-link").forEach(function (item) {
        item.classList.toggle("active", false);
    });
    document.getElementById("homeTab").classList.toggle("active", true);
}

export function toggleFavoritePage() {
    const page = save.notebooks[rightClickedNotebookIndex].pages[rightClickedPageIndex];

    page.favorite = !page.favorite;
    getExpandedNotebookData();
    saveData();
    displayNotebooks();
}

export function loadPage(notebookIndex: number, pageIndex: number) {
    //saveSelectedPage();
    selectedPageContent = "";
    selectedPage = save.notebooks[notebookIndex].pages[pageIndex];
    selectedPageContent = api.fsReadFileSync(prefs.dataDir + "/notes/" + selectedPage.fileName);

    if (editorView != null) {
        editorView.destroy();
    }
    editorView = new EditorView(document.getElementById("editor"), {
        state: EditorState.create({
            doc: schema.nodeFromJSON(JSON.parse(selectedPageContent)),
            plugins: prosemirrorSetup(prefs.tabSize)
        })
    });

    document.getElementById("mainContainer").scrollTo(0, 0);
    //window.view.focus();
}

export function saveSelectedPage(showIndicator = false) {
    if (selectedPage != null && canSaveData) {

        try {
            const cont = JSON.stringify(editorView.state.doc.toJSON());

            api.fsWriteFileSync(prefs.dataDir + "/notes/" + selectedPage.fileName, cont);

            let title = selectedPage.title;
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
        }
    }
}

export function openDataDir() {
    api.ipcSend("openDataDir", prefs.dataDir);
}

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