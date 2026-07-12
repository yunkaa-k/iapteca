'use client';
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { PromoCode } from '@/lib/types';
import { Ticket, Plus, Trash2 } from 'lucide-react';

export default function PromoCodesAdmin() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    discountValue: '',
    minOrderTotal: '',
    maxUses: '',
    expiresAt: '',
  });

  const load = () =>
    fetch('/api/admin/promo-codes')
      .then(res => res.json())
      .then(setPromoCodes);

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.code || !form.discountValue) {
      toast.error('Заповніть обов\'язкові поля');
      return;
    }

    const res = await fetch('/api/admin/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderTotal: form.minOrderTotal ? Number(form.minOrderTotal) : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : 0,
        expiresAt: form.expiresAt || null,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      toast.success('Промокод створено');
      setForm({ code: '', discountType: 'PERCENTAGE', discountValue: '', minOrderTotal: '', maxUses: '', expiresAt: '' });
      setOpen(false);
      load();
    } else {
      toast.error(data.error || 'Помилка при створенні');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Видалити промокод?')) return;
    const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Промокод видалено');
      load();
    } else {
      toast.error('Помилка при видаленні');
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('uk-UA');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Ticket className="w-6 h-6" /> Промокоди
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Додати промокод</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новий промокод</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="promo-code">Код *</Label>
                <Input
                  id="promo-code"
                  placeholder="Наприклад: SPRING2026"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="promo-discount-type">Тип знижки *</Label>
                <Select value={form.discountType} onValueChange={(v: 'PERCENTAGE' | 'FIXED') => setForm({ ...form, discountType: v })}>
                  <SelectTrigger id="promo-discount-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Відсоток (%)</SelectItem>
                    <SelectItem value="FIXED">Фіксована (₴)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="promo-discount-value">
                  Значення знижки {form.discountType === 'PERCENTAGE' ? '(%)' : '(₴)'} *
                </Label>
                <Input
                  id="promo-discount-value"
                  type="number"
                  min="0"
                  max={form.discountType === 'PERCENTAGE' ? '100' : undefined}
                  placeholder={form.discountType === 'PERCENTAGE' ? '10' : '50'}
                  value={form.discountValue}
                  onChange={e => setForm({ ...form, discountValue: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="promo-min-total">Мінімальна сума замовлення (₴)</Label>
                <Input
                  id="promo-min-total"
                  type="number"
                  min="0"
                  placeholder="0 — без обмеження"
                  value={form.minOrderTotal}
                  onChange={e => setForm({ ...form, minOrderTotal: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="promo-max-uses">Ліміт використань</Label>
                <Input
                  id="promo-max-uses"
                  type="number"
                  min="0"
                  placeholder="0 — необмежено"
                  value={form.maxUses}
                  onChange={e => setForm({ ...form, maxUses: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="promo-expires">Термін дії (до)</Label>
                <Input
                  id="promo-expires"
                  type="date"
                  value={form.expiresAt}
                  onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleCreate}>
                Створити промокод
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Код</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Значення</TableHead>
            <TableHead>Мін. сума</TableHead>
            <TableHead>Використання</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Дійсний до</TableHead>
            <TableHead>Дія</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promoCodes.map(p => {
            const isExpired = p.expiresAt && new Date(p.expiresAt) < new Date();
            const isLimitReached = p.maxUses > 0 && p.usedCount >= p.maxUses;
            return (
              <TableRow key={p._id}>
                <TableCell className="font-mono font-bold">{p.code}</TableCell>
                <TableCell>{p.discountType === 'PERCENTAGE' ? 'Відсоток' : 'Фіксована'}</TableCell>
                <TableCell>{p.discountValue}{p.discountType === 'PERCENTAGE' ? '%' : ' ₴'}</TableCell>
                <TableCell>{p.minOrderTotal > 0 ? `${p.minOrderTotal} ₴` : '—'}</TableCell>
                <TableCell>{p.usedCount}{p.maxUses > 0 ? ` / ${p.maxUses}` : ' / ∞'}</TableCell>
                <TableCell>
                  {isExpired ? (
                    <Badge variant="destructive">Прострочений</Badge>
                  ) : isLimitReached ? (
                    <Badge variant="destructive">Вичерпано</Badge>
                  ) : p.isActive ? (
                    <Badge variant="default">Активний</Badge>
                  ) : (
                    <Badge variant="outline">Неактивний</Badge>
                  )}
                </TableCell>
                <TableCell>{formatDate(p.expiresAt)}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(p._id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {promoCodes.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center opacity-50 py-8">
                Немає промокодів
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
