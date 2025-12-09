import { Button } from '@/components/ui/button';
import { Color } from '@tiptap/extension-color';
import { Heading } from '@tiptap/extension-heading';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function RichTextEditorTiptap({
    value,
    onChange,
    title,
    authorName,
    availableUsers,
}: {
    value?: string;
    onChange?: (html: string) => void;
    title?: string;
    authorName?: string;
    availableUsers?: Array<{ id: number; name: string }>;
}) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [showColorPicker, setShowColorPicker] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                hardBreak: {
                    keepMarks: true,
                },
            }),
            TextStyle,
            Color.configure({
                types: ['textStyle'],
            }),
            Heading.configure({
                levels: [1, 2, 3, 4],
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            if (onChange) onChange(html);
        },
        editorProps: {
            attributes: {
                class: 'prose max-w-none focus:outline-none min-h-[120px] p-3',
            },
            handleKeyDown: (view, event) => {
                // Enterキーで改行（<br>）を挿入
                if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    const { state } = view;
                    const { selection } = state;
                    const { $from } = selection;

                    // 見出しやリスト内では通常の挙動を維持
                    if ($from.parent.type.name === 'heading' || $from.parent.type.name === 'listItem') {
                        return false;
                    }

                    // 段落内でEnterを押したら<br>を挿入して新しい段落を作らない
                    if ($from.parent.type.name === 'paragraph') {
                        event.preventDefault();
                        const { tr } = state;
                        const hardBreak = state.schema.nodes.hardBreak.create();
                        const newTr = tr.replaceSelectionWith(hardBreak, false);
                        view.dispatch(newTr.scrollIntoView());
                        return true;
                    }
                }
                return false;
            },
        },
    });

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '');
        }
    }, [value, editor]);

    const togglePreview = () => {
        if (previewOpen) {
            setPreviewOpen(false);
            return;
        }
        const html = editor?.getHTML() || value || '';

        // transform html for preview: convert plain-text #tags into span.hashtag while preserving existing HTML and mention spans
        const transformHtmlForPreview = (rawHtml: string) => {
            const container = document.createElement('div');
            container.innerHTML = rawHtml || '';
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
            const nodes: Node[] = [];
            let n: Node | null = walker.nextNode();
            while (n) {
                nodes.push(n);
                n = walker.nextNode();
            }
            nodes.forEach((tn) => {
                const v = tn.nodeValue || '';
                if (!v) return;
                if (/#([^\s#@]+)|@([^\s@#]+)/.test(v)) {
                    const frag = document.createDocumentFragment();
                    let lastIndex = 0;
                    const re = /(#([^\s#@]+))|(@([^\s@#]+))/g;
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(v))) {
                        const before = v.slice(lastIndex, m.index);
                        if (before) frag.appendChild(document.createTextNode(before));
                        if (m[1]) {
                            const span = document.createElement('span');
                            span.className = 'hashtag';
                            span.textContent = m[1];
                            frag.appendChild(span);
                        } else if (m[3]) {
                            const span = document.createElement('span');
                            span.className = 'mention';
                            span.textContent = m[3];
                            frag.appendChild(span);
                        }
                        lastIndex = re.lastIndex;
                    }
                    const rest = v.slice(lastIndex);
                    if (rest) frag.appendChild(document.createTextNode(rest));
                    tn.parentNode?.replaceChild(frag, tn);
                }
            });
            return container.innerHTML;
        };

        const transformed = transformHtmlForPreview(html);

        const doc = `<!doctype html>
        <html lang="ja">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>${(title || '投稿').replace(/</g, '&lt;')}</title>
            <style>
                body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; padding:20px; color:#111}
                .post-header{border-bottom:1px solid #e5e7eb; padding-bottom:12px; margin-bottom:16px}
                .post-title{font-size:22px; font-weight:700; margin:0 0 6px}
                .post-meta{font-size:13px; color:#6b7280}
                .post-body{max-width:900px; margin-top:16px}
                .hashtag{display:inline-block; background:#fff7ed; color:#c2410c; padding:2px 6px; border-radius:9999px; font-size:0.9em; margin:0 2px}
                .mention{display:inline-block; background:#eff6ff; color:#1e40af; padding:2px 6px; border-radius:9999px; font-size:0.9em; margin:0 2px}
                .post-body em, .post-body i {
                    font-style: italic;
                    color: #0f172a;
                    background: #f8fafc;
                    padding: 0 3px;
                    border-radius: 3px;
                }
                .post-body table{width:100%; border-collapse:collapse; margin:8px 0}
                .post-body th, .post-body td{border:1px solid #d1d5db; padding:8px; text-align:left}
                .post-body h1{font-size:20px}
                .post-body h2{font-size:18px}
                .post-body h3{font-size:16px}
                .post-body h4{font-size:15px}
                ul{padding-left:1.25rem}
            </style>
        </head>
        <body>
            <article>
                <header class="post-header">
                    <h1 class="post-title">${(title || '').replace(/</g, '&lt;')}</h1>
                    <div class="post-meta">by ${(authorName || '匿名').replace(/</g, '&lt;')} • ${new Date().toLocaleString()}</div>
                </header>
                <div class="post-body">${transformed}</div>
            </article>
        </body>
        </html>`;

        setPreviewHtml(doc);
        setPreviewOpen(true);
    };

    const colors = [
        { color: '#000000', label: '黒' },
        { color: '#dc2626', label: '赤' },
        { color: '#ea580c', label: 'オレンジ' },
        { color: '#ca8a04', label: '黄色' },
        { color: '#16a34a', label: '緑' },
        { color: '#0284c7', label: '青' },
        { color: '#7c3aed', label: '紫' },
        { color: '#db2777', label: 'ピンク' },
    ];

    return (
        <div>
            <style>{`
                .ProseMirror {
                    line-height: 1.6 !important;
                }
                .ProseMirror p {
                    margin: 0 !important;
                    line-height: 1.6 !important;
                }
                .ProseMirror p + p {
                    margin-top: 0.5em !important;
                }
                .ProseMirror br {
                    content: "";
                }
                .ProseMirror br::after {
                    content: "\\A";
                    white-space: pre;
                }
                .ProseMirror h1 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0 0.5em 0; }
                .ProseMirror h2 { font-size: 1.3em; font-weight: bold; margin: 0.75em 0 0.5em 0; }
                .ProseMirror h3 { font-size: 1.17em; font-weight: bold; margin: 0.75em 0 0.5em 0; }
                .ProseMirror h4 { font-size: 1em; font-weight: bold; margin: 0.75em 0 0.5em 0; }
                .ProseMirror ul, .ProseMirror ol { padding-left: 1.25rem; margin: 0.5em 0; }
                .ProseMirror table { border-collapse: collapse; width: 100%; margin: 8px 0; }
                .ProseMirror th, .ProseMirror td { border: 1px solid #d1d5db; padding: 8px; }
                .ProseMirror th { background: #f9fafb; font-weight: 600; }
                .rte-preview-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:60; }
                .rte-preview-modal { width: 90%; max-width: 900px; height: 70%; background: white; border-radius: 8px; overflow: hidden; display:flex; flex-direction:column }
                .rte-preview-header { padding: 8px; border-bottom: 1px solid #eee; display:flex; justify-content:space-between; align-items:center }
                .rte-preview-body { flex:1; }
            `}</style>

            {/* Toolbar */}
            {editor && (
                <div className="mb-2 flex flex-wrap items-center gap-1 border-b pb-2">
                    <Button
                        type="button"
                        size="sm"
                        variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'outline'}
                        onClick={() => {
                            const { from, to } = editor.state.selection;
                            if (from === to) return; // 選択範囲がない場合は何もしない
                            editor.chain().focus().toggleHeading({ level: 1 }).run();
                        }}
                    >
                        H1
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
                        onClick={() => {
                            const { from, to } = editor.state.selection;
                            if (from === to) return; // 選択範囲がない場合は何もしない
                            editor.chain().focus().toggleHeading({ level: 2 }).run();
                        }}
                    >
                        H2
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'outline'}
                        onClick={() => {
                            const { from, to } = editor.state.selection;
                            if (from === to) return; // 選択範囲がない場合は何もしない
                            editor.chain().focus().toggleHeading({ level: 3 }).run();
                        }}
                    >
                        H3
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={editor.isActive('bold') ? 'default' : 'outline'}
                        onClick={() => {
                            const { from, to } = editor.state.selection;
                            if (from === to) return; // 選択範囲がない場合は何もしない
                            editor.chain().focus().toggleBold().run();
                        }}
                    >
                        太字
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={editor.isActive('italic') ? 'default' : 'outline'}
                        onClick={() => {
                            const { from, to } = editor.state.selection;
                            if (from === to) return; // 選択範囲がない場合は何もしない
                            editor.chain().focus().toggleItalic().run();
                        }}
                    >
                        斜体
                    </Button>
                    <div className="relative">
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowColorPicker(!showColorPicker)}>
                            <Palette className="h-4 w-4" />
                        </Button>
                        {showColorPicker && (
                            <div className="absolute top-full left-0 z-50 mt-1 rounded border bg-white p-2 shadow-lg">
                                <div className="mb-2 text-xs font-medium">文字色</div>
                                <div className="flex flex-wrap gap-1">
                                    {colors.map((c) => (
                                        <button
                                            key={c.color}
                                            type="button"
                                            className="h-6 w-6 rounded border hover:scale-110"
                                            style={{ backgroundColor: c.color }}
                                            onClick={() => {
                                                const { from, to } = editor.state.selection;
                                                if (from === to) {
                                                    setShowColorPicker(false);
                                                    return; // 選択範囲がない場合は何もしない
                                                }
                                                editor.chain().focus().setColor(c.color).run();
                                                setShowColorPicker(false);
                                            }}
                                            title={c.label}
                                        />
                                    ))}
                                    <button
                                        type="button"
                                        className="h-6 w-6 rounded border bg-white hover:scale-110"
                                        onClick={() => {
                                            const { from, to } = editor.state.selection;
                                            if (from === to) {
                                                setShowColorPicker(false);
                                                return; // 選択範囲がない場合は何もしない
                                            }
                                            editor.chain().focus().unsetColor().run();
                                            setShowColorPicker(false);
                                        }}
                                        title="色をリセット"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant={editor.isActive('bulletList') ? 'default' : 'outline'}
                        onClick={() => {
                            const { from, to } = editor.state.selection;
                            if (from === to) return; // 選択範囲がない場合は何もしない
                            editor.chain().focus().toggleBulletList().run();
                        }}
                    >
                        リスト
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                    >
                        表
                    </Button>
                    {editor.isActive('table') && (
                        <>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => editor.chain().focus().addColumnBefore().run()}
                                title="左に列を追加"
                            >
                                列←
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                title="右に列を追加"
                            >
                                列→
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => editor.chain().focus().deleteColumn().run()}
                                title="列を削除"
                            >
                                列削除
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => editor.chain().focus().addRowBefore().run()}
                                title="上に行を追加"
                            >
                                行↑
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                title="下に行を追加"
                            >
                                行↓
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => editor.chain().focus().deleteRow().run()}
                                title="行を削除"
                            >
                                行削除
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                title="表を削除"
                            >
                                表削除
                            </Button>
                        </>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={togglePreview}>
                        プレビュー
                    </Button>
                </div>
            )}

            {/* Editor */}
            <div className="rounded border">
                <EditorContent editor={editor} />
            </div>

            {previewOpen && (
                <div className="rte-preview-backdrop" role="dialog" aria-modal="true">
                    <div className="rte-preview-modal">
                        <div className="rte-preview-header">
                            <div className="text-sm font-medium">プレビュー</div>
                            <div>
                                <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(false)}>
                                    閉じる
                                </Button>
                            </div>
                        </div>
                        <div className="rte-preview-body">
                            <iframe title="preview" srcDoc={previewHtml} sandbox="allow-same-origin" className="h-full w-full border-0" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
