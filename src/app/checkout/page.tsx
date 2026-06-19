'use client';
import { useState } from 'react';
import { useCartStore } from '@/lib/store/cartStore';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, CheckCircle2, Ticket, X } from 'lucide-react';

export default function CheckoutPage() {
  const { items, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0);

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    finalTotal: number;
    discountType: string;
    discountValue: number;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  const total = appliedPromo ? appliedPromo.finalTotal : subtotal;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode, subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedPromo({
          code: promoCode.toUpperCase().trim(),
          discount: data.discount,
          finalTotal: data.finalTotal,
          discountType: data.discountType,
          discountValue: data.discountValue,
        });
        toast.success(`Промокод застосовано! Знижка: ${data.discount} ₴`);
      } else {
        setPromoError(data.error || 'Невірний промокод');
        setAppliedPromo(null);
      }
    } catch {
      setPromoError('Помилка перевірки промокоду');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };

  const handleOrder = async () => {
    if (!user) return router.push('/login');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ medication: i._id, quantity: i.quantity, price: i.price })),
          total: subtotal,
          promoCode: appliedPromo?.code || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Замовлення успішно створено');
        clearCart();
        router.push('/profile');
      } else {
        toast.error(data.error || 'Помилка при створенні замовлення');
      }
    } catch {
      toast.error('Сталася мережева помилка');
    }
  };

  if (items.length === 0) return <div className="p-20 text-center opacity-50 font-sans">Кошик порожній</div>;

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="w-6 h-6" /> Оформлення замовлення</h1>
      <div className="border rounded-xl p-6 space-y-4 shadow-sm bg-card">
        <div className="space-y-2">
          {items.map(i => (
            <div key={i._id} className="flex justify-between text-sm">
              <span className="opacity-80">{i.name} x{i.quantity}</span>
              <span className="font-medium">{i.price * i.quantity} ₴</span>
            </div>
          ))}
        </div>

        {/* Промокод */}
        <div className="border-t pt-4 space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            <Ticket className="w-4 h-4" /> Промокод
          </label>
          {appliedPromo ? (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
              <span className="text-sm font-mono font-bold text-green-700 dark:text-green-400">
                {appliedPromo.code}
                <span className="font-normal ml-2">
                  (−{appliedPromo.discountType === 'PERCENTAGE' ? `${appliedPromo.discountValue}%` : `${appliedPromo.discountValue} ₴`})
                </span>
              </span>
              <button onClick={handleRemovePromo} className="text-green-600 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Введіть промокод"
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                className="font-mono"
              />
              <Button variant="outline" onClick={handleApplyPromo} disabled={promoLoading || !promoCode.trim()}>
                {promoLoading ? '...' : 'Застосувати'}
              </Button>
            </div>
          )}
          {promoError && <p className="text-sm text-red-500">{promoError}</p>}
        </div>

        {/* Підсумок */}
        {appliedPromo && (
          <div className="flex justify-between text-sm opacity-70">
            <span>Підсумок без знижки:</span>
            <span>{subtotal} ₴</span>
          </div>
        )}
        {appliedPromo && (
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-medium">
            <span>Знижка:</span>
            <span>−{appliedPromo.discount} ₴</span>
          </div>
        )}
        <div className="border-t pt-4 font-bold flex justify-between text-lg">
          <span>Разом:</span>
          <span className="text-primary">{total} ₴</span>
        </div>
      </div>
      <Button className="w-full h-12 text-lg font-bold shadow-lg" onClick={handleOrder}>
        <CheckCircle2 className="w-5 h-5 mr-2" /> Підтвердити замовлення
      </Button>
    </div>
  );
}

