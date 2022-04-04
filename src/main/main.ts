import { app, BrowserWindow, dialog, net, MessageBoxOptions, ipcMain, nativeTheme, Menu, MenuItem, shell } from "electron";
import * as path from "path";
import * as fs from "fs";
import validator from "validator";
import * as semver from "semver";
import * as remote from "@electron/remote/main";
import * as contextMenu from "electron-context-menu";
import * as logger from "electron-log";
import { UserPrefs } from "../common/UserPrefs";
import { Save, NotebookItem, Notebook, Section, Page } from "../common/NotebookItems";
import { serialize, deserialize } from "bson";

// #region Global variables 

const currentVersion = "2.0.0";
let mainWindow: BrowserWindow = null;
let iconPath = "";

const persistentDataPath = app.getPath("userData");
const prefsPath = persistentDataPath + "\\prefs.json";

let prefs: UserPrefs = null;
let save: Save = null;
const idMap = new Map<string, NotebookItem>();

// #endregion


// #region Electron configuration 

// This makes sure we get a non-cached verison of the "latestversion.txt" file for the update check
app.commandLine.appendSwitch("disable-http-cache");

if (!app.requestSingleInstanceLock()) {
    // FORCE SINGLE INSTANCE
    app.quit();
}
else {
    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.on("ready", start);

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
            start();
        }
    });

    app.on("quit", () => {
        logger.log("Exiting application\n\n");
    });
}

// #endregion


function start() {

    /*
        TODO
        just load the save like normal, assume its current
        they can go to the menu and select "load old save" and 1 function will convert everything
    */

    logger.info("Starting application");

    // Load prefs
    if (fs.existsSync(prefsPath)) {
        try {
            const obj = JSON.parse(fs.readFileSync(prefsPath, "utf-8"));
            prefs = UserPrefs.fromObject(obj);

            // Check for old "dataDir" setting from pre-2.0
            if (obj["dataDir"] != undefined) {

                // TODO show a popup that they need to go into the menu and choose "Load old save from pre-2.0"
                prefs.saveFilePath = persistentDataPath + "\\save.bson";

                logger.info(`Converted old dataDir setting to saveFilePath (${prefs.saveFilePath})`);

                writePrefsToDisk();
            }
            logger.info("Loaded prefs.json successfully");
        }
        catch (error) {
            die("prefs.json could not be parsed.", `File located at: ${prefsPath} - Error message: '${error}'`);
        }
    }
    else {
        prefs = new UserPrefs();
        prefs.saveFilePath = persistentDataPath + "\\save.bson";

        writePrefsToDisk();

        logger.info(`Preferences file (${prefsPath}) was not found, created a new one (with the default save dir: ${prefs.saveFilePath})`);
    }


    // Load save file

    if (fs.existsSync(prefs.saveFilePath)) {
        try {
            const obj = JSON.parse(fs.readFileSync(prefs.saveFilePath, "utf-8"));
    
            save = Save.fromObject(obj);
            logger.info("Loaded save file successfully");
    
            // Load all NotebookItems into the id-to-object map
            processSaveIntoMap();
        }
        catch (error) {
            die("Save file could not be parsed.", `File located at: ${prefs.saveFilePath} - Error message: '${error}'`);
        }

    }
    else {
        save = new Save();

        writeSaveToDisk();

        logger.info(`Save file at ${prefs.saveFilePath} was not found, creating a new one`);
    }

    // Create userStyles.css if it's not there
    if (!fs.existsSync(persistentDataPath + "\\userStyles.css")) {
        fs.writeFileSync(persistentDataPath + "\\userStyles.css", 
            "/*\n    Enter custom CSS rules for Codex in this file.\n    Use Inspect Element in the DevTools (Ctrl-Shift-I) in Codex to find id's and classes.\n*/", 
            "utf-8");
    }


    // Create window
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
    // use the custom titlebar
    remote.enable(mainWindow.webContents);
    remote.initialize();

    mainWindow.loadFile("html/index.html");

    contextMenu({
        showSearchWithGoogle: false,
        showLookUpSelection: false
    });

    //Menu.setApplicationMenu(normalMenu);

    mainWindow.webContents.once("dom-ready", () => {

        mainWindow.show();
        //checkForUpdates();

    });

    mainWindow.on("close", (e) => {
        e.preventDefault();
        mainWindow.webContents.send("onClose");
    });

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();
}


// #region Utility functions 


function writeSaveToDisk() {

    try {
        fs.writeFileSync(prefs.saveFilePath, JSON.stringify(save, null, 4), "utf-8");

        logger.info(`Save file written to disk (${prefs.saveFilePath})`);
    }
    catch (error) {
        // TODO error popup
        logger.error(`Error writing save to disk (${prefs.saveFilePath}): ${error}`);
    }
}

function writePrefsToDisk() {
    try {
        fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 4), "utf-8");

        logger.info(`Preferences file written to disk (${prefsPath})`);
    }
    catch (error) {
        // TODO error popup
        logger.error(`Error writing prefs to disk (${prefsPath}): ${error}`);
    }
}

function processSaveIntoMap() {

    function recurseAdd(item: NotebookItem) {
        idMap.set(item.id, item);

        if (item instanceof Notebook || item instanceof Section) {
            item.children.forEach(child => {
                recurseAdd(child);
            });
        }
    }

    idMap.clear();

    save.notebooks.forEach(nb => {
        recurseAdd(nb);
    });

}

function die(message: string, detail: string) {

    logger.error(`Error while loading prefs/save data - ${message} - ${detail}`);

    if (mainWindow != null)
        mainWindow.destroy();
    
    const options: MessageBoxOptions = {
        type: "error",
        buttons: ["Ok"],
        defaultId: 0,
        cancelId: 0,
        title: "Error while loading prefs/save data",
        message: message,
        detail: detail,
    };
    dialog.showMessageBoxSync(mainWindow, options);

    logger.log("Exiting application\n\n");
    app.exit(1);
}

// #endregion


// #region API functions for altering/reading the save

ipcMain.on("nbi:getFullSave", (event) => {
    event.returnValue = save;
});

ipcMain.on("nbi:get", (event, id: string) => {
    event.returnValue = idMap.get(id);
});

ipcMain.on("nbi:create", (event, data: {
    parentId: string,
    obj: NotebookItem
}) => {
    

    try {
        if (data.obj instanceof Notebook) {
            const nb = Notebook.fromObject(data.obj);
    
            save.notebooks.push(nb);
            idMap.set(nb.id, nb);

            event.returnValue = 0;
        }
        else if (data.obj instanceof Section) {
            
            if (idMap.has(data.parentId)) {
                const section = Section.fromObject(data.obj);
    
                const parent = idMap.get(data.parentId);
                if (parent instanceof Notebook || parent instanceof Section) {
                    parent.children.push(section);
                    idMap.set(section.id, section);

                    event.returnValue = 0;
                }
            }
            else {
                event.returnValue = 1;
            }
    
        }
        else if (data.obj instanceof Page) {
    
            if (idMap.has(data.parentId)) {
                const page = Page.fromObject(data.obj);
    
                const parent = idMap.get(data.parentId);
                if (parent instanceof Notebook || parent instanceof Section) {
                    parent.children.push(page);
                    idMap.set(page.id, page);

                    event.returnValue = 0;
                }
            }
            else {
                event.returnValue = 1;
            }
    
        }
    }
    catch (error) {
        event.returnValue = 1;
        logger.error(`Error while trying to create a NotebookItem with name '${data.obj.name}': ${error}`);
    }
});

ipcMain.on("nbi:update", (event, data: {
    obj: NotebookItem
}) => {

    if (idMap.has(data.obj.id)) {
        const item = idMap.get(data.obj.id);

        Object.assign(item, data.obj);

        event.returnValue = 0;
    }
    else
        event.returnValue = 1;

});

ipcMain.on("nbi:delete", (event, data: {
    id: string
}) => {

    if (idMap.has(data.id)) {

        try {
            const item = idMap.get(data.id);

            if (item instanceof Notebook) {
                save.notebooks.splice(save.notebooks.indexOf(item), 1);
                idMap.delete(item.id);
            }
            else if (item instanceof Section || item instanceof Page) {
                const parent = idMap.get(item.parentId) as (Notebook | Section);

                parent.children.splice(parent.children.indexOf(item), 1);
                idMap.delete(item.id);
            }
        }
        catch (error) {
            event.returnValue = 1;
            logger.error(`Error while trying to delete a NotebookItem with ID '${data.id}': ${error}`);
        }
    }
    else
        event.returnValue = 1;

});

// #endregion