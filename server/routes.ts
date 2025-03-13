import express, { Request, Response, NextFunction, Express } from 'express';
import { createServer, type Server } from 'http';
import { database } from './database'; // Changed from storage to database
import {
  loginUserSchema,
  insertUserSchema,
  insertDepartmentSchema,
  insertEmployeeSchema,
  insertPayrollSchema
} from '@shared/schema';
import { authenticate, authorizeAdmin, loginUser, registerUser } from './auth';
import { validateBody, errorHandler, notFound } from './middleware';
import cookieParser from 'cookie-parser';

// Define withTransaction using database.withTransaction
const withTransaction = (handler: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Create payroll_summary_view for dashboard
  try {
    await database.withTransaction(async (client) => {
      await client.query(`
        CREATE OR REPLACE VIEW payroll_summary_view AS
        SELECT 
          month, 
          year, 
          COUNT(*) as payroll_count,
          SUM(CAST(net_amount AS DECIMAL)) as total_payroll,
          AVG(CAST(net_amount AS DECIMAL)) as average_payroll,
          (
            SELECT AVG(CAST(base_salary AS DECIMAL))
            FROM employees
            WHERE status = 'active'
          ) as average_salary
        FROM payrolls
        GROUP BY month, year;
      `);
      console.log("Payroll summary view created successfully");
    });
  } catch (error) {
    console.error("Failed to create payroll summary view:", error);
  }
  
  // Create payroll_details_view for detailed reporting
  try {
    await database.withTransaction(async (client) => {
      await client.query(`
        CREATE OR REPLACE VIEW payroll_details_view AS
        SELECT 
          p.id as payroll_id,
          p.month,
          p.year,
          p.status as payroll_status,
          p.gross_amount,
          p.tax_deductions,
          p.other_deductions,
          p.bonuses,
          p.net_amount,
          p.processed_at,
          e.id as employee_id,
          e.position,
          e.base_salary,
          e.status as employee_status,
          u.first_name,
          u.last_name,
          u.email,
          d.name as department_name
        FROM payrolls p
        JOIN employees e ON p.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        JOIN departments d ON e.department_id = d.id;
      `);
      console.log("Payroll details view created successfully");
    });
  } catch (error) {
    console.error("Failed to create payroll details view:", error);
  }
  
  // Create trigger to validate payroll data before insert
  try {
    await database.withTransaction(async (client) => {
      // Create validation function
      await client.query(`
        CREATE OR REPLACE FUNCTION validate_payroll_data()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Check if employee exists and is active
          IF NOT EXISTS (
            SELECT 1 FROM employees 
            WHERE id = NEW.employee_id AND status = 'active'
          ) THEN
            RAISE EXCEPTION 'Employee ID % does not exist or is not active', NEW.employee_id;
          END IF;
          
          -- Validate month and year
          IF NEW.month < 1 OR NEW.month > 12 THEN
            RAISE EXCEPTION 'Invalid month: %', NEW.month;
          END IF;
          
          IF NEW.year < 2000 OR NEW.year > 2100 THEN
            RAISE EXCEPTION 'Invalid year: %', NEW.year;
          END IF;
          
          -- Validate amounts are numeric and positive
          IF CAST(NEW.gross_amount AS DECIMAL) <= 0 THEN
            RAISE EXCEPTION 'Gross amount must be positive';
          END IF;
          
          -- Set default status if not provided
          IF NEW.status IS NULL THEN
            NEW.status := 'pending';
          END IF;
          
          -- Set processed_at timestamp for completed payrolls
          IF NEW.status = 'completed' AND NEW.processed_at IS NULL THEN
            NEW.processed_at := CURRENT_TIMESTAMP;
          END IF;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      // Create or replace the trigger
      await client.query(`
        DROP TRIGGER IF EXISTS validate_payroll_before_insert ON payrolls;
        CREATE TRIGGER validate_payroll_before_insert
        BEFORE INSERT ON payrolls
        FOR EACH ROW
        EXECUTE FUNCTION validate_payroll_data();
      `);
      
      console.log("Payroll validation trigger created successfully");
    });
  } catch (error) {
    console.error("Failed to create payroll validation trigger:", error);
  }
  
  // Create payslip generation function
  try {
    await database.withTransaction(async (client) => {
      await client.query(`
        CREATE OR REPLACE FUNCTION generate_payslip(p_payroll_id INTEGER)
        RETURNS JSON AS $$
        DECLARE
          payslip_data JSON;
        BEGIN
          SELECT json_build_object(
            'payroll_id', p.id,
            'employee', json_build_object(
              'id', e.id,
              'name', u.first_name || ' ' || u.last_name,
              'position', e.position,
              'department', d.name,
              'email', u.email
            ),
            'payment', json_build_object(
              'month', p.month,
              'year', p.year,
              'gross_amount', p.gross_amount,
              'tax_deductions', p.tax_deductions,
              'other_deductions', p.other_deductions,
              'bonuses', p.bonuses,
              'net_amount', p.net_amount
            ),
            'details', p.details,
            'processed_at', p.processed_at,
            'status', p.status
          ) INTO payslip_data
          FROM payrolls p
          JOIN employees e ON p.employee_id = e.id
          JOIN users u ON e.user_id = u.id
          JOIN departments d ON e.department_id = d.id
          WHERE p.id = p_payroll_id;
          
          RETURN payslip_data;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      console.log("Payslip generation function created successfully");
    });
  } catch (error) {
    console.error("Failed to create payslip generation function:", error);
  }
  
  // Create payroll processing function
  try {
    await database.withTransaction(async (client) => {
      await client.query(`
        CREATE OR REPLACE FUNCTION process_payroll(
          p_employee_id INTEGER,
          p_month INTEGER,
          p_year INTEGER,
          p_gross_amount VARCHAR,
          p_tax_deductions VARCHAR,
          p_other_deductions VARCHAR DEFAULT NULL,
          p_bonuses VARCHAR DEFAULT NULL,
          p_details JSONB DEFAULT NULL,
          p_processed_by INTEGER DEFAULT NULL
        ) RETURNS INTEGER AS $$
        DECLARE
          payroll_id INTEGER;
          net_amount DECIMAL;
        BEGIN
          -- Calculate net amount
          net_amount := CAST(p_gross_amount AS DECIMAL) - 
                       CAST(COALESCE(p_tax_deductions, '0') AS DECIMAL) -
                       CAST(COALESCE(p_other_deductions, '0') AS DECIMAL) +
                       CAST(COALESCE(p_bonuses, '0') AS DECIMAL);
          
          -- Create payroll record (validation happens via trigger)
          INSERT INTO payrolls (
            employee_id, month, year, 
            gross_amount, tax_deductions, other_deductions, 
            bonuses, net_amount, details, 
            status, processed_by, processed_at
          ) VALUES (
            p_employee_id, p_month, p_year,
            p_gross_amount, p_tax_deductions, p_other_deductions,
            p_bonuses, net_amount::VARCHAR, p_details,
            'completed', p_processed_by, CURRENT_TIMESTAMP
          ) RETURNING id INTO payroll_id;
          
          RETURN payroll_id;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      console.log("Payroll processing function created successfully");
    });
  } catch (error) {
    console.error("Failed to create payroll processing function:", error);
  }
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
      const user = await database.getUser(req.user!.userId);
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
      const users = await database.getAllUsers();
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
      const departments = await database.getAllDepartments();
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/departments', authenticate, authorizeAdmin, validateBody(insertDepartmentSchema), withTransaction(async (req, res) => {
    try {
      const department = await database.createDepartment(req.body);
      res.status(201).json(department);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.get('/api/departments/:id', authenticate, async (req, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const department = await database.getDepartment(departmentId);
      
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
      const department = await database.updateDepartment(departmentId, req.body);
      
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
      const success = await database.deleteDepartment(departmentId);
      
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
      const employees = await database.getAllEmployeesWithDetails();
      res.json(employees);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/employees', authenticate, withTransaction(async (req, res) => {
    try {
      let userId = req.body.userId;
      
      // If creating a new user
      if (req.body.isNewUser && !userId) {
        // Create user first
        const hashedPassword = await import('./auth').then(auth => 
          auth.hashPassword(req.body.lastName.toLowerCase() + "123") // Default password
        );
        
        const newUser = await database.createUser({
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
      
      const employee = await database.createEmployee(employeeData);
      const employeeWithDetails = await database.getEmployeeWithDetails(employee.id);
      
      res.status(201).json(employeeWithDetails);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.get('/api/employees/:id', authenticate, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await database.getEmployeeWithDetails(employeeId);
      
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
      const employee = await database.getEmployeeWithDetails(employeeId);
      
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
        
        await database.updateUser(employee.userId, userData);
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
      
      const updatedEmployee = await database.updateEmployee(employeeId, employeeData);
      const updatedEmployeeWithDetails = await database.getEmployeeWithDetails(employeeId);
      
      res.json(updatedEmployeeWithDetails);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.delete('/api/employees/:id', authenticate, authorizeAdmin, withTransaction(async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await database.getEmployee(employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      
      const success = await database.deleteEmployee(employeeId);
      
      // If we have a user associated with this employee, we could also delete the user
      // But for audit purposes, we'll keep the user record
      
      res.json({ message: 'Employee deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));
  
  // Dashboard routes
  app.get('/api/dashboard', authenticate, async (req, res) => {
    try {
      const summary = await database.getDashboardSummary();
      const departmentDistribution = await database.getDepartmentDistribution();
      
      res.json({
        summary,
        departmentDistribution
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // SQL Advanced Feature routes
  app.post('/api/sql/process-monthly-payroll', authenticate, authorizeAdmin, async (req, res) => {
    try {
      const { month, year } = req.body;
      
      if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required' });
      }
      
      // Use our transaction with savepoints to process payrolls
      const results = await database.processMonthlyPayroll(month, year, req.user!.userId);
      
      res.json({
        message: 'Monthly payroll processed successfully',
        results
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/sql/setup-access-controls', authenticate, authorizeAdmin, async (req, res) => {
    try {
      // Use our DCL function to set up payroll access controls
      await database.setupPayrollAccessControls();
      
      res.json({
        message: 'Payroll access controls set up successfully'
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/sql/generate-payslip/:id', authenticate, async (req, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      
      // Call the payslip generation function directly from PostgreSQL
      const result = await database.withTransaction(async (client) => {
        const payslipQuery = await client.query(
          `SELECT generate_payslip($1) as payslip`,
          [payrollId]
        );
        
        return payslipQuery.rows[0].payslip;
      });
      
      if (!result) {
        return res.status(404).json({ message: 'Payroll not found' });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Payroll routes
  app.get('/api/payrolls', authenticate, async (req, res) => {
    try {
      const payrolls = await database.getAllPayrolls();
      res.json(payrolls);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/payrolls/recent', authenticate, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const recentPayrolls = await database.getRecentPayrolls(limit);
      res.json(recentPayrolls);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/payrolls', authenticate, validateBody(insertPayrollSchema), withTransaction(async (req, res) => {
    try {
      // Set the user who processed this payroll
      req.body.processedBy = req.user!.userId;
      
      const payroll = await database.createPayroll(req.body);
      const payrollWithDetails = await database.getPayrollWithDetails(payroll.id);
      
      res.status(201).json(payrollWithDetails);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.get('/api/payrolls/:id', authenticate, async (req, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const payroll = await database.getPayrollWithDetails(payrollId);
      
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
      const payrolls = await database.getPayrollsByEmployeeId(employeeId);
      
      // Convert to PayrollWithDetails format
      const payrollsWithDetails = await Promise.all(
        payrolls.map(async p => await database.getPayrollWithDetails(p.id))
      );
      
      res.json(payrollsWithDetails.filter(p => p !== undefined));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/payrolls/:id', authenticate, withTransaction(async (req, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const payroll = await database.getPayroll(payrollId);
      
      if (!payroll) {
        return res.status(404).json({ message: 'Payroll not found' });
      }
      
      const updatedPayroll = await database.updatePayroll(payrollId, req.body);
      const payrollWithDetails = await database.getPayrollWithDetails(payrollId);
      
      res.json(payrollWithDetails);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }));
  
  app.delete('/api/payrolls/:id', authenticate, authorizeAdmin, withTransaction(async (req, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const payroll = await database.getPayroll(payrollId);
      
      if (!payroll) {
        return res.status(404).json({ message: 'Payroll not found' });
      }
      
      const success = await database.deletePayroll(payrollId);
      
      res.json({ message: 'Payroll deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));
  
  // Dashboard data
  app.get('/api/dashboard/summary', authenticate, async (req, res) => {
    try {
      const summary = await database.getDashboardSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/dashboard/departments', authenticate, async (req, res) => {
    try {
      const departments = await database.getDepartmentDistribution();
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
