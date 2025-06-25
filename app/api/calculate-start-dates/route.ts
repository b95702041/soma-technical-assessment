import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      include: {
        dependencies: { select: { id: true, duration: true } }
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // First, detect which tasks are in circular dependencies
    const circularTasks = new Set<number>();
    
    // Simple circular detection - if a task has dependencies that eventually lead back to itself
    const isCircular = (taskId: number, visited: Set<number> = new Set()): boolean => {
      if (visited.has(taskId)) return true;
      visited.add(taskId);
      
      const task = todos.find(t => t.id === taskId);
      if (!task) return false;
      
      for (const dep of task.dependencies) {
        if (isCircular(dep.id, new Set(visited))) {
          return true;
        }
      }
      return false;
    };
    
    // Mark circular tasks
    todos.forEach(todo => {
      if (isCircular(todo.id)) {
        circularTasks.add(todo.id);
      }
    });
    
    console.log('Circular tasks detected:', Array.from(circularTasks));
    
    // Calculate start dates - skip dependency calculation for circular tasks
    const result: { [key: number]: { earliestStart: string, earliestFinish: string } } = {};
    
    todos.forEach(todo => {
      let startDate = new Date(today);
      
      // If task is not circular and has dependencies, calculate based on dependencies
      if (!circularTasks.has(todo.id) && todo.dependencies.length > 0) {
        let latestDepFinish = new Date(today);
        
        for (const dep of todo.dependencies) {
          // Only consider non-circular dependencies
          if (!circularTasks.has(dep.id)) {
            const depFinish = new Date(today);
            depFinish.setDate(depFinish.getDate() + (dep.duration || 1));
            
            if (depFinish > latestDepFinish) {
              latestDepFinish = depFinish;
            }
          }
        }
        
        startDate = latestDepFinish;
      }
      
      const finishDate = new Date(startDate);
      finishDate.setDate(finishDate.getDate() + (todo.duration || 1));
      
      result[todo.id] = {
        earliestStart: startDate.toISOString().split('T')[0],
        earliestFinish: finishDate.toISOString().split('T')[0]
      };
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calculating start dates:', error);
    return NextResponse.json({ error: 'Error calculating start dates' }, { status: 500 });
  }
}