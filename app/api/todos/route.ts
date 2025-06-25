import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      include: {
        dependencies: {
          select: { id: true, title: true }
        },
        dependentTasks: {
          select: { id: true, title: true }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching todos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, dueDate, duration = 1, dependencyIds = [] } = await request.json();
    
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Search for an image using our image search API
    let imageUrl = null;
    try {
      const imageResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/search-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: title }),
      });
      const imageData = await imageResponse.json();
      imageUrl = imageData.imageUrl;
    } catch (imageError) {
      console.error('Image search failed:', imageError);
    }

    const todo = await prisma.todo.create({
      data: {
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
        duration,
        imageUrl,
        dependencies: {
          connect: dependencyIds.map((id: number) => ({ id }))
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

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error('Error creating todo:', error);
    return NextResponse.json({ error: 'Error creating todo' }, { status: 500 });
  }
}