import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

export default function ItemForm({ initial = {}, categories = [], suppliers = [], onSubmit }: any) {
    const [form, setForm] = useState({
        name: initial.name || '',
        category_id: initial.category_id || '',
        supplier_id: initial.supplier_id || '',
        size: initial.size || '',
        unit: initial.unit || '',
        memo: initial.memo || '',
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit(form);
            }}
            className="space-y-4"
        >
            <div>
                <Label>名前</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>カテゴリ</Label>
                    <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                        <option value="">選択</option>
                        {categories.map((c: any) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </Select>
                </div>
                <div>
                    <Label>仕入れ先</Label>
                    <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                        <option value="">選択</option>
                        {suppliers.map((s: any) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>サイズ</Label>
                    <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
                </div>
                <div>
                    <Label>単位</Label>
                    <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                </div>
            </div>
            <div>
                <Label>メモ</Label>
                <Textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
            <div className="flex justify-end">
                <Button type="submit">保存</Button>
            </div>
        </form>
    );
}
