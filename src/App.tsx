import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Header from './components/layout/Header';
import ExercisesPage from './components/exercises/ExercisesPage';
import WorkbenchPage from './components/workbench/WorkbenchPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route
            path="/"
            element={
              <div className="min-h-screen bg-gray-50 font-inter">
                <Header />
                <ExercisesPage />
              </div>
            }
          />
          <Route
            path="/workbench/:taskId"
            element={<WorkbenchPage />}
          />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
