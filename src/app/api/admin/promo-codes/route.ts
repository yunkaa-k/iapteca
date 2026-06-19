import { NextResponse } from 'next/server';
import { connectDB, PromoCodeModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const user = await getAuthUser();
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();
  const promoCodes = await PromoCodeModel.find().sort({ createdAt: -1 });
  return NextResponse.json(promoCodes);
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  try {
    const body = await req.json();
    const { code, discountType, discountValue, minOrderTotal, maxUses, expiresAt } = body;

    if (!code || !discountType || discountValue == null) {
      return NextResponse.json({ error: 'Поля code, discountType, discountValue обов\'язкові' }, { status: 400 });
    }

    if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
      return NextResponse.json({ error: 'discountType має бути PERCENTAGE або FIXED' }, { status: 400 });
    }

    if (discountType === 'PERCENTAGE' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json({ error: 'Відсоток знижки має бути від 0 до 100' }, { status: 400 });
    }

    if (discountType === 'FIXED' && discountValue < 0) {
      return NextResponse.json({ error: 'Сума знижки не може бути від\'ємною' }, { status: 400 });
    }

    const promoCode = await PromoCodeModel.create({
      code: code.toUpperCase().trim(),
      discountType,
      discountValue,
      minOrderTotal: minOrderTotal ?? 0,
      maxUses: maxUses ?? 0,
      expiresAt: expiresAt || null,
    });

    return NextResponse.json(promoCode, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && (error as Record<string, unknown>).code === 11000) {
      return NextResponse.json({ error: 'Промокод з таким кодом вже існує' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
