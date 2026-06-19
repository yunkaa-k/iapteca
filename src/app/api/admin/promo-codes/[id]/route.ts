import { NextResponse } from 'next/server';
import { connectDB, PromoCodeModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();
  const { id } = await params;
  const deleted = await PromoCodeModel.findByIdAndDelete(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Промокод не знайдено' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
