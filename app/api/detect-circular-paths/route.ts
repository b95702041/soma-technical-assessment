import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      include: {
        dependencies: { select: { id: true, title: true } }
      }
    });

    // Build dependency graph
    const graph: { [key: number]: number[] } = {};
    const todoMap: { [key: number]: { id: number, title: string } } = {};
    
    todos.forEach(todo => {
      graph[todo.id] = todo.dependencies.map(dep => dep.id);
      todoMap[todo.id] = { id: todo.id, title: todo.title };
    });

    // Find circular paths
    const circularPaths: number[][] = [];
    const visited = new Set<number>();
    const recursionStack = new Set<number>();
    const currentPath: number[] = [];

    const findCircularPaths = (nodeId: number): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle - extract the circular part
        const cycleStartIndex = currentPath.indexOf(nodeId);
        const cyclePath = currentPath.slice(cycleStartIndex).concat([nodeId]);
        circularPaths.push([...cyclePath]);
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      currentPath.push(nodeId);

      const dependencies = graph[nodeId] || [];
      for (const depId of dependencies) {
        findCircularPaths(depId);
      }

      recursionStack.delete(nodeId);
      currentPath.pop();
    };

    // Check all nodes for cycles
    for (const nodeId of Object.keys(graph).map(Number)) {
      if (!visited.has(nodeId)) {
        findCircularPaths(nodeId);
      }
    }

    // Convert paths to readable format
    const readablePaths = circularPaths.map(path => ({
      path: path.map(id => todoMap[id]),
      description: path.map(id => todoMap[id]?.title || `Task ${id}`).join(' → ')
    }));

    return NextResponse.json({
      hasCircularDependencies: circularPaths.length > 0,
      circularPaths: readablePaths,
      totalCircularPaths: circularPaths.length
    });
  } catch (error) {
    console.error('Error detecting circular paths:', error);
    return NextResponse.json({ error: 'Error detecting circular paths' }, { status: 500 });
  }
}