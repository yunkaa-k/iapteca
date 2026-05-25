import { NextResponse } from 'next/server';
import { connectDB, UserModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PUT(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Auth' }, { status: 401 });
    await connectDB();
    const { name } = await req.json();
    return NextResponse.json(await UserModel.findByIdAndUpdate(user._id, { name }, { new: true }));
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Auth' }, { status: 401 });
    await connectDB();
    await UserModel.findByIdAndDelete(user._id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
