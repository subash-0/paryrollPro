import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import EmployeeDetails from "@/pages/employee-details";
import Payroll from "@/pages/payroll";
import Reports from "@/pages/reports";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminRoute } from "@/components/auth/admin-route";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/employees">
        <ProtectedRoute>
          <Employees />
        </ProtectedRoute>
      </Route>
      
      <Route path="/employees/new">
        <ProtectedRoute>
          <EmployeeDetails />
        </ProtectedRoute>
      </Route>
      
      <Route path="/employees/:id">
        {(params) => (
          <ProtectedRoute>
            <EmployeeDetails id={parseInt(params.id)} />
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/payroll">
        <ProtectedRoute>
          <Payroll />
        </ProtectedRoute>
      </Route>
      
      <Route path="/payroll/:id">
        {(params) => (
          <ProtectedRoute>
            <Payroll id={parseInt(params.id)} />
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/payroll/employee/:id">
        {(params) => (
          <ProtectedRoute>
            <Payroll employeeId={parseInt(params.id)} />
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/reports">
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <AdminRoute>
          <Settings />
        </AdminRoute>
      </Route>
      
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
