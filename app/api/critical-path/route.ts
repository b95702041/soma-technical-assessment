import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      include: {
        dependencies: { select: { id: true, duration: true } },
        dependentTasks: { select: { id: true } }
      }
    });

    // Find start and end tasks
    const startTasks = todos.filter(todo => todo.dependencies.length === 0);
    const endTasks = todos.filter(todo => todo.dependentTasks.length === 0);
    
    // Calculate longest paths from each start task
    const longestPaths: { path: number[], duration: number }[] = [];
    
    const findLongestPath = (taskId: number, currentPath: number[] = [], visited: Set<number> = new Set()): { path: number[], duration: number } => {
      // Prevent infinite loops in circular dependencies
      if (visited.has(taskId)) {
        return { path: currentPath, duration: 0 };
      }
      
      visited.add(taskId);
      const task = todos.find(t => t.id === taskId);
      if (!task) return { path: currentPath, duration: 0 };
      
      const newPath = [...currentPath, taskId];
      const taskDuration = task.duration || 1;
      
      // If no dependent tasks, this is an end point
      if (task.dependentTasks.length === 0) {
        return { 
          path: newPath, 
          duration: currentPath.reduce((sum, id) => {
            const t = todos.find(t => t.id === id);
            return sum + (t?.duration || 1);
          }, 0) + taskDuration
        };
      }
      
      // Recursively find longest path through dependent tasks
      let longestPath = { path: newPath, duration: taskDuration };
      
      for (const dependent of task.dependentTasks) {
        const pathResult = findLongestPath(dependent.id, newPath, new Set(visited));
        const totalDuration = currentPath.reduce((sum, id) => {
          const t = todos.find(t => t.id === id);
          return sum + (t?.duration || 1);
        }, 0) + taskDuration + pathResult.duration;
        
        if (totalDuration > longestPath.duration) {
          longestPath = { path: pathResult.path, duration: totalDuration };
        }
      }
      
      return longestPath;
    };
    
    // Find critical paths from all start tasks
    startTasks.forEach(startTask => {
      const pathResult = findLongestPath(startTask.id);
      longestPaths.push(pathResult);
    });
    
    // Find the overall critical path (longest of all paths)
    const criticalPath = longestPaths.reduce((longest, current) => 
      current.duration > longest.duration ? current : longest,
      { path: [], duration: 0 }
    );
    
    // Convert to readable format
    const readablePath = criticalPath.path.map(id => {
      const task = todos.find(t => t.id === id);
      return { id, title: task?.title || `Task ${id}`, duration: task?.duration || 1 };
    });
    
    return NextResponse.json({
      criticalPath: readablePath,
      totalDuration: criticalPath.duration,
      pathDescription: readablePath.map(task => task.title).join(' → '),
      totalTasks: readablePath.length
    });
  } catch (error) {
    console.error('Error calculating critical path:', error);
    return NextResponse.json({ error: 'Error calculating critical path' }, { status: 500 });
  }
}