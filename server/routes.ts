import express, { Request, Response, NextFunction } from 'express';
import { createServer, type Server } from 'http';
import { storage } from './storage';
import {
  loginUserSchema,
  insertUserSchema,
  insertDepartmentSchema,
  insertEmployeeSchema,
  insertPayrollSchema
} from '@shared/schema';
import { authenticate, authorizeAdmin, loginUser, registerUser } from './auth';
import { validateBody, withTransaction, errorHandler, notFound } from './middleware';
import cookieParser from 'cookie-parser';

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware
  app.use(cookieParser());
  
  // Auth routes
  app.post('/api/auth/register', validateBody(insertUserSchema), withTransaction(async (req, res) => {
    try {
      const user = await registerUser(req.body);
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.post('/api/auth/login', validateBody(loginUserSchema), withTransaction(async (req, res) => {
    try {
      const { user, token } = await loginUser(req.body);
      
      // Set cookie with token
      res.cookie('token', token, { 
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }));
  
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  });
  
  app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // User routes
  app.get('/api/users', authenticate, authorizeAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Department routes
  app.get('/api/departments', authenticate, async (req, res) => {
    try {
      const departments = await storage.getAllDepartments();
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/departments', authenticate, authorizeAdmin, validateBody(insertDepartmentSchema), withTransaction(async (req, res) => {
    try {
      const department = await storage.createDepartment(req.body);
      res.status(201).json(department);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.get('/api/departments/:id', authenticate, async (req, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const department = await storage.getDepartment(departmentId);
      
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }
      
      res.json(department);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/departments/:id', authenticate, authorizeAdmin, withTransaction(async (req, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const department = await storage.updateDepartment(departmentId, req.body);
      
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }
      
      res.json(department);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.delete('/api/departments/:id', authenticate, authorizeAdmin, withTransaction(async (req, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const success = await storage.deleteDepartment(departmentId);
      
      if (!success) {
        return res.status(404).json({ message: 'Department not found' });
      }
      
      res.json({ message: 'Department deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));
  
  // Employee routes
  app.get('/api/employees', authenticate, async (req, res) => {
    try {
      const employees = await storage.getAllEmployeesWithDetails();
      res.json(employees);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/employees', authenticate, authorizeAdmin, withTransaction(async (req, res) => {
    try {
      let userId = req.body.userId;
      
      // If creating a new user
      if (req.body.isNewUser && !userId) {
        // Create user first
        const hashedPassword = await import('./auth').then(auth => 
          auth.hashPassword(req.body.lastName.toLowerCase() + "123") // Default password
        );
        
        const newUser = await storage.createUser({
          username: `${req.body.firstName.toLowerCase()}.${req.body.lastName.toLowerCase()}`,
          password: hashedPassword,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          phone: req.body.phone || null,
          role: 'employee'
        });
        
        userId = newUser.id;
      }
      
      // Now create the employee
      const employeeData = {
        userId: userId,
        departmentId: req.body.departmentId,
        position: req.body.position,
        taxId: req.body.taxId,
        taxStatus: req.body.taxStatus,
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        routingNumber: req.body.routingNumber,
        baseSalary: req.body.baseSalary,
        joinDate: req.body.joinDate,
        status: req.body.status || 'active'
      };
      
      const employee = await storage.createEmployee(employeeData);
      const employeeWithDetails = await storage.getEmployeeWithDetails(employee.id);
      
      res.status(201).json(employeeWithDetails);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.get('/api/employees/:id', authenticate, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployeeWithDetails(employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      
      res.json(employee);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/employees/:id', authenticate, authorizeAdmin, withTransaction(async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployeeWithDetails(employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      
      // Update user info if provided
      if (employee.userId && (req.body.firstName || req.body.lastName || req.body.email || req.body.phone)) {
        const userData = {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          phone: req.body.phone
        };
        
        // Remove undefined values
        Object.keys(userData).forEach(key => {
          if (userData[key as keyof typeof userData] === undefined) {
            delete userData[key as keyof typeof userData];
          }
        });
        
        await storage.updateUser(employee.userId, userData);
      }
      
      // Update employee info
      const employeeData = {
        departmentId: req.body.departmentId,
        position: req.body.position,
        taxId: req.body.taxId,
        taxStatus: req.body.taxStatus,
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        routingNumber: req.body.routingNumber,
        baseSalary: req.body.baseSalary,
        joinDate: req.body.joinDate,
        status: req.body.status
      };
      
      // Remove undefined values
      Object.keys(employeeData).forEach(key => {
        if (employeeData[key as keyof typeof employeeData] === undefined) {
          delete employeeData[key as keyof typeof employeeData];
        }
      });
      
      const updatedEmployee = await storage.updateEmployee(employeeId, employeeData);
      const updatedEmployeeWithDetails = await storage.getEmployeeWithDetails(employeeId);
      
      res.json(updatedEmployeeWithDetails);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.delete('/api/employees/:id', authenticate, authorizeAdmin, withTransaction(async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployee(employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      
      const success = await storage.deleteEmployee(employeeId);
      
      // If we have a user associated with this employee, we could also delete the user
      // But for audit purposes, we'll keep the user record
      
      res.json({ message: 'Employee deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));
  
  // Payroll routes
  app.get('/api/payrolls', authenticate, async (req, res) => {
    try {
      const payrolls = await storage.getAllPayrolls();
      res.json(payrolls);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/payrolls/recent', authenticate, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const recentPayrolls = await storage.getRecentPayrolls(limit);
      res.json(recentPayrolls);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/payrolls', authenticate, validateBody(insertPayrollSchema), withTransaction(async (req, res) => {
    try {
      // Set the user who processed this payroll
      req.body.processedBy = req.user!.userId;
      
      const payroll = await storage.createPayroll(req.body);
      const payrollWithDetails = await storage.getPayrollWithDetails(payroll.id);
      
      res.status(201).json(payrollWithDetails);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.get('/api/payrolls/:id', authenticate, async (req, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const payroll = await storage.getPayrollWithDetails(payrollId);
      
      if (!payroll) {
        return res.status(404).json({ message: 'Payroll not found' });
      }
      
      res.json(payroll);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/payrolls/employee/:id', authenticate, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const payrolls = await storage.getPayrollsByEmployeeId(employeeId);
      
      // Convert to PayrollWithDetails format
      const payrollsWithDetails = await Promise.all(
        payrolls.map(async p => await storage.getPayrollWithDetails(p.id))
      );
      
      res.json(payrollsWithDetails.filter(p => p !== undefined));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/payrolls/:id', authenticate, withTransaction(async (req, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const payroll = await storage.getPayroll(payrollId);
      
      if (!payroll) {
        return res.status(404).json({ message: 'Payroll not found' });
      }
      
      const updatedPayroll = await storage.updatePayroll(payrollId, req.body);
      const payrollWithDetails = await storage.getPayrollWithDetails(payrollId);
      
      res.json(payrollWithDetails);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.delete('/api/payrolls/:id', authenticate, authorizeAdmin, withTransaction(async (req, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const payroll = await storage.getPayroll(payrollId);
      
      if (!payroll) {
        return res.status(404).json({ message: 'Payroll not found' });
      }
      
      const success = await storage.deletePayroll(payrollId);
      
      res.json({ message: 'Payroll deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));
  
  // Dashboard data
  app.get('/api/dashboard/summary', authenticate, async (req, res) => {
    try {
      const summary = await storage.getDashboardSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/dashboard/departments', authenticate, async (req, res) => {
    try {
      const departments = await storage.getDepartmentDistribution();
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Error handling - only for API routes
  app.use('/api/*', errorHandler);
  app.use('/api/*', notFound);
  
  const httpServer = createServer(app);
  return httpServer;
}
