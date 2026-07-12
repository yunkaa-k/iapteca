import { NextResponse } from 'next/server';
import { connectDB, PromoCodeModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { calculateDiscount } from '@/lib/promo';

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Auth' }, { status: 401 });
  }

  await connectDB();

  try {
    const { code, subtotal } = await req.json();

    if (!code || subtotal == null) {
      return NextResponse.json({ valid: false, error: 'Поля code та subtotal обов\'язкові' }, { status: 400 });
    }

    const promo = await PromoCodeModel.findOne({ code: code.toUpperCase().trim() });

    if (!promo) {
      return NextResponse.json({ valid: false, error: 'Промокод не знайдено' });
    }

    if (!promo.isActive) {
      return NextResponse.json({ valid: false, error: 'Промокод неактивний' });
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Термін дії промокоду закінчився' });
    }

    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({ valid: false, error: 'Ліміт використань промокоду вичерпано' });
    }

    if (subtotal < promo.minOrderTotal) {
      return NextResponse.json({
        valid: false,
        error: `Мінімальна сума замовлення для цього промокоду: ${promo.minOrderTotal} ₴`,
      });
    }

    const { discount, finalTotal } = calculateDiscount(
      subtotal,
      promo.discountType,
      promo.discountValue,
      promo.minOrderTotal,
    );

    return NextResponse.json({
      valid: true,
      discount,
      finalTotal,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
