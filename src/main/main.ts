import { app, BrowserWindow, dialog, net, MessageBoxOptions, ipcMain, nativeTheme, Menu, MenuItem, shell } from "electron";
import * as path from "path";
import * as fs from "fs";
import validator from "validator";
import * as semver from "semver";
import * as remote from "@electron/remote/main";
import * as contextMenu from "electron-context-menu";
import { deserialize } from "typescript-json-serializer";
import { UserPrefs } from "../common/UserPrefs";
import { Save } from "../common/Save";
import { NotebookItem, NotebookItemType } from "../common/NotebookItem";

const currentVersion = "2.0.0";
let mainWindow: BrowserWindow = null;

let save: Save = null;
let prefs: UserPrefs = null;

let canSavePrefs = false;
let canSaveSave = false;

let showFirstUseModal = false;
let showWhatsNewModal = false;

const defaultSaveLocation = app.getPath("userData");
let saveLocation = "";

// #region Init and prefs/save/page functions 

function init() {

    // Check for a different save location

    if (!fs.existsSync(defaultSaveLocation + "/saveLocation.txt")) {
        saveLocation = defaultSaveLocation;
        fs.writeFileSync(defaultSaveLocation + "/saveLocation.txt", defaultSaveLocation, "utf-8");
    }
    else {
        saveLocation = fs.readFileSync(defaultSaveLocation + "/saveLocation.txt", "utf-8").toString();
    }


    // LOAD PREFS

    if (fs.existsSync(defaultSaveLocation + "/prefs.json")) {
        try {
            const json = fs.readFileSync(defaultSaveLocation + "/prefs.json", "utf-8").toString();
            prefs = deserialize<UserPrefs>(json, UserPrefs);

            canSavePrefs = true;
        }
        catch (err) {
            errorLoadingData(`Your prefs.json file in '${defaultSaveLocation}' could not be parsed. Check the prefs.json file for issues or try deleting it.\n\n${err}`);
        }
    }
    else {
        prefs = new UserPrefs();
        saveLocation = defaultSaveLocation;
        canSavePrefs = true;
        savePrefs();

        showFirstUseModal = true;
    }

    if (semver.compare(currentVersion, prefs.lastUseVersion) == 1) {
        showWhatsNewModal = true;
        prefs.lastUseVersion = currentVersion;
    }


    // LOAD SAVE

    if (fs.existsSync(saveLocation + "/save.json")) {
        const json = fs.readFileSync(saveLocation + "/save.json", "utf-8").toString();

        // Check for old save from before 2.0.0
        try {
            const testObject = JSON.parse(json);
            if (testObject["version"] === undefined) {
                try {
                    save = convertOldSave(testObject);
                    canSaveSave = true;
                }
                catch (err) {
                    errorLoadingData(`Your save.json file in '${saveLocation}' could not be converted to the new format or is corrupted. Check the save.json file for issues, and/or report this problem to the GitHub Issues page.\n\n${err}`);
                }
            }
            else {
                try {
                    save = deserialize<Save>(json, Save);
                    canSaveSave = true;
                }
                catch (err) {
                    errorLoadingData(`Your save.json file in '${saveLocation}' could not be parsed. Check the save.json file for issues, and/or report this problem to the GitHub Issues page.\n\n${err}`);
                }
            }
        }
        catch (err) {
            errorLoadingData(`Your save.json file in '${saveLocation}' could not be parsed. Check the save.json file for issues, and/or report this problem to the GitHub Issues page.\n\n${err}`);
        }

        saveSave();
    }
    else {
        save = new Save();

        canSaveSave = true;

        saveSave();
    }

    if (!fs.existsSync(saveLocation + "/notes/")) {
        fs.mkdirSync(saveLocation + "/notes/");
    }

    if (!fs.existsSync(defaultSaveLocation + "/userStyles.css")) {
        fs.writeFileSync(defaultSaveLocation + "/userStyles.css", "/*\n    Enter custom CSS rules for Codex in this file.\n    Use Inspect Element in the DevTools (Ctrl-Shift-I) in Codex to find id's and classes.\n*/");
    }


    createWindow();
}

function savePrefs() {
    if (canSavePrefs == true) {
        fs.writeFileSync(defaultSaveLocation + "/prefs.json", JSON.stringify(prefs, null, 4), "utf-8");
    }
}

function saveSave() {
    if (canSaveSave == true) {
        fs.writeFileSync(saveLocation + "/save.json", JSON.stringify(save, null, 4), "utf-8");
    }
}

function loadPageData(fileName: string): string {
    if (!fileName.includes("/") && !fileName.includes("\\")) {
        if (fs.existsSync(saveLocation + "/notes/" + fileName)) {
            return fs.readFileSync(saveLocation + "/notes/" + fileName, "utf-8").toString();
        }
    }
    return "";
}

function savePageData(fileName: string, docObject: { [key: string]: any }): void {
    if (!fileName.includes("/") && !fileName.includes("\\") && canSaveSave == true) {
        fs.writeFileSync(saveLocation + "/notes/" + fileName, JSON.stringify(docObject), "utf-8");
    }
}

function openSaveLocation() {
    if (isValidDir(saveLocation))
        shell.openPath(saveLocation);
}

function changeSaveLocation() {

    const filepaths = dialog.showOpenDialogSync(mainWindow, {
        properties: ["openDirectory"]
    });

    if (filepaths !== undefined) {
        const newLocation = filepaths[0];

        if (isValidDir(newLocation)) {
            fs.writeFileSync(defaultSaveLocation + "/saveLocation.txt", newLocation, "utf-8");
            restart();
        }
    }
}

function revertToDefaultSaveLocation() {
    fs.writeFileSync(defaultSaveLocation + "/saveLocation.txt", defaultSaveLocation, "utf-8");
    restart();
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

            page.parentId = nb.id;

            nb.children.push(page);
        });

        newSave.notebooks.push(nb);
    });

    return newSave;
}

// #endregion

// #region Electron configuration & Window creation 

// This makes sure we get a non-cached verison of the "latestversion.txt" file for the update check
app.commandLine.appendSwitch("disable-http-cache");

// FORCE SINGLE INSTANCE
if (!app.requestSingleInstanceLock()) {
    app.quit();
}
else {
    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.on("ready", init);

    app.on("window-all-closed", function () {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== "darwin") {
            app.quit();
        }
    });

    app.on("activate", function () {
        // On OS X it"s common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            init();
        }
    });
}

// Disable navigation
// https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation
app.on("web-contents-created", (event, contents) => {
    contents.on("will-navigate", (event) => {
        event.preventDefault();
    });
});

let iconPath = "";
function createWindow() {

    let useFrame = true;

    if (process.platform === "win32") {
        useFrame = false;
        iconPath = "../../assets/icons/icon.ico";
    }
    else if (process.platform === "linux") {
        iconPath = "../../assets/icons/64x64.png";
    }
    else if (process.platform === "darwin") {
        iconPath = "../../assets/icons/icon.icns";
    }

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        frame: useFrame,
        minWidth: 920,
        minHeight: 500,
        webPreferences: {
            preload: __dirname + "/preload.js",
        },
        icon: path.join(__dirname, iconPath),
        show: false,
        title: "Codex"
    });

    // Enable @electron/remote in preload so we can
    // use the custom titlebar and set up the menus in the renderer
    remote.enable(mainWindow.webContents);
    remote.initialize();

    mainWindow.loadFile("html/index.html");

    contextMenu({
        showSearchWithGoogle: false,
        showLookUpSelection: false
    });

    Menu.setApplicationMenu(normalMenu);

    mainWindow.webContents.once("dom-ready", () => {

        mainWindow.show();
        checkForUpdates();

    });

    mainWindow.on("close", (e) => {
        e.preventDefault();
        mainWindow.webContents.send("onClose");
    });

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();

}

function checkForUpdates(): void {
    try {
        const request = net.request("https://jcv8000.github.io/codex/latestversion.txt");
        request.on("response", (response) => {
            response.on("data", (chunk) => {

                const onlineVersion = validator.escape(chunk.toString());

                if (semver.valid(onlineVersion)) {

                    mainWindow.webContents.send("console.log", `Checking for updates\nCurrent version: ${currentVersion}\nLatest version: ${onlineVersion}`);

                    // Check if online version # is greater than current version
                    if (semver.compare(currentVersion, onlineVersion) == -1) {
                        mainWindow.webContents.send("updateAvailable", onlineVersion);
                    }

                }
                else {
                    errorPoup("Failed to check for updates", "Response body was not a valid version number.");
                }

            });
            response.on("aborted", () => {
                errorPoup("Net request aborted while trying to check for updates", "");
            });
            response.on("error", (error: Error) => {
                errorPoup("Failed to check for updates", error.toString());
            });
        });

        request.on("redirect", () => {
            request.abort();
        });

        request.end();

        request.on("error", (err) => {
            errorPoup("Failed to check for updates", err.toString());
        });

    }
    catch (err) {
        errorPoup("Failed to check for updates", err.toString());
    }
}

// #endregion

// #region Utility functions

function errorPoup(mes: string, det: string) {
    const options: MessageBoxOptions = {
        type: "error",
        buttons: ["Ok"],
        defaultId: 0,
        cancelId: 0,
        detail: det,
        title: "Error",
        message: mes
    };
    dialog.showMessageBox(mainWindow, options);

    mainWindow.webContents.send("console.error", `${mes}\n${det}`);
}

function executeJavascriptInRenderer(js: string): void {
    mainWindow.webContents.executeJavaScript(js + ";0").catch((reason) => {
        errorPoup("Error executing javascript in renderer process", reason.toString());
    });
}

function openAboutWindow(): void {
    const about = new BrowserWindow({
        width: 680,
        height: 380,
        resizable: false,
        webPreferences: {
            preload: __dirname + "/about_preload.js",
        },
        icon: path.join(__dirname, iconPath),
        title: "About Codex",
        parent: mainWindow,
        modal: (process.platform === "darwin" ? false : true),
        show: false
    });
    about.webContents.once("dom-ready", () => {
        about.show();
    });
    about.setMenu(null);
    about.loadFile("html/about.html");
}

function errorLoadingData(text: string) {

    const options: MessageBoxOptions = {
        type: "error",
        buttons: ["Ok"],
        defaultId: 0,
        cancelId: 0,
        detail: text.toString(),
        title: "Error",
        message: "Error while loading prefs/save data"
    };
    dialog.showMessageBoxSync(mainWindow, options);

    app.exit();
}

function isValidDir(path: string): boolean {
    if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
        return true;
    }
    return false;
}

function restart() {
    app.relaunch();
    mainWindow.webContents.send("onClose");
}

// #endregion

// #region Menus 

const normalMenu = new Menu();
normalMenu.append(new MenuItem({
    label: "File",
    submenu: [
        {
            label: "New Notebook",
            accelerator: "CmdOrCtrl+N",
            click: () => mainWindow.webContents.send("newNotebook")
        },
        {
            type: "separator"
        },
        {
            label: "Exit",
            click: () => app.exit()
        }
    ]
}));

normalMenu.append(new MenuItem({
    label: "View",
    submenu: [
        {
            label: "Toggle Sidebar",
            accelerator: "CmdOrCtrl+D",
            click: () => executeJavascriptInRenderer("renderer.toggleSidebar(null)")
        },
        {
            label: "Reset Sidebar Width",
            click: () => executeJavascriptInRenderer("renderer.resizeSidebar(275)")
        },
        {
            type: "separator"
        },
        {
            label: "Toggle Developer Tools",
            accelerator: "CmdOrCtrl+Shift+I",
            click: () => mainWindow.webContents.toggleDevTools()
        }
    ]
}));

normalMenu.append(new MenuItem({
    label: "Help",
    submenu: [
        {
            label: "Help",
            accelerator: "F1",
            click: () => shell.openExternal("https://www.codexnotes.com/docs/")
        },
        {
            label: "Website",
            click: () => shell.openExternal("https://www.codexnotes.com/")
        },
        {
            label: "What's New",
            click: () => mainWindow.webContents.send("whatsNew")
        },
        {
            label: "All Changelogs",
            click: () => shell.openExternal("https://www.codexnotes.com/updates/")
        },
        {
            label: "Give Feedback (Google Forms)",
            click: () => shell.openExternal("https://forms.gle/uDLJpqLbNLcEx1F8A")
        },
        {
            type: "separator"
        },
        {
            label: "About",
            click: () => openAboutWindow()
        }
    ]
}));


const editingMenu = new Menu();
editingMenu.append(new MenuItem({
    label: "File",
    submenu: [
        {
            label: "New Notebook",
            accelerator: "CmdOrCtrl+N",
            click: () => executeJavascriptInRenderer("$('#newNotebookModal').modal('show')")
        },
        {
            label: "Save Page",
            accelerator: "CmdOrCtrl+S",
            click: () => executeJavascriptInRenderer("renderer.saveOpenedPage(true)")
        },
        {
            type: "separator"
        },
        {
            label: "Export page to PDF...",
            accelerator: "CmdOrCtrl+P",
            click: () => executeJavascriptInRenderer("renderer.printCurrentPage()")
        },
        {
            label: "Export page to Markdown...",
            click: () => executeJavascriptInRenderer("renderer.exportCurrentPageToMarkdown()")
        },
        {
            type: "separator"
        },
        {
            label: "Exit",
            click: () => app.exit()
        }
    ]
}));

editingMenu.append(new MenuItem({
    label: "Edit",
    submenu: [
        {
            label: "Cut",
            accelerator: "CmdOrCtrl+X",
            ////click: () => document.execCommand("cut")
        },
        {
            label: "Copy",
            accelerator: "CmdOrCtrl+C",
            ////click: () => document.execCommand("copy")
        },
        {
            label: "Paste",
            accelerator: "CmdOrCtrl+V",
            ////click: () => document.execCommand("paste")
        }
    ]
}));

editingMenu.append(new MenuItem({
    label: "View",
    submenu: [
        {
            label: "Zoom In",
            accelerator: "CmdOrCtrl+=",
            click: () => executeJavascriptInRenderer("renderer.zoomIn()")
        },
        {
            label: "Zoom Out",
            accelerator: "CmdOrCtrl+-",
            click: () => executeJavascriptInRenderer("renderer.zoomOut()")
        },
        {
            label: "Restore Default Zoom",
            accelerator: "CmdOrCtrl+R",
            click: () => executeJavascriptInRenderer("renderer.defaultZoom()")
        },
        {
            type: "separator"
        },
        {
            label: "Toggle Sidebar",
            accelerator: "CmdOrCtrl+D",
            click: () => executeJavascriptInRenderer("renderer.toggleSidebar(null)")
        },
        {
            label: "Reset Sidebar Width",
            click: () => executeJavascriptInRenderer("renderer.resizeSidebar(275)")
        },
        {
            label: "Toggle Editor Toolbar",
            accelerator: "CmdOrCtrl+T",
            click: () => executeJavascriptInRenderer("renderer.toggleEditorRibbon()")
        },
        {
            type: "separator"
        },
        {
            label: "Toggle Developer Tools",
            accelerator: "CmdOrCtrl+Shift+I",
            click: () => mainWindow.webContents.toggleDevTools()
        }
    ]
}));

editingMenu.append(new MenuItem({
    label: "Help",
    submenu: [
        {
            label: "Help",
            accelerator: "F1",
            click: () => shell.openExternal("https://www.codexnotes.com/docs/")
        },
        {
            label: "Website",
            click: () => shell.openExternal("https://www.codexnotes.com/")
        },
        {
            label: "What's New",
            click: () => mainWindow.webContents.send("whatsNew")
        },
        {
            label: "All Changelogs",
            click: () => shell.openExternal("https://www.codexnotes.com/updates/")
        },
        {
            label: "Give Feedback (Google Forms)",
            click: () => shell.openExternal("https://forms.gle/uDLJpqLbNLcEx1F8A")
        },
        {
            type: "separator"
        },
        {
            label: "About",
            click: () => openAboutWindow()
        }
    ]
}));

// Add the "Toggle Menu Bar" option for linux users
if (process.platform === "linux") {
    normalMenu.items[1].submenu.append(new MenuItem({
        label: "Toggle Menu Bar",
        click: () => {
            const current = mainWindow.isMenuBarVisible();
            mainWindow.setMenuBarVisibility(!current);
            mainWindow.webContents.send("prefsShowMenuBar", !current);
        },
        accelerator: "Ctrl+M"
    }));
    editingMenu.items[2].submenu.append(new MenuItem({
        label: "Toggle Menu Bar",
        click: () => {
            const current = mainWindow.isMenuBarVisible();
            mainWindow.setMenuBarVisibility(!current);
            mainWindow.webContents.send("prefsShowMenuBar", !current);
        },
        accelerator: "Ctrl+M"
    }));
}

// #endregion

// #region IPC Events 

ipcMain.on("errorPopup", (event, args: string[]) => {
    errorPoup(args[0], args[1]);
});

ipcMain.on("setNativeThemeSource", (event, value: string) => {
    if (value == "system")
        nativeTheme.themeSource = "system";
    else if (value == "light")
        nativeTheme.themeSource = "light";
    else if (value == "dark")
        nativeTheme.themeSource = "dark";
});

ipcMain.on("maximize", () => {
    mainWindow.maximize();
});

ipcMain.on("setMenuBarVisibility", (event, value: boolean) => {
    mainWindow.setMenuBarVisibility(value);
});

ipcMain.on("exit", () => {
    app.exit();
});

ipcMain.on("normalMenu", () => {
    Menu.setApplicationMenu(normalMenu);
    mainWindow.webContents.send("updateMenubar");
});

ipcMain.on("editingMenu", () => {
    Menu.setApplicationMenu(editingMenu);
    mainWindow.webContents.send("updateMenubar");
});

ipcMain.on("defaultSaveLocation", (event) => {
    event.returnValue = app.getPath("userData");
});

ipcMain.on("currentSaveLocation", (event) => {
    event.returnValue = saveLocation;
});

ipcMain.on("isWindowMaximized", (event) => {
    event.returnValue = mainWindow.isMaximized();
});

ipcMain.on("nativeThemeShouldUseDarkColors", (event) => {
    event.returnValue = nativeTheme.shouldUseDarkColors;
});

ipcMain.on("openAboutWindow", () => {
    openAboutWindow();
});


ipcMain.on("getPrefs", (event) => {
    event.returnValue = prefs;
});

ipcMain.on("savePrefs", (event, _prefs: UserPrefs) => {
    prefs = _prefs;
    savePrefs();
});

ipcMain.on("getSave", (event) => {
    event.returnValue = save;
});

ipcMain.on("saveSave", (event, _save: Save) => {
    console.dir(save, {depth: null});
    console.dir(_save, {depth: null});
    save = _save as Save;
    saveSave();
});

ipcMain.on("loadPageData", (event, page: NotebookItem) => {
    if (page.type === NotebookItemType.PAGE) {
        event.returnValue = loadPageData(page.fileName);
    }
});

ipcMain.on("savePageData", (event, page: NotebookItem, docObject: { [key: string]: any }) => {
    if (page.type === NotebookItemType.PAGE) {
        savePageData(page.fileName, docObject);
    }
});


// #endregion 
