import { NextResponse } from 'next/server';
import { connectDB, OrderModel, MedicationModel, PromoCodeModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';
import { calculateDiscount } from '@/lib/promo';

export async function GET(req: Request) {
  const startTime = Date.now();
  metrics.incrementCounter('http_requests_total', { method: 'GET', path: '/api/orders' });

  const user = await getAuthUser();
  if (!user) {
    metrics.observeHistogram('http_request_duration_ms', Date.now() - startTime, { path: '/api/orders' });
    return NextResponse.json({ error: 'Auth' }, { status: 401 });
  }
  await connectDB();
  const { searchParams } = new URL(req.url);
  const filter = user.role === 'ADMIN' && searchParams.get('admin') ? {} : { user: user._id };
  const orders = await OrderModel.find(filter).sort({ createdAt: -1 });

  metrics.observeHistogram('http_request_duration_ms', Date.now() - startTime, { path: '/api/orders' });
  return NextResponse.json(orders);
}

/**
 * Валідує промокод і повертає дані для знижки.
 * Повертає null, якщо промокод не вказано.
 * Кидає Error, якщо промокод недійсний.
 */
async function validatePromoCode(promoCodeStr: string | undefined, subtotal: number, session?: mongoose.ClientSession) {
  if (!promoCodeStr) return null;

  const code = promoCodeStr.toUpperCase().trim();
  const query = PromoCodeModel.findOne({ code });
  const promo = session ? await query.session(session) : await query;

  if (!promo) throw new Error('Промокод не знайдено');
  if (!promo.isActive) throw new Error('Промокод неактивний');
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) throw new Error('Термін дії промокоду закінчився');
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) throw new Error('Ліміт використань вичерпано');
  if (subtotal < promo.minOrderTotal) throw new Error(`Мінімальна сума замовлення: ${promo.minOrderTotal} ₴`);

  const { discount, finalTotal } = calculateDiscount(subtotal, promo.discountType, promo.discountValue, promo.minOrderTotal);

  return { code, discount, finalTotal, promoId: promo._id };
}

export async function POST(req: Request) {
  const startTime = Date.now();
  metrics.incrementCounter('http_requests_total', { method: 'POST', path: '/api/orders' });

  const user = await getAuthUser();
  if (!user) {
    metrics.observeHistogram('http_request_duration_ms', Date.now() - startTime, { path: '/api/orders' });
    return NextResponse.json({ error: 'Auth' }, { status: 401 });
  }

  await connectDB();

  const { items, total, promoCode: promoCodeStr } = await req.json();
  const MAX_RETRIES = 50;
  let retryCount = 0;

  if (items && items.length === 1) {
    while (retryCount < MAX_RETRIES) {
      try {
        const item = items[0];
        const med = await MedicationModel.findOneAndUpdate(
          { _id: item.medication, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!med) throw new Error('Недостатньо товару');

        // Валідація промокоду
        const promoResult = await validatePromoCode(promoCodeStr, total);

        const orderData: Record<string, unknown> = {
          user: user._id,
          items,
          total: promoResult ? promoResult.finalTotal : total,
          status: 'PENDING',
        };

        if (promoResult) {
          orderData.promoCode = promoResult.code;
          orderData.discount = promoResult.discount;
          await PromoCodeModel.findByIdAndUpdate(promoResult.promoId, { $inc: { usedCount: 1 } });
        }

        const order = await OrderModel.create(orderData);

        logger.info('order.created', { user_id: user._id.toString(), order_id: order._id.toString(), total: orderData.total as number, promo: promoResult?.code });
        metrics.observeHistogram('http_request_duration_ms', Date.now() - startTime, { path: '/api/orders' });
        return NextResponse.json(order);
      } catch (error: unknown) {
        let isRetryable = false;
        if (error && typeof error === 'object') {
          const errCode = (error as Record<string, unknown>).code;
          const errMsg = (error as Error).message;
          isRetryable = errCode === 112 || errMsg?.includes('Write conflict') || errCode === 11000;
        }

        if (isRetryable && retryCount < MAX_RETRIES - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 * retryCount));
          continue;
        }
        const message = error instanceof Error ? error.message : 'Failed';
        logger.error('order.creation_failed', { user_id: user._id.toString(), error_message: message });
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
  }

  while (retryCount < MAX_RETRIES) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!items || items.length === 0) {
        throw new Error('Кошик порожній');
      }

      for (const item of items) {
        const med = await MedicationModel.findOneAndUpdate(
          { _id: item.medication, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, new: true }
        );

        if (!med) throw new Error('Недостатньо товару');
      }

      // Валідація промокоду у транзакції
      const promoResult = await validatePromoCode(promoCodeStr, total, session);

      const orderData: Record<string, unknown> = {
        user: user._id,
        items,
        total: promoResult ? promoResult.finalTotal : total,
        status: 'PENDING',
      };

      if (promoResult) {
        orderData.promoCode = promoResult.code;
        orderData.discount = promoResult.discount;
        await PromoCodeModel.findByIdAndUpdate(promoResult.promoId, { $inc: { usedCount: 1 } }).session(session);
      }

      const order = await OrderModel.create([orderData], { session });

      await session.commitTransaction();
      session.endSession();

      logger.info('order.created', { user_id: user._id.toString(), order_id: order[0]._id.toString(), total: orderData.total as number, promo: promoResult?.code });
      metrics.observeHistogram('http_request_duration_ms', Date.now() - startTime, { path: '/api/orders' });
      return NextResponse.json(order[0]);
    } catch (error: unknown) {
      await session.abortTransaction();
      session.endSession();

      let isWriteConflict = false;
      if (error && typeof error === 'object') {
        const errCode = (error as Record<string, unknown>).code;
        const errMsg = (error as Error).message;

        interface MongoError extends Error {
          hasErrorLabel?: (label: string) => boolean;
        }
        const mongoErr = error as MongoError;
        const isTransient = typeof mongoErr.hasErrorLabel === 'function' ? mongoErr.hasErrorLabel('TransientTransactionError') : false;

        isWriteConflict = errCode === 112 || errMsg?.includes('Write conflict') || isTransient;
      }

      if (isWriteConflict && retryCount < MAX_RETRIES - 1) {
        retryCount++;
        const delay = Math.min(1000, Math.pow(1.5, retryCount) * 20 + Math.random() * 100);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      const message = error instanceof Error ? error.message : 'Failed';
      logger.error('order.creation_failed', { user_id: user._id.toString(), error_message: message });
      metrics.observeHistogram('http_request_duration_ms', Date.now() - startTime, { path: '/api/orders' });
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'System busy' }, { status: 429 });
}

export async function DELETE() {
  const startTime = Date.now();
  metrics.incrementCounter('http_requests_total', { method: 'DELETE', path: '/api/orders' });

  const user = await getAuthUser();
  if (!user) {
    metrics.observeHistogram('http_request_duration_ms', Date.now() - startTime, { path: '/api/orders' });
    return NextResponse.json({ error: 'Auth' }, { status: 401 });
  }

  await connectDB();
  await OrderModel.deleteMany({ user: user._id });

  metrics.observeHistogram('http_request_duration_ms', Date.now() - startTime, { path: '/api/orders' });
  return new NextResponse(null, { status: 204 });
}
