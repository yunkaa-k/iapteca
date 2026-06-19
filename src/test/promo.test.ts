import { describe, it, expect } from 'vitest';
import { calculateDiscount } from '@/lib/promo';

describe('calculateDiscount', () => {
  describe('відсоткова знижка (PERCENTAGE)', () => {
    it('10% від 1000₴ → знижка 100₴, разом 900₴', () => {
      const result = calculateDiscount(1000, 'PERCENTAGE', 10, 0);
      expect(result.discount).toBe(100);
      expect(result.finalTotal).toBe(900);
    });

    it('25% від 400₴ → знижка 100₴, разом 300₴', () => {
      const result = calculateDiscount(400, 'PERCENTAGE', 25, 0);
      expect(result.discount).toBe(100);
      expect(result.finalTotal).toBe(300);
    });

    it('100% → знижка = повна сума', () => {
      const result = calculateDiscount(500, 'PERCENTAGE', 100, 0);
      expect(result.discount).toBe(500);
      expect(result.finalTotal).toBe(0);
    });

    it('50% від 99.99₴ → коректне округлення', () => {
      const result = calculateDiscount(99.99, 'PERCENTAGE', 50, 0);
      expect(result.discount).toBe(50);
      expect(result.finalTotal).toBe(49.99);
    });

    it('33.33% від 100₴ → округлення до 2 знаків', () => {
      const result = calculateDiscount(100, 'PERCENTAGE', 33.33, 0);
      expect(result.discount).toBe(33.33);
      expect(result.finalTotal).toBe(66.67);
    });
  });

  describe('фіксована знижка (FIXED)', () => {
    it('50₴ від 500₴ → знижка 50₴, разом 450₴', () => {
      const result = calculateDiscount(500, 'FIXED', 50, 0);
      expect(result.discount).toBe(50);
      expect(result.finalTotal).toBe(450);
    });

    it('знижка більше за суму → знижка обмежується сумою', () => {
      const result = calculateDiscount(30, 'FIXED', 100, 0);
      expect(result.discount).toBe(30);
      expect(result.finalTotal).toBe(0);
    });

    it('знижка дорівнює сумі → разом 0₴', () => {
      const result = calculateDiscount(200, 'FIXED', 200, 0);
      expect(result.discount).toBe(200);
      expect(result.finalTotal).toBe(0);
    });
  });

  describe('мінімальна сума замовлення (minOrderTotal)', () => {
    it('сума менша за мінімальну → знижка 0', () => {
      const result = calculateDiscount(100, 'PERCENTAGE', 10, 200);
      expect(result.discount).toBe(0);
      expect(result.finalTotal).toBe(100);
    });

    it('сума дорівнює мінімальній → знижка застосовується', () => {
      const result = calculateDiscount(200, 'PERCENTAGE', 10, 200);
      expect(result.discount).toBe(20);
      expect(result.finalTotal).toBe(180);
    });

    it('сума більша за мінімальну → знижка застосовується', () => {
      const result = calculateDiscount(500, 'FIXED', 50, 300);
      expect(result.discount).toBe(50);
      expect(result.finalTotal).toBe(450);
    });

    it('мінімальна сума 0 → знижка завжди застосовується', () => {
      const result = calculateDiscount(10, 'FIXED', 5, 0);
      expect(result.discount).toBe(5);
      expect(result.finalTotal).toBe(5);
    });
  });

  describe('граничні випадки', () => {
    it('нульова сума замовлення → без знижки', () => {
      const result = calculateDiscount(0, 'PERCENTAGE', 50, 0);
      expect(result.discount).toBe(0);
      expect(result.finalTotal).toBe(0);
    });

    it('від\'ємна сума замовлення → без знижки', () => {
      const result = calculateDiscount(-100, 'FIXED', 50, 0);
      expect(result.discount).toBe(0);
      expect(result.finalTotal).toBe(0);
    });

    it('нульове значення знижки → без знижки', () => {
      const result = calculateDiscount(1000, 'PERCENTAGE', 0, 0);
      expect(result.discount).toBe(0);
      expect(result.finalTotal).toBe(1000);
    });

    it('від\'ємне значення знижки → без знижки', () => {
      const result = calculateDiscount(1000, 'FIXED', -10, 0);
      expect(result.discount).toBe(0);
      expect(result.finalTotal).toBe(1000);
    });

    it('дуже мала сума з відсотковою знижкою', () => {
      const result = calculateDiscount(0.01, 'PERCENTAGE', 50, 0);
      expect(result.discount).toBe(0.01);
      expect(result.finalTotal).toBe(0);
    });

    it('велика сума з відсотковою знижкою', () => {
      const result = calculateDiscount(999999.99, 'PERCENTAGE', 15, 0);
      expect(result.discount).toBe(150000);
      expect(result.finalTotal).toBe(849999.99);
    });
  });
});
