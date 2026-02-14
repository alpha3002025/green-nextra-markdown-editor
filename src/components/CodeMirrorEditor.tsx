import React, { useCallback, useMemo, forwardRef } from 'react';
import CodeMirror, { ReactCodeMirrorProps, EditorView, Extension, ReactCodeMirrorRef, ViewPlugin, Decoration, DecorationSet, ViewUpdate } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorState, Transaction, Range, EditorSelection } from '@codemirror/state';
import { keymap, KeyBinding } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting, indentUnit, syntaxTree } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
    copyLineUp, copyLineDown, moveLineUp, moveLineDown,
    deleteLine, standardKeymap, toggleComment
} from '@codemirror/commands';

// Code Block Background Plugin
const codeBlockBackgroundPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.computeDecorations(update.view);
        }
    }

    computeDecorations(view: EditorView): DecorationSet {
        const widgets: Range<Decoration>[] = [];
        for (const { from, to } of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from, to,
                enter: (node) => {
                    if (node.name === "FencedCode") {
                        const startLine = view.state.doc.lineAt(node.from);
                        const endLine = view.state.doc.lineAt(node.to);

                        for (let i = startLine.number; i <= endLine.number; i++) {
                            const line = view.state.doc.line(i);
                            widgets.push(Decoration.line({
                                class: "cm-codeblock-line"
                            }).range(line.from));
                        }
                    }
                }
            });
        }
        return Decoration.set(widgets);
    }
}, {
    decorations: v => v.decorations
});

interface CodeMirrorEditorProps {
    value: string;
    onChange: (value: string) => void;
    onImageUpload?: (file: File, view?: EditorView) => Promise<void>;
    startLine?: number;
    className?: string;
    style?: React.CSSProperties;
}

// Custom Green Theme Highlighting
const greenHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, color: "#42b883", fontWeight: "800" },
    { tag: tags.heading2, color: "#42b883", fontWeight: "700" },
    { tag: tags.heading3, color: "#42b883", fontWeight: "600" },
    { tag: tags.heading4, color: "#42b883", fontWeight: "600" },
    { tag: tags.heading5, color: "#42b883", fontWeight: "600" },
    { tag: tags.heading6, color: "#42b883", fontWeight: "600" },
    { tag: tags.strong, fontWeight: "bold", color: "#000" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.link, color: "#42b883", textDecoration: "underline" },
    { tag: tags.url, color: "#42b883", textDecoration: "underline" },
    { tag: tags.list, color: "#42b883", fontWeight: "bold" },
    { tag: tags.quote, color: "#6a737d", fontStyle: "italic" },
    // Code Blocks: Text Color Only (Emerald Green Variations), Background only for inline monospace
    { tag: [tags.monospace, tags.string, tags.attributeName, tags.name, tags.propertyName, tags.atom, tags.literal, tags.inserted, tags.deleted, tags.changed], color: "#42b883" }, // Base Green
    { tag: [tags.keyword, tags.typeName, tags.bool, tags.macroName, tags.processingInstruction, tags.namespace], color: "#2E8B57" }, // Keywords
    { tag: [tags.number, tags.className, tags.variableName, tags.function(tags.variableName), tags.labelName, tags.definition(tags.name), tags.special(tags.variableName), tags.local(tags.variableName)], color: "#3CB371" }, // Vars
    { tag: [tags.operator, tags.comment], color: "#888" },
    { tag: [tags.meta, tags.punctuation, tags.bracket], color: "#aaa" } // Lighten punctuation
]);

// Helper for toggling wrapper (Exported to be used by Toolbar if needed, or keeping local logic)
export const toggleWrapper = (view: EditorView, wrapper: string) => {
    const { state, dispatch } = view;
    const { from, to } = state.selection.main;
    const text = state.doc.toString();
    const selectedText = text.slice(from, to);
    const before = text.slice(0, from);
    const after = text.slice(to);

    // 1. Internal Check
    if (selectedText.startsWith(wrapper) && selectedText.endsWith(wrapper) && selectedText.length >= 2 * wrapper.length) {
        dispatch({
            changes: { from, to, insert: selectedText.slice(wrapper.length, -wrapper.length) },
            selection: { anchor: from, head: to - 2 * wrapper.length }
        });
        return true;
    }

    // 2. External Check
    if (before.endsWith(wrapper) && after.startsWith(wrapper)) {
        dispatch({
            changes: [
                { from: from - wrapper.length, to: from, insert: "" },
                { from: to, to: to + wrapper.length, insert: "" }
            ],
            selection: { anchor: from - wrapper.length, head: to - wrapper.length }
        });
        return true;
    }

    // 3. Apply Wrapper
    dispatch({
        changes: { from, to, insert: `${wrapper}${selectedText}${wrapper}` },
        selection: { anchor: from + wrapper.length, head: to + wrapper.length }
    });
    return true;
};

// Insert Text Helper
export const insertTextAtCursor = (view: EditorView, textToInsert: string) => {
    const { state, dispatch } = view;
    const { from, to } = state.selection.main;
    dispatch({
        changes: { from, to, insert: textToInsert },
        selection: { anchor: from + textToInsert.length }
    });
}

const CodeMirrorEditor = forwardRef<ReactCodeMirrorRef, CodeMirrorEditorProps>(({ value, onChange, onImageUpload, className, style }, ref) => {
    // Internal state to isolate editor updates from parent re-renders
    const [localValue, setLocalValue] = React.useState(value);

    // Sync localValue when parent value changes (e.g., file load)
    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Handlers for Paste/Drop
    const eventHandlers = useMemo(() => EditorView.domEventHandlers({
        drop(event, view) {
            if (!onImageUpload) return;
            const file = event.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) {
                event.preventDefault();
                onImageUpload(file, view);
            }
        },
        paste(event, view) {
            if (!onImageUpload) return;
            const items = event.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        if (file) {
                            event.preventDefault();
                            onImageUpload(file, view);
                            return;
                        }
                    }
                }
            }
        },
        mousedown(event, view) {
            // Handle Alt+Click for multi-cursor and Alt+Drag for vertical selection
            if (event.altKey && event.button === 0) {
                event.preventDefault(); // Prevent default text selection

                const startPosCoords = view.posAtCoords({ x: event.clientX, y: event.clientY });
                if (startPosCoords === null) return;

                const startPos = startPosCoords;

                // Initial snapshot of selection before drag starts
                const initialSelection = view.state.selection;

                // TOGGLE LOGIC: Check if we are clicking on an existing cursor
                const ranges = initialSelection.ranges.slice();
                const existingIdx = ranges.findIndex(r => r.head === startPos && r.empty);

                if (existingIdx !== -1) {
                    // Cursor exists here, remove it (if more than one remains)
                    if (ranges.length > 1) {
                        ranges.splice(existingIdx, 1);
                        const newSelection = EditorSelection.create(ranges);
                        view.dispatch({
                            selection: newSelection,
                            userEvent: "select.pointer"
                        });
                        view.focus();
                        return; // Stop here, don't drag if removed
                    }
                }

                // Immediately add a cursor at the clicked position
                // This covers the single click case too
                const newRange = EditorSelection.cursor(startPos);
                const selectionWithClick = initialSelection.addRange(newRange);

                view.dispatch({
                    selection: selectionWithClick,
                    userEvent: "select.pointer"
                });
                view.focus();

                // Calculate column offset for vertical alignment
                const startLineBlock = view.lineBlockAt(startPos);
                const startOff = startPos - startLineBlock.from;
                const startLineNum = view.state.doc.lineAt(startPos).number;

                const onMouseMove = (moveEvent: MouseEvent) => {
                    const currentPos = view.posAtCoords({ x: moveEvent.clientX, y: moveEvent.clientY });
                    if (currentPos === null) return;

                    const endLineNum = view.state.doc.lineAt(currentPos).number;
                    const minLine = Math.min(startLineNum, endLineNum);
                    const maxLine = Math.max(startLineNum, endLineNum);

                    // Start with the selection from BEFORE the drag (to avoid accumulating duplicates incorrectly)
                    // But wait, if we want to "add" to existing multi-cursors, we should use initialSelection.
                    let ranges: any[] = initialSelection.ranges.slice();

                    for (let l = minLine; l <= maxLine; l++) {
                        const line = view.state.doc.line(l);
                        // Vertical column logic: try to use same char offset
                        const pos = Math.min(line.from + startOff, line.to);
                        ranges.push(EditorSelection.cursor(pos));
                    }

                    // Create new selection (merged/sorted)
                    const nextSelection = EditorSelection.create(ranges);

                    view.dispatch({
                        selection: nextSelection,
                        userEvent: "select.pointer"
                    });
                };

                const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            }
        }
    }), [onImageUpload]);

    // Keybindings
    const keyMaps = useMemo<Extension>(() => keymap.of([
        { key: "Mod-b", run: (view) => toggleWrapper(view, "**"), preventDefault: true },
        { key: "Mod-i", run: (view) => toggleWrapper(view, "*"), preventDefault: true },
        { key: "Mod-k", run: (view) => toggleWrapper(view, "~~"), preventDefault: true },
        // Comment
        { key: "Mod-/", run: toggleComment },
        // Line Operations
        { key: "Alt-ArrowUp", run: moveLineUp },
        { key: "Alt-ArrowDown", run: moveLineDown },
        { key: "Shift-Alt-ArrowUp", run: copyLineUp },
        { key: "Shift-Alt-ArrowDown", run: copyLineDown },
        // Header Level Adjustment
        {
            key: "Ctrl-Alt-ArrowRight",
            run: (view) => {
                const { state, dispatch } = view;
                const { from } = state.selection.main;
                const line = state.doc.lineAt(from);
                const text = line.text;
                const match = text.match(/^(#{1,6})\s/);

                if (match) {
                    if (match[1].length < 6) {
                        dispatch({
                            changes: { from: line.from, insert: "#" },
                            selection: { anchor: state.selection.main.anchor + 1, head: state.selection.main.head + 1 }
                        });
                        return true;
                    }
                } else {
                    dispatch({
                        changes: { from: line.from, insert: "# " },
                        selection: { anchor: state.selection.main.anchor + 2, head: state.selection.main.head + 2 }
                    });
                    return true;
                }
                return false;
            },
            preventDefault: true
        },
        {
            key: "Ctrl-Alt-ArrowLeft",
            run: (view) => {
                const { state, dispatch } = view;
                const { from } = state.selection.main;
                const line = state.doc.lineAt(from);
                const text = line.text;
                const match = text.match(/^(#{1,6})\s/);

                if (match) {
                    const level = match[1].length;
                    if (level > 1) {
                        const anchor = Math.max(line.from, state.selection.main.anchor - 1);
                        const head = Math.max(line.from, state.selection.main.head - 1);

                        dispatch({
                            changes: { from: line.from, to: line.from + 1, insert: "" },
                            selection: { anchor, head }
                        });
                        return true;
                    } else {
                        // level 1, remove "# " (2 chars)
                        const anchor = Math.max(line.from, state.selection.main.anchor - 2);
                        const head = Math.max(line.from, state.selection.main.head - 2);

                        dispatch({
                            changes: { from: line.from, to: line.from + 2, insert: "" },
                            selection: { anchor, head }
                        });
                        return true;
                    }
                }
                return false;
            },
            preventDefault: true
        },
        // Case Toggle (Mod-Shift-U)
        {
            key: "Mod-Shift-u",
            run: (view) => {
                const transaction = view.state.changeByRange(range => {
                    if (range.empty) return { range };

                    const text = view.state.sliceDoc(range.from, range.to);
                    if (!text) return { range };

                    const isAllUpper = text === text.toUpperCase();
                    const newText = isAllUpper ? text.toLowerCase() : text.toUpperCase();

                    return {
                        changes: { from: range.from, to: range.to, insert: newText },
                        range: EditorSelection.range(range.from, range.from + newText.length)
                    };
                });

                view.dispatch(transaction);
                return true;
            },
            preventDefault: true
        },
    ]), []);

    const extensions = useMemo(() => [
        indentUnit.of("    "),
        EditorView.inputHandler.of((view, from, to, text) => {
            // Handle Auto-Wrapping for selected text
            if (from !== to && text.length === 1) { // Only if there is a selection and single char input
                const open = text;
                let close = text;

                // Define pairs
                if (open === "(") close = ")";
                else if (open === "[") close = "]";
                else if (open === "{") close = "}";
                else if (open === "<") close = ">";

                // Allow Markdown wrappers
                const wrappers = ['*', '_', '`', '~', '"', "'", '(', '[', '{', '<'];
                if (wrappers.includes(open)) {
                    const selectedText = view.state.sliceDoc(from, to);
                    const transaction = view.state.update({
                        changes: { from, to, insert: `${open}${selectedText}${close}` },
                        selection: { anchor: from + 1, head: to + 1 }, // Keep selection inside
                        annotations: Transaction.userEvent.of("input")
                    });
                    view.dispatch(transaction);
                    return true; // We handled it
                }
            }
            return false;
        }),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(greenHighlightStyle),
        eventHandlers,
        keyMaps,
        EditorView.lineWrapping,
        EditorView.theme({
            "&": { height: "100%", fontSize: "16px", fontFamily: '"Fira Code", "Fira Mono", monospace' },
            ".cm-content": { caretColor: "#42b883", lineHeight: "1.6", padding: "2rem" },
            ".cm-scroller": { fontFamily: '"Fira Code", "Fira Mono", monospace', lineHeight: "1.6", overscrollBehaviorY: "none" },
            "&.cm-focused": { outline: "none" },
            ".cm-codeblock-line": { backgroundColor: "rgba(66, 184, 131, 0.1)" },

            // Search Panel Customization
            ".cm-panels": {
                borderColor: "#eee",
                backgroundColor: "#fff",
                zIndex: "100" // Ensure it sits above other elements
            },
            ".cm-panel.cm-search": {
                padding: "10px 14px",
                backgroundColor: "#fff", // Clean white background
                fontFamily: "inherit",
                boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px"
            },
            ".cm-textfield": {
                border: "1px solid #e1e4e8",
                borderRadius: "6px",
                padding: "6px 10px",
                outline: "none",
                fontSize: "0.9rem",
                transition: "all 0.2s ease",
                minWidth: "200px" // Slightly wider inputs
            },
            ".cm-textfield:focus": {
                borderColor: "#42b883",
                boxShadow: "0 0 0 3px rgba(66, 184, 131, 0.15)"
            },
            ".cm-button": {
                backgroundImage: "none",
                backgroundColor: "#f6f8fa",
                border: "1px solid #d1d5da",
                borderRadius: "6px",
                padding: "5px 12px",
                fontSize: "0.85rem",
                fontWeight: "500",
                color: "#24292e",
                cursor: "pointer",
                transition: "all 0.15s ease",
                textTransform: "none" // Reset any default
            },
            ".cm-button:hover": {
                borderColor: "#42b883",
                color: "#42b883",
                backgroundColor: "#fff"
            },
            ".cm-button:active": {
                backgroundColor: "rgba(66, 184, 131, 0.1)",
                transform: "translateY(1px)"
            },
            // Specific button styles if reachable by name attribute selector (CodeMirror usually names them)
            ".cm-search label": {
                fontSize: "0.85rem",
                marginRight: "8px",
                color: "#586069",
                display: "inline-flex",
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none"
            },
            ".cm-search input[type='checkbox']": {
                marginRight: "6px",
                accentColor: "#42b883",
                cursor: "pointer"
            },
            // Close button (x)
            ".cm-search button[name='close']": {
                backgroundColor: "transparent",
                border: "none",
                fontSize: "1.2rem",
                padding: "0 8px",
                color: "#999",
                cursor: "pointer",
                marginLeft: "auto", // Push to right
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            },
            ".cm-search button[name='close']:hover": {
                color: "#e53e3e",
                backgroundColor: "transparent",
                borderColor: "transparent"
            }
        }),
        codeBlockBackgroundPlugin
    ], [eventHandlers, keyMaps]);

    // Handle internal change
    const handleChange = useCallback((val: string, viewUpdate: ViewUpdate) => {
        setLocalValue(val);
        onChange(val);
    }, [onChange]);

    return (
        <CodeMirror
            ref={ref}
            value={localValue}
            height="100%"
            extensions={extensions}
            onChange={handleChange}
            className={className}
            style={style}
            basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                allowMultipleSelections: true, // Enable multi-cursor support
                // history: true, // enabled by default in basicSetup
            }}
        />
    );
});

export default React.memo(CodeMirrorEditor);
