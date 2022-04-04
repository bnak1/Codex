export class UserPrefs {

    saveFilePath: string;
    theme = 0;
    codeStyle = "atom-one-dark";
    accentColor = "#FF7A27";
    defaultZoom = 1.0;
    defaultMaximized = false;
    pdfBreakOnH1 = false;
    openPDFonExport = true;
    tabSize = 4;
    sidebarWidth = 275;
    showCodeOverlay = true;
    codeWordWrap = false;
    lastUseVersion = "0.0.0";
    showMenuBar = true;

    static fromObject(obj: any): UserPrefs {
        const inst = new UserPrefs();
        
        inst.saveFilePath = obj["saveFilePath"];
        inst.theme = obj["theme"];
        inst.codeStyle = obj["codeStyle"];
        inst.accentColor = obj["accentColor"];
        inst.defaultZoom = obj["defaultZoom"];
        inst.defaultMaximized = obj["defaultMaximized"];
        inst.pdfBreakOnH1 = obj["pdfBreakOnH1"];
        inst.openPDFonExport = obj["openPDFonExport"];
        inst.tabSize = obj["tabSize"];
        inst.sidebarWidth = obj["sidebarWidth"];
        inst.showCodeOverlay = obj["showCodeOverlay"];
        inst.codeWordWrap = obj["codeWordWrap"];
        inst.lastUseVersion = obj["lastUseVersion"];
        inst.showMenuBar = obj["showMenuBar"];

        return inst;
    }
}