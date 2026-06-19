import { DiscountType } from './types';

export interface DiscountResult {
  discount: number;
  finalTotal: number;
}

/**
 * Розраховує знижку на замовлення.
 * Чиста функція без побічних ефектів.
 *
 * @param subtotal     — сума замовлення до знижки (≥ 0)
 * @param discountType — тип знижки: 'PERCENTAGE' | 'FIXED'
 * @param discountValue — значення знижки (% або фіксована сума в ₴)
 * @param minOrderTotal — мінімальна сума замовлення для застосування знижки
 * @returns {{ discount, finalTotal }}
 */
export function calculateDiscount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number,
  minOrderTotal: number,
): DiscountResult {
  if (subtotal <= 0 || discountValue <= 0) {
    return { discount: 0, finalTotal: Math.max(0, subtotal) };
  }

  if (subtotal < minOrderTotal) {
    return { discount: 0, finalTotal: subtotal };
  }

  let discount: number;

  if (discountType === 'PERCENTAGE') {
    discount = subtotal * discountValue / 100;
  } else {
    // FIXED
    discount = discountValue;
  }

  // Знижка не може перевищувати суму замовлення
  discount = Math.min(discount, subtotal);

  // Округлення до 2 знаків
  discount = Math.round(discount * 100) / 100;
  const finalTotal = Math.round((subtotal - discount) * 100) / 100;

  return { discount, finalTotal };
}
