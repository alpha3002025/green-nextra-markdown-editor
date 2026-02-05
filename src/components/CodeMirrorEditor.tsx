import React, { useCallback, useMemo, forwardRef } from 'react';
import CodeMirror, { ReactCodeMirrorProps, EditorView, Extension, ReactCodeMirrorRef, ViewPlugin, Decoration, DecorationSet, ViewUpdate } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorState, Transaction, Range } from '@codemirror/state';
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
        // Case Toggle (Mod-Shift-U)
        {
            key: "Mod-Shift-u",
            run: (view) => {
                const range = view.state.selection.main;
                if (range.empty) return false;

                const from = range.from;
                const to = range.to;
                const text = view.state.sliceDoc(from, to);
                if (!text) return false;

                const isAllUpper = text === text.toUpperCase();
                const newText = isAllUpper ? text.toLowerCase() : text.toUpperCase();

                view.dispatch({
                    changes: { from, to, insert: newText },
                    selection: { anchor: from, head: from + newText.length }
                });
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
                // history: true, // enabled by default in basicSetup
            }}
        />
    );
});

export default React.memo(CodeMirrorEditor);
