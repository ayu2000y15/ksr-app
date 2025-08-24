import { Button } from '@/components/ui/button';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import { useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function RichTextEditor({
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
    const editorRef = useRef<any | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    const editorConfig = {
        toolbar: ['heading', 'bold', 'italic', 'bulletedList', 'insertTable'],
        heading: {
            options: [
                { model: 'paragraph', title: '段落', class: 'ck-heading_paragraph' },
                { model: 'heading1', view: 'h1', title: '見出し 1', class: 'ck-heading_heading1' },
                { model: 'heading2', view: 'h2', title: '見出し 2', class: 'ck-heading_heading2' },
                { model: 'heading3', view: 'h3', title: '見出し 3', class: 'ck-heading_heading3' },
                { model: 'heading4', view: 'h4', title: '見出し 4', class: 'ck-heading_heading4' },
            ],
        },
        language: 'ja',
    };

    const togglePreview = () => {
        if (previewOpen) {
            setPreviewOpen(false);
            return;
        }
        const html = editorRef.current ? editorRef.current.getData() : value || '';
        // transform html for preview: convert plain-text #tags into span.hashtag while preserving existing HTML and mention spans
        const transformHtmlForPreview = (rawHtml: string) => {
            const container = document.createElement('div');
            container.innerHTML = rawHtml || '';
            // collect text nodes to avoid modifying the live walker
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
                // replace #tag and @mention in text nodes
                if (/#([^\s#@]+)|@([^\s@#]+)/.test(v)) {
                    const frag = document.createDocumentFragment();
                    let lastIndex = 0;
                    // alternation: group1 = #tag full without # prefix, group2 = mention name without @
                    const re = /(#([^\s#@]+))|(@([^\s@#]+))/g;
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(v))) {
                        const before = v.slice(lastIndex, m.index);
                        if (before) frag.appendChild(document.createTextNode(before));
                        if (m[1]) {
                            // hashtag matched (m[1] includes the leading #)
                            const span = document.createElement('span');
                            span.className = 'hashtag';
                            span.textContent = m[1];
                            frag.appendChild(span);
                        } else if (m[3]) {
                            // mention matched (m[3] includes the leading @)
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

        // wrap into a post-detail like template
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
                .mention{display:inline-block; background:#eef2ff; color:#3730a3; padding:2px 6px; border-radius:9999px; font-size:0.9em; margin:0 2px}
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

    // mention UI
    const [showMention, setShowMention] = useState<boolean>(false);
    const [suggestions, setSuggestions] = useState<Array<{ id: number; name: string }>>([]);
    const [mentionQuery, setMentionQuery] = useState<string>('');

    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const insertMention = (user: { id: number; name: string }) => {
        const editor = editorRef.current;
        if (!editor) return;
        try {
            editor.model.change((writer: any) => {
                // try to remove the typed @token before inserting
                try {
                    const selection = editor.model.document.selection;
                    const position = selection.getFirstPosition && selection.getFirstPosition();
                    if (position && mentionQuery && mentionQuery.length > 0) {
                        const removeCount = mentionQuery.length + 1; // include @
                        try {
                            const startPos = position.getShiftedBy(-removeCount);
                            const range = writer.createRange(startPos, position);
                            writer.remove(range);
                        } catch {
                            // ignore if shifting fails
                        }
                    }
                } catch {
                    // ignore
                }

                const mentionHtml = `<span class="mention" data-user-id="${user.id}">@${escapeHtml(user.name)}</span>`;
                const viewFragment = editor.data.processor.toView(mentionHtml);
                const modelFragment = editor.data.toModel(viewFragment);
                editor.model.insertContent(modelFragment, editor.model.document.selection);
            });
            const newHtml = editor.getData();
            if (onChange) onChange(newHtml);
        } catch {
            // fallback: append plain text mention -> replace with span insertion to preserve class/data attrs
            const data = editor.getData();
            const tmp = document.createElement('div');
            tmp.innerHTML = data;
            const mentionSpan = document.createElement('span');
            mentionSpan.className = 'mention';
            mentionSpan.setAttribute('data-user-id', String(user.id));
            mentionSpan.textContent = '@' + user.name;

            // append to last paragraph if exists, otherwise create one
            const last = tmp.lastElementChild as HTMLElement | null;
            if (last && last.tagName.toLowerCase() === 'p') {
                last.appendChild(document.createTextNode(' '));
                last.appendChild(mentionSpan);
            } else {
                const p = document.createElement('p');
                p.appendChild(mentionSpan);
                tmp.appendChild(p);
            }
            const newHtml = tmp.innerHTML;
            editor.setData(newHtml);
            if (onChange) onChange(newHtml);
        }
        setShowMention(false);
        setMentionQuery('');
    };

    return (
        <div>
            {/* 行間を狭くし、初期表示高さを約5行に設定 */}
            <style>{`
                .ck-editor__editable_inline {
                    line-height: 1.25 !important;
                    min-height: 120px !important;
                }
                .ck-content p {
                    margin: 0 0 0.4em 0 !important;
                }
                /* プレビュー内のイタリック装飾 */
                .post-body em, .post-body i {
                    font-style: italic;
                    color: #0f172a;
                    padding: 0 3px;
                    border-radius: 3px;
                }
                /* プレビュー用の簡易モーダル */
                .rte-preview-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:60; }
                .rte-preview-modal { width: 90%; max-width: 900px; height: 70%; background: white; border-radius: 8px; overflow: hidden; display:flex; flex-direction:column }
                .rte-preview-header { padding: 8px; border-bottom: 1px solid #eee; display:flex; justify-content:space-between; align-items:center }
                .rte-preview-body { flex:1; }
            `}</style>

            <div className="mb-2 flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={togglePreview}>
                    {previewOpen ? 'プレビューを閉じる' : 'プレビュー'}
                </Button>
            </div>
            <div className="prose max-w-none rounded border p-2">
                <CKEditor
                    editor={ClassicEditor}
                    config={editorConfig}
                    data={value || ''}
                    onReady={(editor: any) => {
                        editorRef.current = editor;
                        try {
                            const editable = editor.ui.view.editable.element;
                            if (editable) {
                                editable.style.lineHeight = '1.25';
                                editable.style.minHeight = '120px';
                            }
                        } catch {
                            // ignore
                        }
                    }}
                    onChange={(event: any, editor: any) => {
                        const data = editor.getData();
                        if (onChange) onChange(data);

                        // detect trailing @token in plain text
                        try {
                            const tmp = document.createElement('div');
                            tmp.innerHTML = data;
                            const text = tmp.textContent || '';
                            // match last token that starts with @ and has no space until end
                            const m = text.match(/@([^\s@#]+)$/);
                            if (m && m[1].length > 0 && availableUsers && availableUsers.length > 0) {
                                const q = m[1];
                                const filtered = availableUsers.filter((u) => u.name.indexOf(q) !== -1).slice(0, 8);
                                setSuggestions(filtered);
                                setShowMention(filtered.length > 0);
                                setMentionQuery(q);
                            } else {
                                setShowMention(false);
                                setSuggestions([]);
                                setMentionQuery('');
                            }
                        } catch {
                            setShowMention(false);
                            setMentionQuery('');
                        }
                    }}
                />
            </div>

            {/* mention suggestion box */}
            {showMention && suggestions.length > 0 && (
                <div className="absolute z-50 mt-2 max-h-48 w-full max-w-lg overflow-auto rounded border bg-gray-50 p-2 shadow">
                    {suggestions.map((s) => (
                        <div key={s.id} className="cursor-pointer px-2 py-1 hover:bg-gray-100" onClick={() => insertMention(s)}>
                            {s.name}
                        </div>
                    ))}
                </div>
            )}

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
