import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { newTaskDependencies, taskId } = await request.json();
    
    // Get all existing todos with their dependencies
    const todos = await prisma.todo.findMany({
      include: {
        dependencies: { select: { id: true } }
      }
    });

    // Build current dependency graph
    const graph: { [key: number]: number[] } = {};
    todos.forEach(todo => {
      graph[todo.id] = todo.dependencies.map(dep => dep.id);
    });

    // Add the proposed new dependencies
    if (taskId) {
      // Existing task getting new dependencies
      graph[taskId] = newTaskDependencies;
    } else {
      // New task - check if any dependency would create a back-reference
      // For new tasks, check if any dependency chains would point back to the new task
      const wouldCreateCycle = (depIds: number[]): boolean => {
        // Check if any dependency eventually leads to any other dependency
        const visited = new Set<number>();
        
        const dfs = (nodeId: number, target: number): boolean => {
          if (nodeId === target) return true;
          if (visited.has(nodeId)) return false;
          
          visited.add(nodeId);
          const deps = graph[nodeId] || [];
          
          for (const depId of deps) {
            if (dfs(depId, target)) return true;
          }
          
          return false;
        };
        
        // Check all pairs of dependencies
        for (let i = 0; i < depIds.length; i++) {
          for (let j = i + 1; j < depIds.length; j++) {
            if (dfs(depIds[i], depIds[j]) || dfs(depIds[j], depIds[i])) {
              return true;
            }
          }
        }
        
        return false;
      };
      
      return NextResponse.json({ hasCircular: wouldCreateCycle(newTaskDependencies) });
    }

    // Standard cycle detection for existing tasks
    const hasCycle = (): boolean => {
      const visited = new Set<number>();
      const recursionStack = new Set<number>();
      
      const dfs = (nodeId: number): boolean => {
        if (recursionStack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;
        
        visited.add(nodeId);
        recursionStack.add(nodeId);
        
        const dependencies = graph[nodeId] || [];
        for (const depId of dependencies) {
          if (dfs(depId)) return true;
        }
        
        recursionStack.delete(nodeId);
        return false;
      };
      
      for (const nodeId of Object.keys(graph).map(Number)) {
        if (!visited.has(nodeId) && dfs(nodeId)) {
          return true;
        }
      }
      
      return false;
    };

    return NextResponse.json({ hasCircular: hasCycle() });
  } catch (error) {
    console.error('Circular dependency check error:', error);
    return NextResponse.json({ hasCircular: false });
  }
}