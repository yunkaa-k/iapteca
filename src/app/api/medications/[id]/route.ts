import { NextResponse } from 'next/server';
import { connectDB, MedicationModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const med = await MedicationModel.findById((await params).id);
  if (!med || med.isDeleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(med);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  await connectDB();
  return NextResponse.json(await MedicationModel.findByIdAndUpdate((await params).id, await req.json(), { new: true }));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  await connectDB();
  return NextResponse.json(await MedicationModel.findByIdAndUpdate((await params).id, { isDeleted: true }));
}
