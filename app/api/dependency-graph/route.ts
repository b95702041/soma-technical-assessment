import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      include: {
        dependencies: { select: { id: true, title: true } },
        dependentTasks: { select: { id: true, title: true } }
      }
    });

    // Create nodes and edges for graph visualization
    const nodes = todos.map(todo => ({
      id: todo.id,
      title: todo.title,
      duration: todo.duration || 1,
      dueDate: todo.dueDate,
      hasCircularDep: false, // We'll calculate this
      isInCriticalPath: false // We'll calculate this
    }));

    const edges = todos.flatMap(todo => 
      todo.dependencies.map(dep => ({
        from: dep.id,
        to: todo.id,
        fromTitle: dep.title,
        toTitle: todo.title
      }))
    );

    // Calculate graph statistics
    const stats = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      isolatedNodes: nodes.filter(node => 
        !edges.some(edge => edge.from === node.id || edge.to === node.id)
      ).length
    };

    return NextResponse.json({
      nodes,
      edges,
      stats
    });
  } catch (error) {
    console.error('Error generating dependency graph:', error);
    return NextResponse.json({ error: 'Error generating dependency graph' }, { status: 500 });
  }
}