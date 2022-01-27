import crel from "crelt";
import {Plugin} from "prosemirror-state";

import {renderGrouped} from "prosemirror-menu";

const prefix = "ProseMirror-menubar";

function isIOS() {
    if (typeof navigator == "undefined") return false;
    const agent = navigator.userAgent;
    return !/Edge\/\d/.test(agent) && /AppleWebKit/.test(agent) && /Mobile\/\w+/.test(agent);
}

// :: (Object) → Plugin
// A plugin that will place a menu bar above the editor. Note that
// this involves wrapping the editor in an additional `<div>`.
//
//   options::-
//   Supports the following options:
//
//     content:: [[MenuElement]]
//     Provides the content of the menu, as a nested array to be
//     passed to `renderGrouped`.
//
//     floating:: ?bool
//     Determines whether the menu floats, i.e. whether it sticks to
//     the top of the viewport when the editor is partially scrolled
//     out of view.
export function menuBar(options) {
    return new Plugin({
        view(editorView) { return new MenuBarView(editorView, options); }
    });
}

class MenuBarView {
    constructor(editorView, options) {
        this.editorView = editorView;
        this.options = options;

        const object = document.createElement("span");
        this.wrapper = document.getElementById("editorRibbon").appendChild(object);
        this.menu = this.wrapper.appendChild(crel("div", {class: prefix}));
        this.menu.className = prefix;
        this.spacer = null;

        this.maxHeight = 0;
        this.widthForMaxHeight = 0;
        this.floating = false;

        const {dom, update} = renderGrouped(this.editorView, this.options.content);
        this.contentUpdate = update;
        this.menu.appendChild(dom);
        this.update();

        if (options.floating && !isIOS()) {
            this.updateFloat();
            const potentialScrollers = getAllWrapping(this.wrapper);
            this.scrollFunc = (e) => {
                const root = this.editorView.root;
                if (!(root.body || root).contains(this.wrapper)) {
                    potentialScrollers.forEach(el => el.removeEventListener("scroll", this.scrollFunc));
                } else {
                    this.updateFloat(e.target.getBoundingClientRect && e.target);
                }
            };
            potentialScrollers.forEach(el => el.addEventListener("scroll", this.scrollFunc));
        }
    }

    update() {
        this.contentUpdate(this.editorView.state);

        if (this.floating) {
            this.updateScrollCursor();
        } else {
            if (this.menu.offsetWidth != this.widthForMaxHeight) {
                this.widthForMaxHeight = this.menu.offsetWidth;
                this.maxHeight = 0;
            }
            if (this.menu.offsetHeight > this.maxHeight) {
                this.maxHeight = this.menu.offsetHeight;
                this.menu.style.minHeight = this.maxHeight + "px";
            }
        }
    }

    updateScrollCursor() {
        const selection = this.editorView.root.getSelection();
        if (!selection.focusNode) return;
        const rects = selection.getRangeAt(0).getClientRects();
        const selRect = rects[selectionIsInverted(selection) ? 0 : rects.length - 1];
        if (!selRect) return;
        const menuRect = this.menu.getBoundingClientRect();
        if (selRect.top < menuRect.bottom && selRect.bottom > menuRect.top) {
            const scrollable = findWrappingScrollable(this.wrapper);
            if (scrollable) scrollable.scrollTop -= (menuRect.bottom - selRect.top);
        }
    }

    updateFloat(scrollAncestor) {
        const parent = this.wrapper, editorRect = parent.getBoundingClientRect(),
            top = scrollAncestor ? Math.max(0, scrollAncestor.getBoundingClientRect().top) : 0;

        if (this.floating) {
            if (editorRect.top >= top || editorRect.bottom < this.menu.offsetHeight + 10) {
                this.floating = false;
                this.menu.style.position = this.menu.style.left = this.menu.style.top = this.menu.style.width = "";
                this.menu.style.display = "";
                this.spacer.parentNode.removeChild(this.spacer);
                this.spacer = null;
            } else {
                const border = (parent.offsetWidth - parent.clientWidth) / 2;
                this.menu.style.left = (editorRect.left + border) + "px";
                this.menu.style.display = (editorRect.top > window.innerHeight ? "none" : "");
                if (scrollAncestor) this.menu.style.top = top + "px";
            }
        } else {
            if (editorRect.top < top && editorRect.bottom >= this.menu.offsetHeight + 10) {
                this.floating = true;
                const menuRect = this.menu.getBoundingClientRect();
                this.menu.style.left = menuRect.left + "px";
                this.menu.style.width = menuRect.width + "px";
                if (scrollAncestor) this.menu.style.top = top + "px";
                this.menu.style.position = "fixed";
                this.spacer = crel("div", {class: prefix + "-spacer", style: `height: ${menuRect.height}px`});
                parent.insertBefore(this.spacer, this.menu);
            }
        }
    }

    destroy() {
        if (this.wrapper.parentNode)
            this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper);
    }
}

// Not precise, but close enough
function selectionIsInverted(selection) {
    if (selection.anchorNode == selection.focusNode) return selection.anchorOffset > selection.focusOffset;
    return selection.anchorNode.compareDocumentPosition(selection.focusNode) == Node.DOCUMENT_POSITION_FOLLOWING;
}

function findWrappingScrollable(node) {
    for (let cur = node.parentNode; cur; cur = cur.parentNode)
        if (cur.scrollHeight > cur.clientHeight) return cur;
}

function getAllWrapping(node) {
    const res = [window];
    for (let cur = node.parentNode; cur; cur = cur.parentNode)
        res.push(cur);
    return res;
}
