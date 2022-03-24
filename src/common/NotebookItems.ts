import { v4 as uuid } from "uuid";

export abstract class NotebookItem {

    id = "";
    name = "";
    icon = "";
    color = "#000000";

    constructor(name: string) {
        this.name = name;
        this.id = uuid();
    }

    getAllPages(): Page[] {

        const list: Page[] = [];

        function recurseAdd(item: NotebookItem) {
            if (item instanceof Notebook || item instanceof Section) {
                item.children.forEach(child => {
                    recurseAdd(child);
                });
            }
            else if (item instanceof Page) {
                list.push(item);
            }
        }

        if (this instanceof Notebook || this instanceof Section) {
            this.children.forEach(child => {
                recurseAdd(child);
            });
        }

        return list;
    }
}

export class Notebook extends NotebookItem {

    children: (Section | Page)[] = [];
    expanded = false;

    constructor(name: string) {
        super(name);
        this.icon = "notebook";
    }

    static fromObject(obj: any): Notebook {
        const inst = new Notebook("");

        Object.assign(inst, obj);

        inst.children = [];
        obj["children"].forEach((child: any) => {

            if (child["doc"] !== undefined) {
                // child is a page

                const page = Page.fromObject(child);
                inst.children.push(page);
            }
            else {
                //child is a section

                const section = Section.fromObject(child);
                inst.children.push(section);
            }

        });

        return inst;
    }
}

export class Section extends NotebookItem {

    expanded = false;
    children: (Section | Page)[] = [];
    parentId: string;

    constructor(name: string) {
        super(name);
        this.icon = "folder";
    }

    static fromObject(obj: any): Section {
        const inst = new Section("");

        Object.assign(inst, obj);

        inst.children = [];
        obj["children"].forEach((child: any) => {

            if (child["doc"] !== undefined) {
                // child is a page

                const page = Page.fromObject(child);
                inst.children.push(page);
            }
            else {
                //child is a section

                const section = Section.fromObject(child);
                inst.children.push(section);
            }

        });

        return inst;
    }
}

export class Page extends NotebookItem {

    parentId: string;
    favorite = false;
    doc: { [key: string]: any; } = {"type":"doc","content":[{"type":"paragraph"}]};

    constructor(name: string) {
        super(name);
        this.icon = "file-text";
    }

    static fromObject(obj: any): Page {
        const inst = new Page("");

        Object.assign(inst, obj);

        return inst;
    }
}

export class Save {

    version = "2.0.0";
    notebooks: Notebook[] = [];

    static fromObject(obj: any): Save {
        const inst = new Save();

        obj["notebooks"].forEach((child: any) => {

            const notebook = Notebook.fromObject(child);
            inst.notebooks.push(notebook);

        });

        return inst;
    }
}