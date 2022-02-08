import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import * as fs from "fs";
import * as remote from "@electron/remote";
import {Titlebar, Color} from "@treverix/custom-electron-titlebar";
import * as hljs from "highlight.js";
import { deserialize } from "typescript-json-serializer";
import { UserPrefs } from "../common/UserPrefs";
import { Save } from "../common/Save";
import { NotebookItem, NotebookItemType } from "../common/NotebookItem";

let save: Save = null;
let prefs: UserPrefs = null;

const defaultSaveLocation = ipcRenderer.sendSync("defaultDataDir");
let saveLocation = "";

if (!fs.existsSync(defaultSaveLocation + "/saveLocation.txt")) {
    saveLocation = defaultSaveLocation;
    fs.writeFileSync(defaultSaveLocation + "/saveLocation.txt", defaultSaveLocation, "utf-8");
}
else {
    saveLocation = fs.readFileSync(defaultSaveLocation + "/saveLocation.txt", "utf-8").toString();
}

export type MainAPI = {
	ipcHandle(channel: string, listener: (event: any, ...args: any[]) => void): void,
    ipcSend(channel: string, ...args: any[]): void,
    ipcSendSync(channel: string, ...args: any[]): any,
    defaultSaveLocation(): string,
    getPrefs(): UserPrefs
    savePrefs(prefsObj: UserPrefs): void,
    getSave(): Save,
    saveData(saveObj: Save): void,
    loadPageData(fileName: string): string,
    savePageData(fileName: string, docObject: { [key: string]: any } ): void,
}

const api: MainAPI = {
	ipcHandle: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
        ipcRenderer.on(channel, listener);
    },

    ipcSend: (channel: string, ...args: any[]): void => {
        ipcRenderer.send(channel, args);
    },

    ipcSendSync: (channel: string, ...args: any[]): any => {
        return ipcRenderer.sendSync(channel, args);
    },

    defaultSaveLocation: (): string => {
        return defaultSaveLocation;
    },

    getPrefs: (): UserPrefs => {
        return prefs;
    },

    savePrefs: (prefsObj: UserPrefs): void => {
        prefs = prefsObj;
        fs.writeFileSync(defaultSaveLocation + "/prefs.json", JSON.stringify(prefs), "utf-8");
    },

    getSave: (): Save => {
        return save;
    },

    saveData: (saveObj: Save): void => {
        save = saveObj;
        fs.writeFileSync(saveLocation + "/save.json", JSON.stringify(save), "utf-8");
    },

    loadPageData: (fileName: string): string => {
        if (!fileName.includes("/") && !fileName.includes("\\")) {
            if (fs.existsSync(saveLocation + "/notes/" + fileName)) {
                return fs.readFileSync(saveLocation + "/notes/" + fileName, "utf-8").toString();
            }
        }
        return "";
    },

    savePageData: (fileName: string, docObject: { [key: string]: any }): void => {
        if (!fileName.includes("/") && !fileName.includes("\\")) {
            fs.writeFileSync(saveLocation + "/notes/" + fileName, JSON.stringify(docObject), "utf-8");
        }
    }
};

// LOAD PREFS

if (fs.existsSync(defaultSaveLocation + "/prefs.json")) {
    try {
        const json = fs.readFileSync(defaultSaveLocation + "/prefs.json", "utf-8").toString();
        prefs = JSON.parse(json);

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
            prefs.dataDir = defaultSaveLocation;

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
    catch (ex) {
        console.error(ex);
        //errorPopup("Your prefs.json file could not be parsed.", "Check the developer console for more information");
    }
}
else {
    prefs = new UserPrefs();
    prefs.dataDir = defaultSaveLocation;
    api.savePrefs(prefs);
}
// LOAD SAVE

if (fs.existsSync(saveLocation + "/save.json")) {
    const json = fs.readFileSync(saveLocation + "/save.json", "utf-8").toString();

    // Check for old save from before 2.0.0
    const testObject = JSON.parse(json);
    if (testObject["version"] === undefined) {
        try {
            save = convertOldSave(testObject);
        }
        catch (ex) {
            console.error(ex);
            //errorPopup("Could not convert old save.json to new format.", "Check the developer console for more information and report this to the GitHub Issues page. If nothing else works, you can rename your save.json to something else, reopen Codex, recreate your notebooks/notes, and edit the new save.json to point those pages to the old files in the /notes/ folder.");
        }
    }
    else {
        try {
            save = deserialize<Save>(json, Save);
        }
        catch (err) {
            console.error(err);
            //errorPopup("Your save file could not be parsed correctly.", "Please make sure your save.json JSON file is intact");
        }
    }

    api.saveData(save);
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
    
    api.saveData(save);
}

if (!fs.existsSync(saveLocation + "/notes/")) {
    fs.mkdirSync(saveLocation + "/notes/");
}

if (!fs.existsSync(defaultSaveLocation + "/userStyles.css")) {
    fs.writeFileSync(defaultSaveLocation + "/userStyles.css", "/*\n    Enter custom CSS rules for Codex in this file.\n    Use Inspect Element in the DevTools (Ctrl-Shift-I) in Codex to find id's and classes.\n*/");
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


contextBridge.exposeInMainWorld("mainAPI", {
	api: api
});

// Initialize custom titlebar and highlight example code
window.addEventListener("DOMContentLoaded", () => {

	// Set up example code block in Settings page and highlight it
    document.getElementById("exampleCode").innerHTML = "//EXAMPLE CODE BLOCK\n#include &lt;iostream&gt;\n\nint main(int argc, char *argv[]) {\n\tfor (auto i = 0; i &lt; 0xFFFF; i++)\n\t\tcout &lt;&lt; \"Hello, World!\" &lt;&lt; endl;\n\treturn -2e3 + 12l;\n}";
    document.getElementById("exampleCode").innerHTML = hljs.highlight(document.getElementById("exampleCode").innerText, {language: "cpp", ignoreIllegals: false}).value;

    if (process.platform === "win32") {
        const titlebar = new Titlebar({
            backgroundColor: Color.fromHex("#343A40"),
                unfocusEffect: true,
                icon: "../assets/icons/icon.ico"
        });

		ipcRenderer.on("updateMenubar", () => {
			titlebar.updateMenu(remote.Menu.getApplicationMenu());
		});

        document.getElementById("editorRibbon").style.marginTop = "40px";

        if (process.platform !== "win32") {
            document.documentElement.style.setProperty("--titlebar-height", "0px");
        }
    }
});