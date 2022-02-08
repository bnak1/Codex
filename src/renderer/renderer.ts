import { MainAPI } from "../main/preload";
import * as feather from "feather-icons";
import validatorEscape from "validator/es/lib/escape";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { prosemirrorSetup, schema } from "./prosemirror";
import { Save } from "../common/Save";
import { NotebookItem, NotebookItemType } from "../common/NotebookItem";
import { UserPrefs } from "../common/UserPrefs";

// #region Expose the variables/functions sent through the preload.ts

type BridgedWindow = Window & typeof globalThis & {
    mainAPI: any
}

const api: MainAPI = (window as BridgedWindow).mainAPI.api;


let prefs: UserPrefs = null;
let save: Save = null;

const defaultDataDir = api.defaultSaveLocation();
const idToObjectMap = new Map<string, NotebookItem>();

// #endregion


// #region GLOBAL VARIABLES

let darkStyleLink: HTMLLinkElement;

let editorView: EditorView = null;

let fadeInSaveIndicator: NodeJS.Timeout;

let selectedItem: NotebookItem;
let createNewItemMode: NotebookItemType;
let openedPage: NotebookItem;

let zoomLevel = 1.000;

let sidebarWidth = 275;

const lightThemes = [ "a11y-light", "arduino-light", "ascetic", "atelier-cave-light", "atelier-dune-light", "atelier-estuary-light", "atelier-forest-light", "atelier-heath-light", "atelier-lakeside-light", "atelier-plateau-light", "atelier-savanna-light", "atelier-seaside-light", "atelier-sulphurpool-light", "atom-one-light", "color-brewer", "default", "docco", "foundation", "github-gist", "github", "font-weight: bold;", "googlecode", "grayscale", "gruvbox-light", "idea", "isbl-editor-light", "kimbie.light", "lightfair", "magula", "mono-blue", "nnfx", "paraiso-light", "purebasic", "qtcreator_light", "routeros", "solarized-light", "tomorrow", "vs", "xcode" ];

// #endregion

// #region INITIALIZATION

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

    prefs = api.getPrefs();

    save = api.getSave();
    
    applyPrefsAtStart();

    // Custom user stylesheet
    (document.getElementById("customStylesheetLink") as HTMLLinkElement).href = "file:///" + defaultDataDir + "/userStyles.css";

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

// #endregion

// #region LOGIC FUNCTIONS

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

    /*if (api.fsExistsSync(prefs.dataDir)) {
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
    }*/

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

    /*if (api.fsExistsSync(prefs.dataDir)) {
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
    }*/

    api.savePrefs(prefs);

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

    // The zoom variable is not part of any standard but seems to work how I want it to for now
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

        let content = api.loadPageData(openedPage.fileName);

        if (content === "") {
            content = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";
        }

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
    if (openedPage != null && openedPage.type === NotebookItemType.PAGE && editorView != null) {
        try {

            api.savePageData(openedPage.fileName, editorView.state.doc.toJSON());

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

// #endregion

// #region DOM EVENT HANDLERS

document.getElementById("newNotebookBtn").addEventListener("click", () => {
    createNewItemMode = NotebookItemType.NOTEBOOK;
    selectedItem = null;

    $("#newItemModal").modal("show");
});

// FIRST USE MODAL
$("#firstUseModal").on("hidden.bs.modal", () => {
    prefs.firstUse = false;
});

// NEW ITEM MODAL
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

        api.saveData(save);
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

// EDIT ITEM MODAL
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

        api.saveData(save);
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

// DELETE ITEM MODAL
$("#deleteItemButton").on("click", () => {

    saveOpenedPage();
    showUIPage("homePage");

    if (selectedItem.type === NotebookItemType.NOTEBOOK) {
        try {
            const index = save.notebooks.indexOf(selectedItem);
            if (index > -1) {
                save.notebooks.splice(index, 1);
                api.saveData(save);
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
        const parent = NotebookItem.getParent(save.notebooks, selectedItem);

        if (parent != null) {
            try {
                const index = parent.children.indexOf(selectedItem);
                if (index > -1) {
                    parent.children.splice(index, 1);
                    api.saveData(save);
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


// Notebook context menu items
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


// Section context menu items
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


// Page context menu items
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

// #endregion

// #region EXTERNAL LINK FUNCTIONS

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

// #endregion

// #region IPC HANDLERS

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

api.ipcHandle("onClose", () => {
    prefs.defaultMaximized = api.ipcSendSync("isWindowMaximized");
    api.savePrefs(prefs);
    saveOpenedPage();
    api.saveData(save);
    api.ipcSend("exit");
});

// #endregion
