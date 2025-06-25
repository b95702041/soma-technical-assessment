"use client"
import { Todo } from '@prisma/client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [newTodo, setNewTodo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDuration, setNewDuration] = useState(1);
  const [selectedDependencies, setSelectedDependencies] = useState<number[]>([]);
  const [circularWarning, setCircularWarning] = useState(false);
  const [todos, setTodos] = useState([]);
  const [startDates, setStartDates] = useState<{[key: number]: {earliestStart: string, earliestFinish: string}}>({});
  const [circularPaths, setCircularPaths] = useState<{hasCircularDependencies: boolean, circularPaths: any[], totalCircularPaths: number}>({
    hasCircularDependencies: false, 
    circularPaths: [], 
    totalCircularPaths: 0
  });
  const [criticalPath, setCriticalPath] = useState<{criticalPath: any[], totalDuration: number, pathDescription: string, totalTasks: number}>({
    criticalPath: [],
    totalDuration: 0,
    pathDescription: '',
    totalTasks: 0
  });
  const [showDependencyGraph, setShowDependencyGraph] = useState(false);
  const [graphData, setGraphData] = useState<{nodes: any[], edges: any[], stats: any}>({nodes: [], edges: [], stats: {}});
  const [loadingImages, setLoadingImages] = useState<{[key: number]: boolean}>({});
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    fetchTodos();
    fetchStartDates();
    fetchCircularPaths();
    fetchCriticalPath();
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(data);
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  };

  const fetchStartDates = async () => {
    try {
      const res = await fetch('/api/calculate-start-dates');
      const data = await res.json();
      setStartDates(data);
    } catch (error) {
      console.error('Failed to fetch start dates:', error);
    }
  };

  const fetchCircularPaths = async () => {
    try {
      const res = await fetch('/api/detect-circular-paths');
      const data = await res.json();
      setCircularPaths(data);
    } catch (error) {
      console.error('Failed to fetch circular paths:', error);
    }
  };

  const fetchCriticalPath = async () => {
    try {
      const res = await fetch('/api/critical-path');
      const data = await res.json();
      setCriticalPath(data);
    } catch (error) {
      console.error('Failed to fetch critical path:', error);
    }
  };

  const showGraph = async () => {
    try {
      const res = await fetch('/api/dependency-graph');
      const data = await res.json();
      setGraphData(data);
      setShowDependencyGraph(true);
    } catch (error) {
      console.error('Failed to fetch dependency graph:', error);
    }
  };

  const isTaskInCircularPath = (taskId: number): boolean => {
    return circularPaths.circularPaths.some(path => 
      path.path.some((task: any) => task.id === taskId)
    );
  };

  const isTaskInCriticalPath = (taskId: number): boolean => {
    return criticalPath.criticalPath.some(task => task.id === taskId);
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    
    if (circularWarning) {
      const proceed = confirm('Warning: This will create a circular dependency. Create anyway?');
      if (!proceed) return;
    }
    
    setCreatingTask(true);
    
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newTodo,
          dueDate: newDueDate || null,
          duration: newDuration,
          dependencyIds: selectedDependencies
        }),
      });
      setNewTodo('');
      setNewDueDate('');
      setNewDuration(1);
      setSelectedDependencies([]);
      setCircularWarning(false);
      fetchTodos();
      fetchStartDates();
      fetchCircularPaths();
      fetchCriticalPath();
    } catch (error) {
      console.error('Failed to add todo:', error);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleDeleteTodo = async (id: any) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });
      fetchTodos();
      fetchStartDates();
      fetchCircularPaths();
      fetchCriticalPath();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const toggleDependency = async (todoId: number) => {
    const newDependencies = selectedDependencies.includes(todoId) 
      ? selectedDependencies.filter(id => id !== todoId)
      : [...selectedDependencies, todoId];
    
    setSelectedDependencies(newDependencies);
    
    // Check for circular dependencies
    if (newDependencies.length > 0) {
      try {
        const response = await fetch('/api/check-circular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            newTaskDependencies: newDependencies,
            taskId: null // null for new tasks
          }),
        });
        const data = await response.json();
        console.log('API response:', data);
        setCircularWarning(data.hasCircular);
      } catch (error) {
        console.error('Failed to check circular dependencies:', error);
        setCircularWarning(false);
      }
    } else {
      setCircularWarning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-white mb-8">
          Things To Do App
        </h1>
        
        {/* Critical Path Information */}
        {criticalPath.totalTasks > 0 && (
          <div className="mb-6 bg-blue-100 border border-blue-400 text-blue-700 p-4 rounded-lg">
            <h3 className="font-bold mb-2">🎯 Critical Path</h3>
            <p className="text-sm mb-2">
              <strong>Total Duration:</strong> {criticalPath.totalDuration} days
            </p>
            <p className="text-sm mb-2">
              <strong>Tasks in Critical Path:</strong> {criticalPath.totalTasks}
            </p>
            {criticalPath.pathDescription && (
              <div className="text-sm bg-white p-2 rounded mb-2">
                <strong>Path:</strong> {criticalPath.pathDescription}
              </div>
            )}
            <p className="text-sm font-semibold">
              💡 <strong>Focus here:</strong> Delays in these tasks will delay the entire project.
            </p>
          </div>
        )}

        {/* Dependency Graph Button */}
        <div className="mb-6 text-center">
          <button
            onClick={showGraph}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition duration-300 font-semibold"
          >
            📊 View Dependency Graph
          </button>
        </div>

        {/* Circular Dependency Warning */}
        {circularPaths.hasCircularDependencies && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 p-4 rounded-lg">
            <h3 className="font-bold mb-2">⚠️ Circular Dependencies Detected!</h3>
            <p className="text-sm mb-2">The following dependency loops need to be resolved:</p>
            {circularPaths.circularPaths.map((path, index) => (
              <div key={index} className="text-sm bg-white p-2 rounded mb-2">
                <strong>Loop {index + 1}:</strong> {path.description}
                <br />
                <span className="text-blue-600">
                  💡 <strong>Suggestion:</strong> Remove the dependency from "{path.path[path.path.length - 2]?.title}" to "{path.path[0]?.title}"
                </span>
              </div>
            ))}
            <p className="text-sm mt-2 font-semibold">
              🔍 Tasks with circular issues are highlighted in red below.
            </p>
          </div>
        )}
        
        <div className="flex mb-6">
          <input
            type="text"
            className="flex-grow p-3 rounded-l-full focus:outline-none text-gray-700"
            placeholder="Add a new todo"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          />
          <input 
            type="date" 
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="p-3 focus:outline-none text-gray-700"
          />
          <input 
            type="number" 
            min="1"
            value={newDuration}
            onChange={(e) => setNewDuration(parseInt(e.target.value) || 1)}
            placeholder="Days"
            className="p-3 focus:outline-none text-gray-700 w-20"
          />
          <button
            onClick={handleAddTodo}
            disabled={creatingTask}
            className={`p-3 rounded-r-full transition duration-300 ${
              creatingTask 
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                : 'bg-white text-indigo-600 hover:bg-gray-100'
            }`}
          >
            {creatingTask ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span>Adding...</span>
              </div>
            ) : (
              'Add'
            )}
          </button>
        </div>

        {/* Dependency Selection */}
        {todos.length > 0 && (
          <div className="mb-6 bg-white bg-opacity-90 p-4 rounded-lg">
            <h3 className="text-gray-800 font-semibold mb-2">Dependencies (optional)</h3>
            <p className="text-sm text-gray-600 mb-3">Select tasks that must be completed before this task:</p>
            {circularWarning && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 text-sm">
                ⚠️ Warning: This selection would create a circular dependency!
              </div>
            )}
            <div className="max-h-32 overflow-y-auto space-y-2">
              {todos.map((todo: any) => (
                <label key={todo.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDependencies.includes(todo.id)}
                    onChange={() => toggleDependency(todo.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{todo.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <ul>
          {todos.map((todo: Todo) => (
            <li
              key={todo.id}
              className={`flex items-center p-4 mb-4 rounded-lg shadow-lg space-x-4 ${
                isTaskInCircularPath(todo.id) 
                  ? 'bg-red-100 border-2 border-red-300' 
                  : isTaskInCriticalPath(todo.id)
                  ? 'bg-blue-100 border-2 border-blue-300'
                  : 'bg-white bg-opacity-90'
              }`}
            >
              {/* Image section with loading state */}
              <div className="flex-shrink-0 w-16 h-16">
                {todo.imageUrl ? (
                  <div className="relative">
                    {loadingImages[todo.id] && (
                      <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    <img 
                      src={todo.imageUrl} 
                      alt={todo.title}
                      className="w-16 h-16 object-cover rounded-lg"
                      onLoad={() => setLoadingImages(prev => ({...prev, [todo.id]: false}))}
                      onLoadStart={() => setLoadingImages(prev => ({...prev, [todo.id]: true}))}
                      onError={() => setLoadingImages(prev => ({...prev, [todo.id]: false}))}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>

              {/* Content section */}
              <div className="flex-grow">
                <span className={`${
                  isTaskInCircularPath(todo.id) 
                    ? 'text-red-800 font-semibold' 
                    : isTaskInCriticalPath(todo.id)
                    ? 'text-blue-800 font-semibold'
                    : 'text-gray-800'
                }`}>
                  {todo.title}
                  {isTaskInCircularPath(todo.id) && ' 🔄'}
                  {isTaskInCriticalPath(todo.id) && !isTaskInCircularPath(todo.id) && ' 🎯'}
                </span>
                {todo.dueDate && (
                  <div className={`text-sm ${
                    new Date(todo.dueDate) < new Date() 
                      ? 'text-red-600 font-bold' 
                      : 'text-gray-600'
                  }`}>
                    Due: {new Date(todo.dueDate).toLocaleDateString()}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  Duration: {todo.duration || 1} day{(todo.duration || 1) !== 1 ? 's' : ''}
                </div>
                {startDates[todo.id] && (
                  <div className="text-xs text-green-600 mt-1">
                    Earliest start: {new Date(startDates[todo.id].earliestStart).toLocaleDateString()}
                  </div>
                )}
                {todo.dependencies && todo.dependencies.length > 0 && (
                  <div className="text-xs text-blue-600 mt-1">
                    Depends on: {todo.dependencies.map((dep: any) => dep.title).join(', ')}
                  </div>
                )}
                {todo.dependentTasks && todo.dependentTasks.length > 0 && (
                  <div className="text-xs text-purple-600 mt-1">
                    Blocks: {todo.dependentTasks.map((dep: any) => dep.title).join(', ')}
                  </div>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="text-red-500 hover:text-red-700 transition duration-300 flex-shrink-0"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Dependency Graph Modal */}
      {showDependencyGraph && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">📊 Dependency Graph</h2>
              <button
                onClick={() => setShowDependencyGraph(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            {/* Graph Statistics */}
            <div className="grid grid-cols-3 gap-4 mb-6 text-center">
              <div className="bg-blue-100 p-3 rounded">
                <div className="text-2xl font-bold text-blue-600">{graphData.stats.totalNodes}</div>
                <div className="text-sm text-blue-800">Total Tasks</div>
              </div>
              <div className="bg-green-100 p-3 rounded">
                <div className="text-2xl font-bold text-green-600">{graphData.stats.totalEdges}</div>
                <div className="text-sm text-green-800">Dependencies</div>
              </div>
              <div className="bg-yellow-100 p-3 rounded">
                <div className="text-2xl font-bold text-yellow-600">{graphData.stats.isolatedNodes}</div>
                <div className="text-sm text-yellow-800">Isolated Tasks</div>
              </div>
            </div>

            {/* Simple Text-based Graph Visualization */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Task Dependencies:</h3>
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                {graphData.edges.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {graphData.edges.map((edge: any, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="font-medium text-blue-600">{edge.fromTitle}</span>
                        <span className="text-gray-500">→</span>
                        <span className="font-medium text-green-600">{edge.toTitle}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">No dependencies found</p>
                )}
              </div>
              
              {graphData.stats.isolatedNodes > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Isolated Tasks (no dependencies):</h4>
                  <div className="bg-yellow-50 p-3 rounded">
                    {graphData.nodes
                      .filter((node: any) => !graphData.edges.some((edge: any) => edge.from === node.id || edge.to === node.id))
                      .map((node: any, index: number) => (
                        <span key={node.id} className="inline-block bg-yellow-200 text-yellow-800 px-2 py-1 rounded mr-2 mb-1 text-sm">
                          {node.title}
                        </span>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}