import { Schema } from "prosemirror-model";
import { addListNodes } from "prosemirror-schema-list";
import { tableNodes } from "prosemirror-tables";

const pDOM = ["p", 0], blockquoteDOM = ["blockquote", 0], hrDOM = ["hr"],
    preDOM = ["pre", ["code", 0]], brDOM = ["br"];
const olDOM = ["ol", 0], ulDOM = ["ul", 0], liDOM = ["li", 0];


const nodes = {

    doc: {
        content: "block+"
    },

    paragraph: {
        content: "inline*",
        group: "block",
        attrs: {
            class: {
                default: "pm-align--left"
            }
        },
        toDOM(node) {
            return ["p", { class: node.attrs.class }, 0];
        },
        parseDOM: [{
            tag: "p",
            getAttrs: node => {
                return {
                    textAlign: node.attributes
                        ? node.attributes.class
                        : node.attrs.class
                };
            }
        }]
    },

    blockquote: {
        content: "block+",
        group: "block",
        defining: true,
        parseDOM: [{ tag: "blockquote" }],
        toDOM: function toDOM() {
            return blockquoteDOM;
        }
    },

    horizontal_rule: {
        group: "block",
        parseDOM: [{ tag: "hr" }],
        toDOM: function toDOM() {
            return hrDOM;
        }
    },

    heading: {
        attrs: {
            level: { default: 1 },
            class: {
                default: "pm-align--left"
            }
        },
        content: "inline*",
        group: "block",
        defining: true,
        parseDOM: [{
            tag: "h1", getAttrs: node => {
                return { level: 1, textAlign: node.attributes ? node.attributes.class : node.attrs.class };
            }
        },
        {
            tag: "h2", getAttrs: node => {
                return { level: 2, textAlign: node.attributes ? node.attributes.class : node.attrs.class };
            }
        },
        {
            tag: "h3", getAttrs: node => {
                return { level: 3, textAlign: node.attributes ? node.attributes.class : node.attrs.class };
            }
        },
        {
            tag: "h4", getAttrs: node => {
                return { level: 4, textAlign: node.attributes ? node.attributes.class : node.attrs.class };
            }
        },
        {
            tag: "h5", getAttrs: node => {
                return { level: 5, textAlign: node.attributes ? node.attributes.class : node.attrs.class };
            }
        },
        {
            tag: "h6", getAttrs: node => {
                return { level: 6, textAlign: node.attributes ? node.attributes.class : node.attrs.class };
            }
        }],
        toDOM: function toDOM(node) {
            return ["h" + node.attrs.level, { class: node.attrs.class }, 0];
        }
    },

    code_block: {
        content: "text*",
        marks: "",
        group: "block",
        code: true,
        defining: true,
        attrs: { params: { default: "" }, collapsed: { default: false } },


        parseDOM: [{
            tag: "div", preserveWhitespace: "full", getAttrs: function (node) {
                return (
                    { params: node.getAttribute("data-params") || "" }
                );
            }
        }],
        toDOM: function toDOM(node) {
            return ["div", {
                "class": "codeSnippet hljs language-" + node.attrs.params + (node.attrs.collapsed ? " collapsed" : ""),
                "data-params": node.attrs.params,
                "spellcheck": "false"
            }, ["span", {
                "class": "snippetCollapser",
                "title": "Collapse"
            }, (node.attrs.collapsed ? "∨" : "∧")], ["div", 0]];
        }
    },

    text: {
        group: "inline"
    },

    image: {
        inline: true,
        attrs: {
            src: {},
            alt: { default: null },
            title: { default: null }
        },
        group: "inline",
        draggable: true,
        parseDOM: [{
            tag: "img[src]", getAttrs: function getAttrs(dom) {
                return {
                    src: dom.getAttribute("src"),
                    title: dom.getAttribute("title"),
                    alt: dom.getAttribute("alt")
                };
            }
        }],
        toDOM: function toDOM(node) {
            const ref = node.attrs;
            const src = ref.src;
            const alt = ref.alt;
            const title = ref.title;
            return ["img", { src: src, alt: alt, title: title }];
        }
    },

    hard_break: {
        inline: true,
        group: "inline",
        selectable: false,
        parseDOM: [{ tag: "br" }],
        toDOM: function toDOM() {
            return brDOM;
        }
    },

    math_inline: {
        group: "inline math",
        content: "text*",
        inline: true,
        atom: true,
        toDOM: () => ["math-inline", { class: "math-node" }, 0],
        parseDOM: [{
            tag: "math-inline"
        }]
    },

    math_display: {
        group: "block math",
        content: "text*",
        atom: true,
        code: true,
        toDOM: () => ["math-display", { class: "math-node" }, 0],
        parseDOM: [{
            tag: "math-display"
        }]
    },

    /*table: {
        content: "table_row+",
        tableRole: "table",
        isolating: true,
        group: "block",
        parseDOM: [{ tag: "table" }],
        toDOM() { return ["table", ["tbody", 0]]; }
    },
    table_row: {
        content: "(table_cell | table_header)*",
        tableRole: "row",
        parseDOM: [{ tag: "tr" }],
        toDOM() { return ["tr", 0]; }
    },
    table_cell: {
        content: "paragraph+",
        tableRole: "cell",
        isolating: true,
        parseDOM: [{ tag: "td", getAttrs: dom => getCellAttrs(dom) }],
        toDOM(node) { return ["td", setCellAttrs(node), 0]; }
    },
    table_header: {
        content: "paragraph+",
        tableRole: "header_cell",
        isolating: true,
        parseDOM: [{ tag: "th", getAttrs: dom => getCellAttrs(dom) }],
        toDOM(node) { return ["th", setCellAttrs(node), 0]; }
    },

    orderedList: {
        content: "list_item+",
        group: "block",
        attrs: { order: { default: 1 } },
        parseDOM: [{
            tag: "ol", getAttrs(dom) {
                return { order: dom.hasAttribute("start") ? +dom.getAttribute("start") : 1 };
            }
        }],
        toDOM(node) {
            return node.attrs.order == 1 ? olDOM : ["ol", { start: node.attrs.order }, 0];
        }
    },

    bulletList: {
        content: "list_item+",
        group: "block",
        parseDOM: [{ tag: "ul" }],
        toDOM() { return ulDOM; }
    },

    listItem: {
        content: "paragraph block*",
        parseDOM: [{ tag: "li" }],
        toDOM() { return liDOM; },
        defining: true
    }*/

};

const emDOM = ["em", 0], strongDOM = ["strong", 0], codeDOM = ["code", 0], uDOM = ["u", 0];

const marks = {

    link: {
        attrs: {
            href: {},
            title: { default: null }
        },
        inclusive: false,
        parseDOM: [{
            tag: "a[href]", getAttrs: function getAttrs(dom) {
                return { href: dom.getAttribute("href"), title: dom.getAttribute("title") };
            }
        }],
        toDOM: function toDOM(node) {
            const ref = node.attrs;
            const href = ref.href;
            const title = ref.title;
            return ["a", { href: href, title: title }, 0];
        }
    },

    em: {
        parseDOM: [{ tag: "i" }, { tag: "em" }, { style: "font-style=italic" }],
        toDOM: function toDOM() {
            return emDOM;
        }
    },

    strong: {
        parseDOM: [
            { tag: "strong" },
            {
                tag: "b", getAttrs: function (node) {
                    return node.style.fontWeight !== "normal" && null;
                }
            },
            {
                style: "font-weight", getAttrs: function (value) {
                    return /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null;
                }
            }],
        toDOM: function toDOM() {
            return strongDOM;
        }
    },

    underline: {
        parseDOM: [{ tag: "u" }],
        toDOM: function toDOM() {
            return uDOM;
        }
    },

    code: {
        parseDOM: [{ tag: "span" }],
        toDOM: function toDOM() {
            return ["span", { "class": "hljs inline-code", "spellcheck": "false" }];
        }
    }

};


const _schema = new Schema({ nodes: nodes, marks: marks });

export const schema = new Schema({
    nodes: addListNodes(_schema.spec.nodes, "paragraph block*", "block").append(tableNodes({
        tableGroup: "block",
        cellContent: "paragraph+",
        cellAttributes: {
            background: {
                default: null,
                getFromDOM(dom) { return dom.style.backgroundColor || null; },
                setDOMAttr(value, attrs) { if (value) attrs.style = (attrs.style || "") + `background-color: ${value};`; }
            }
        }
    })),
    marks: _schema.spec.marks
});