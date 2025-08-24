import { Button } from '@/components/ui/button';
import { Color } from '@tiptap/extension-color';
import Heading from '@tiptap/extension-heading';
import Mention from '@tiptap/extension-mention';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

type User = { id: number; name: string };

export default function RichTextEditor({
    value,
    onChange,
    fetchUsers,
}: {
    value?: string;
    onChange?: (html: string) => void;
    fetchUsers?: () => Promise<User[]>;
}) {
    const usersCache = useRef<User[] | null>(null);

    const mention = Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestions: [],
        suggestion: {
            char: '@',
            startOfLine: false,
            items: async ({ query }: { query: string }) => {
                if (!usersCache.current) {
                    try {
                        usersCache.current = fetchUsers ? await fetchUsers() : [];
                    } catch {
                        usersCache.current = [];
                    }
                }
                const list = usersCache.current || [];
                if (!query) return list.slice(0, 10);
                return list.filter((u) => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
            },
            render: () => {
                let component: any;
                let popup: any;
                return {
                    onStart: (props: any) => {
                        component = document.createElement('div');
                        component.className = 'bg-white rounded shadow-md overflow-auto max-h-40';
                        props.items.forEach((item: any) => {
                            const el = document.createElement('div');
                            el.className = 'px-3 py-1 text-sm hover:bg-gray-100 cursor-pointer';
                            el.textContent = item.name;
                            el.onclick = () => props.command({ id: item.id, label: item.name });
                            component.appendChild(el);
                        });
                        const instance = tippy(document.body, {
                            getReferenceClientRect: props.clientRect,
                            content: component,
                            showOnCreate: true,
                            interactive: true,
                            placement: 'bottom-start',
                        });
                        popup = Array.isArray(instance) ? instance[0] : instance;
                    },
                    onUpdate(props: any) {
                        if (!component || !popup) return;
                        component.innerHTML = '';
                        props.items.forEach((item: any) => {
                            const el = document.createElement('div');
                            el.className = 'px-3 py-1 text-sm hover:bg-gray-100 cursor-pointer';
                            el.textContent = item.name;
                            el.onclick = () => props.command({ id: item.id, label: item.name });
                            component.appendChild(el);
                        });
                        popup.setProps({ getReferenceClientRect: props.clientRect });
                    },
                    onExit() {
                        try {
                            if (popup) popup.destroy();
                        } catch {
                            // ignore
                        }
                    },
                };
            },
        },
    });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: false }),
            Heading.configure({ levels: [1, 2, 3, 4] }),
            TextStyle,
            Color,
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            mention,
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            onChange && onChange(editor.getHTML());
        },
    });

    useEffect(() => {
        if (!editor) return;
        if (value === undefined) return;
        // avoid resetting when same
        if (editor.getHTML() !== value) editor.commands.setContent(value);
    }, [value, editor]);

    const insertTable = () => {
        if (!editor) return;
        editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    };

    return (
        <div>
            <div className="mb-2 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => editor && editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                    H1
                </Button>
                <Button size="sm" variant="outline" onClick={() => editor && editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                    H2
                </Button>
                <Button size="sm" variant="outline" onClick={() => editor && editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                    H3
                </Button>
                <Button size="sm" variant="outline" onClick={() => editor && editor.chain().focus().toggleHeading({ level: 4 }).run()}>
                    H4
                </Button>
                <Button size="sm" variant="outline" onClick={() => editor && editor.chain().focus().toggleBold().run()}>
                    B
                </Button>
                <Button size="sm" variant="outline" onClick={() => editor && editor.chain().focus().toggleItalic().run()}>
                    I
                </Button>
                <input
                    type="color"
                    title="文字色"
                    onChange={(e) => editor && editor.chain().focus().setColor(e.target.value).run()}
                    className="h-8 w-8 border-none p-0"
                />
                <Button size="sm" variant="outline" onClick={insertTable}>
                    テーブル
                </Button>
            </div>
            <div className="prose max-w-none rounded border p-2">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
