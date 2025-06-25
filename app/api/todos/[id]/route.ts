import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

export async function DELETE(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await prisma.todo.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Todo deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting todo' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const { title, dueDate, duration, dependencyIds = [] } = await request.json();
    
    const todo = await prisma.todo.update({
      where: { id },
      data: {
        title: title || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        duration: duration || undefined,
        dependencies: {
          set: [], // Clear existing dependencies
          connect: dependencyIds.map((depId: number) => ({ id: depId }))
        }
      },
      include: {
        dependencies: {
          select: { id: true, title: true }
        },
        dependentTasks: {
          select: { id: true, title: true }
        }
      }
    });

    return NextResponse.json(todo);
  } catch (error) {
    console.error('Error updating todo:', error);
    return NextResponse.json({ error: 'Error updating todo' }, { status: 500 });
  }
}