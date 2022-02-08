import { Serializable, JsonProperty } from "typescript-json-serializer";
import { v4 as GenerateUUID } from "uuid";

export enum NotebookItemType {
    NOTEBOOK,
    SECTION,
    PAGE
}

@Serializable()
export class NotebookItem {

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

    static getParent(notebookList: NotebookItem[], item: NotebookItem): NotebookItem {

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

        notebookList.forEach(nb => {
            if (done === false)
                recurseSearch(nb);
        });

        return parent;
    }
}