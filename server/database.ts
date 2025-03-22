import pg from 'pg';
const { Pool } = pg;
type PoolClient = pg.PoolClient;
import { User, Department, Employee, Payroll, InsertUser, InsertDepartment, InsertEmployee, InsertPayroll, EmployeeWithDetails, PayrollWithDetails } from '@shared/schema';
import dotenv from 'dotenv';
dotenv.config();

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:{
    rejectUnauthorized: false
  }
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to PostgreSQL database at:', res.rows[0].now);
  }
});

// Initialize database
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'employee',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create departments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL
      )
    `);
    
    // Create employees table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NULL REFERENCES users(id),
        department_id INTEGER NULL REFERENCES departments(id),
        position VARCHAR(100) NOT NULL,
        tax_id VARCHAR(50) NOT NULL,
        tax_status VARCHAR(50) NOT NULL,
        bank_name VARCHAR(100) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        routing_number VARCHAR(50) NOT NULL,
        base_salary VARCHAR(50) NOT NULL,
        join_date DATE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active'
      )
    `);
    
    // Create payrolls table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payrolls (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        gross_amount VARCHAR(50) NOT NULL,
        tax_deductions VARCHAR(50) NOT NULL,
        other_deductions VARCHAR(50) NULL,
        net_amount VARCHAR(50) NOT NULL,
        bonuses VARCHAR(50) NULL,
        details JSONB NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        processed_at TIMESTAMP NULL,
        processed_by INTEGER NULL REFERENCES users(id)
      )
    `);
    
    // Check if admin user exists
    const adminCheck = await client.query(`
      SELECT id FROM users WHERE username = 'admin'
    `);
    
    // Create admin user if not exists
    if (adminCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO users (username, password, first_name, last_name, email, role)
        VALUES ('admin', '$2a$10$fviJooARV6U0WBEBmxepQOnp44mZlPF2x1Tr/h.D7VFhCbEu3CAx6', 'Admin', 'User', 'admin@example.com', 'admin')
      `);
    }
    
    // Add sample departments if not exists
    const deptCheck = await client.query(`
      SELECT COUNT(*) FROM departments
    `);
    
    if (parseInt(deptCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO departments (name, description)
        VALUES 
          ('IT', 'Information Technology'),
          ('HR', 'Human Resources'),
          ('Marketing', 'Marketing and Communications'),
          ('Finance', 'Finance and Accounting')
      `);
    }
    
    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

// Execute database initialization
initDatabase();

// Database operations
export class SQLDatabase {
  // Transaction helper
  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await pool.query(`
      SELECT id, username, password, first_name AS "firstName", last_name AS "lastName", 
             email, phone, role, created_at AS "createdAt"
      FROM users
      WHERE id = $1
    `, [id]);
    
    return result.rowCount && result.rowCount > 0 ? result.rows[0] : undefined;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await pool.query(`
      SELECT id, username, password, first_name AS "firstName", last_name AS "lastName", 
             email, phone, role, created_at AS "createdAt"
      FROM users
      WHERE LOWER(username) = LOWER($1)
    `, [username]);
    
    return result.rowCount && result.rowCount > 0 ? result.rows[0] : undefined;
  }
  
  async getAllUsers(): Promise<User[]> {
    const result = await pool.query(`
      SELECT id, username, password, first_name AS "firstName", last_name AS "lastName", 
             email, phone, role, created_at AS "createdAt"
      FROM users
      ORDER BY id
    `);
    
    return result.rows;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withTransaction(async (client) => {
      const result = await client.query(`
        INSERT INTO users (username, password, first_name, last_name, email, phone, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, username, password, first_name AS "firstName", last_name AS "lastName", 
                 email, phone, role, created_at AS "createdAt"
      `, [
        insertUser.username,
        insertUser.password,
        insertUser.firstName,
        insertUser.lastName,
        insertUser.email,
        insertUser.phone,
        insertUser.role || 'employee'
      ]);
      
      return result.rows[0];
    });
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    return this.withTransaction(async (client) => {
      // Build SET clause dynamically based on provided fields
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      if (userData.firstName !== undefined) {
        updates.push(`first_name = $${paramCount++}`);
        values.push(userData.firstName);
      }
      
      if (userData.lastName !== undefined) {
        updates.push(`last_name = $${paramCount++}`);
        values.push(userData.lastName);
      }
      
      if (userData.email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(userData.email);
      }
      
      if (userData.phone !== undefined) {
        updates.push(`phone = $${paramCount++}`);
        values.push(userData.phone);
      }
      
      if (userData.role !== undefined) {
        updates.push(`role = $${paramCount++}`);
        values.push(userData.role);
      }
      
      if (userData.password !== undefined) {
        updates.push(`password = $${paramCount++}`);
        values.push(userData.password);
      }
      
      if (updates.length === 0) {
        // No fields to update
        return this.getUser(id);
      }
      
      // Add id as the last parameter
      values.push(id);
      
      const result = await client.query(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, password, first_name AS "firstName", last_name AS "lastName", 
                 email, phone, role, created_at AS "createdAt"
      `, values);
      
      return result.rowCount > 0 ? result.rows[0] : undefined;
    });
  }
  
  // Department operations
  async getDepartment(id: number): Promise<Department | undefined> {
    const result = await pool.query(`
      SELECT id, name, description
      FROM departments
      WHERE id = $1
    `, [id]);
    
    return result.rowCount > 0 ? result.rows[0] : undefined;
  }
  
  async getDepartmentByName(name: string): Promise<Department | undefined> {
    const result = await pool.query(`
      SELECT id, name, description
      FROM departments
      WHERE LOWER(name) = LOWER($1)
    `, [name]);
    
    return result.rowCount > 0 ? result.rows[0] : undefined;
  }
  
  async getAllDepartments(): Promise<Department[]> {
    const result = await pool.query(`
      SELECT id, name, description
      FROM departments
      ORDER BY name
    `);
    
    return result.rows;
  }
  
  async createDepartment(department: InsertDepartment): Promise<Department> {
    return this.withTransaction(async (client) => {
      const result = await client.query(`
        INSERT INTO departments (name, description)
        VALUES ($1, $2)
        RETURNING id, name, description
      `, [
        department.name,
        department.description
      ]);
      
      return result.rows[0];
    });
  }
  
  async updateDepartment(id: number, departmentData: Partial<Department>): Promise<Department | undefined> {
    return this.withTransaction(async (client) => {
      // Build SET clause dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      if (departmentData.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(departmentData.name);
      }
      
      if (departmentData.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(departmentData.description);
      }
      
      if (updates.length === 0) {
        return this.getDepartment(id);
      }
      
      values.push(id);
      
      const result = await client.query(`
        UPDATE departments
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, description
      `, values);
      
      return result.rowCount > 0 ? result.rows[0] : undefined;
    });
  }
  
  async deleteDepartment(id: number): Promise<boolean> {
    return this.withTransaction(async (client) => {
      // Check if department has employees
      const empCheck = await client.query(`
        SELECT COUNT(*) FROM employees
        WHERE department_id = $1
      `, [id]);
      
      if (parseInt(empCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete department with assigned employees');
      }
      
      const result = await client.query(`
        DELETE FROM departments
        WHERE id = $1
      `, [id]);
      
      return result.rowCount > 0;
    });
  }
  
  // Employee operations
  async getEmployee(id: number): Promise<Employee | undefined> {
    const result = await pool.query(`
      SELECT id, user_id AS "userId", department_id AS "departmentId", position,
             tax_id AS "taxId", tax_status AS "taxStatus", bank_name AS "bankName",
             account_number AS "accountNumber", routing_number AS "routingNumber",
             base_salary AS "baseSalary", join_date AS "joinDate", status
      FROM employees
      WHERE id = $1
    `, [id]);
    
    return result.rowCount > 0 ? result.rows[0] : undefined;
  }
  
  async getEmployeeWithDetails(id: number): Promise<EmployeeWithDetails | undefined> {
    const result = await pool.query(`
      SELECT 
        e.id, e.user_id AS "userId", e.department_id AS "departmentId", e.position,
        e.tax_id AS "taxId", e.tax_status AS "taxStatus", e.bank_name AS "bankName",
        e.account_number AS "accountNumber", e.routing_number AS "routingNumber",
        e.base_salary AS "baseSalary", e.join_date AS "joinDate", e.status,
        u.id AS "user.id", u.username AS "user.username", 
        u.first_name AS "user.firstName", u.last_name AS "user.lastName",
        u.email AS "user.email", u.phone AS "user.phone", u.role AS "user.role",
        u.created_at AS "user.createdAt",
        d.id AS "department.id", d.name AS "department.name", 
        d.description AS "department.description"
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = $1
    `, [id]);
    
    if (result.rowCount === 0) return undefined;
    
    // Transform the flat result into nested object
    const row = result.rows[0];
    
    const employee: EmployeeWithDetails = {
      id: row.id,
      userId: row.userId,
      departmentId: row.departmentId,
      position: row.position,
      taxId: row.taxId,
      taxStatus: row.taxStatus,
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      routingNumber: row.routingNumber,
      baseSalary: row.baseSalary,
      joinDate: row.joinDate,
      status: row.status,
      user: {
        id: row['user.id'],
        username: row['user.username'],
        password: '', // We don't return the password
        firstName: row['user.firstName'],
        lastName: row['user.lastName'],
        email: row['user.email'],
        phone: row['user.phone'],
        role: row['user.role'],
        createdAt: row['user.createdAt']
      },
      department: {
        id: row['department.id'],
        name: row['department.name'],
        description: row['department.description']
      }
    };
    
    return employee;
  }
  
  async getAllEmployees(): Promise<Employee[]> {
    const result = await pool.query(`
      SELECT id, user_id AS "userId", department_id AS "departmentId", position,
             tax_id AS "taxId", tax_status AS "taxStatus", bank_name AS "bankName",
             account_number AS "accountNumber", routing_number AS "routingNumber",
             base_salary AS "baseSalary", join_date AS "joinDate", status
      FROM employees
      ORDER BY id
    `);
    
    return result.rows;
  }
  
  async getAllEmployeesWithDetails(): Promise<EmployeeWithDetails[]> {
    const result = await pool.query(`
      SELECT 
        e.id, e.user_id AS "userId", e.department_id AS "departmentId", e.position,
        e.tax_id AS "taxId", e.tax_status AS "taxStatus", e.bank_name AS "bankName",
        e.account_number AS "accountNumber", e.routing_number AS "routingNumber",
        e.base_salary AS "baseSalary", e.join_date AS "joinDate", e.status,
        u.id AS "user.id", u.username AS "user.username", 
        u.first_name AS "user.firstName", u.last_name AS "user.lastName",
        u.email AS "user.email", u.phone AS "user.phone", u.role AS "user.role",
        u.created_at AS "user.createdAt",
        d.id AS "department.id", d.name AS "department.name", 
        d.description AS "department.description"
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY e.id
    `);
    
    // Transform the flat results into nested objects
    return result.rows.map(row => ({
      id: row.id,
      userId: row.userId,
      departmentId: row.departmentId,
      position: row.position,
      taxId: row.taxId,
      taxStatus: row.taxStatus,
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      routingNumber: row.routingNumber,
      baseSalary: row.baseSalary,
      joinDate: row.joinDate,
      status: row.status,
      user: {
        id: row['user.id'],
        username: row['user.username'],
        password: '', // We don't return the password
        firstName: row['user.firstName'],
        lastName: row['user.lastName'],
        email: row['user.email'],
        phone: row['user.phone'],
        role: row['user.role'],
        createdAt: row['user.createdAt']
      },
      department: {
        id: row['department.id'],
        name: row['department.name'],
        description: row['department.description']
      }
    }));
  }
  
  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    return this.withTransaction(async (client) => {
      const result = await client.query(`
        INSERT INTO employees (
          user_id, department_id, position, tax_id, tax_status, 
          bank_name, account_number, routing_number, base_salary, join_date, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, user_id AS "userId", department_id AS "departmentId", position,
                 tax_id AS "taxId", tax_status AS "taxStatus", bank_name AS "bankName",
                 account_number AS "accountNumber", routing_number AS "routingNumber",
                 base_salary AS "baseSalary", join_date AS "joinDate", status
      `, [
        employee.userId,
        employee.departmentId,
        employee.position,
        employee.taxId,
        employee.taxStatus,
        employee.bankName,
        employee.accountNumber,
        employee.routingNumber,
        employee.baseSalary,
        employee.joinDate,
        employee.status || 'active'
      ]);
      
      return result.rows[0];
    });
  }
  
  async updateEmployee(id: number, employeeData: Partial<Employee>): Promise<Employee | undefined> {
    return this.withTransaction(async (client) => {
      // Build SET clause dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      if (employeeData.userId !== undefined) {
        updates.push(`user_id = $${paramCount++}`);
        values.push(employeeData.userId);
      }
      
      if (employeeData.departmentId !== undefined) {
        updates.push(`department_id = $${paramCount++}`);
        values.push(employeeData.departmentId);
      }
      
      if (employeeData.position !== undefined) {
        updates.push(`position = $${paramCount++}`);
        values.push(employeeData.position);
      }
      
      if (employeeData.taxId !== undefined) {
        updates.push(`tax_id = $${paramCount++}`);
        values.push(employeeData.taxId);
      }
      
      if (employeeData.taxStatus !== undefined) {
        updates.push(`tax_status = $${paramCount++}`);
        values.push(employeeData.taxStatus);
      }
      
      if (employeeData.bankName !== undefined) {
        updates.push(`bank_name = $${paramCount++}`);
        values.push(employeeData.bankName);
      }
      
      if (employeeData.accountNumber !== undefined) {
        updates.push(`account_number = $${paramCount++}`);
        values.push(employeeData.accountNumber);
      }
      
      if (employeeData.routingNumber !== undefined) {
        updates.push(`routing_number = $${paramCount++}`);
        values.push(employeeData.routingNumber);
      }
      
      if (employeeData.baseSalary !== undefined) {
        updates.push(`base_salary = $${paramCount++}`);
        values.push(employeeData.baseSalary);
      }
      
      if (employeeData.joinDate !== undefined) {
        updates.push(`join_date = $${paramCount++}`);
        values.push(employeeData.joinDate);
      }
      
      if (employeeData.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(employeeData.status);
      }
      
      if (updates.length === 0) {
        return this.getEmployee(id);
      }
      
      values.push(id);
      
      const result = await client.query(`
        UPDATE employees
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, user_id AS "userId", department_id AS "departmentId", position,
                 tax_id AS "taxId", tax_status AS "taxStatus", bank_name AS "bankName",
                 account_number AS "accountNumber", routing_number AS "routingNumber",
                 base_salary AS "baseSalary", join_date AS "joinDate", status
      `, values);
      
      return result.rowCount > 0 ? result.rows[0] : undefined;
    });
  }
  
  async deleteEmployee(id: number): Promise<boolean> {
    return this.withTransaction(async (client) => {
      // First delete all payrolls for this employee
      await client.query(`
        DELETE FROM payrolls
        WHERE employee_id = $1
      `, [id]);
      
      // Then delete the employee
      const result = await client.query(`
        DELETE FROM employees
        WHERE id = $1
      `, [id]);
      
      return result.rowCount > 0;
    });
  }
  
  // Payroll operations
  async getPayroll(id: number): Promise<Payroll | undefined> {
    const result = await pool.query(`
      SELECT id, employee_id AS "employeeId", month, year, 
             gross_amount AS "grossAmount", tax_deductions AS "taxDeductions",
             other_deductions AS "otherDeductions", net_amount AS "netAmount",
             bonuses, details, status, processed_at AS "processedAt",
             processed_by AS "processedBy"
      FROM payrolls
      WHERE id = $1
    `, [id]);
    
    return result.rowCount > 0 ? result.rows[0] : undefined;
  }
  
  async getPayrollWithDetails(id: number): Promise<PayrollWithDetails | undefined> {
    const result = await pool.query(`
      SELECT 
        p.id, p.employee_id AS "employeeId", p.month, p.year, 
        p.gross_amount AS "grossAmount", p.tax_deductions AS "taxDeductions",
        p.other_deductions AS "otherDeductions", p.net_amount AS "netAmount",
        p.bonuses, p.details, p.status, p.processed_at AS "processedAt",
        p.processed_by AS "processedBy",
        e.id AS "employee.id", e.user_id AS "employee.userId", 
        e.department_id AS "employee.departmentId", e.position AS "employee.position",
        e.tax_id AS "employee.taxId", e.tax_status AS "employee.taxStatus", 
        e.bank_name AS "employee.bankName", e.account_number AS "employee.accountNumber", 
        e.routing_number AS "employee.routingNumber", e.base_salary AS "employee.baseSalary",
        e.join_date AS "employee.joinDate", e.status AS "employee.status",
        u.id AS "employee.user.id", u.username AS "employee.user.username", 
        u.first_name AS "employee.user.firstName", u.last_name AS "employee.user.lastName",
        u.email AS "employee.user.email", u.phone AS "employee.user.phone", 
        u.role AS "employee.user.role", u.created_at AS "employee.user.createdAt",
        d.id AS "employee.department.id", d.name AS "employee.department.name", 
        d.description AS "employee.department.description"
      FROM payrolls p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE p.id = $1
    `, [id]);
    
    if (result.rowCount === 0) return undefined;
    
    // Transform the flat result into nested object
    const row = result.rows[0];
    
    const payroll: PayrollWithDetails = {
      id: row.id,
      employeeId: row.employeeId,
      month: row.month,
      year: row.year,
      grossAmount: row.grossAmount,
      taxDeductions: row.taxDeductions,
      otherDeductions: row.otherDeductions,
      netAmount: row.netAmount,
      bonuses: row.bonuses,
      details: row.details,
      status: row.status,
      processedAt: row.processedAt,
      processedBy: row.processedBy,
      employee: {
        id: row['employee.id'],
        userId: row['employee.userId'],
        departmentId: row['employee.departmentId'],
        position: row['employee.position'],
        taxId: row['employee.taxId'],
        taxStatus: row['employee.taxStatus'],
        bankName: row['employee.bankName'],
        accountNumber: row['employee.accountNumber'],
        routingNumber: row['employee.routingNumber'],
        baseSalary: row['employee.baseSalary'],
        joinDate: row['employee.joinDate'],
        status: row['employee.status'],
        user: {
          id: row['employee.user.id'],
          username: row['employee.user.username'],
          password: '', // We don't return the password
          firstName: row['employee.user.firstName'],
          lastName: row['employee.user.lastName'],
          email: row['employee.user.email'],
          phone: row['employee.user.phone'],
          role: row['employee.user.role'],
          createdAt: row['employee.user.createdAt']
        },
        department: {
          id: row['employee.department.id'],
          name: row['employee.department.name'],
          description: row['employee.department.description']
        }
      }
    };
    
    return payroll;
  }
  
  async getAllPayrolls(): Promise<Payroll[]> {
    const result = await pool.query(`
      SELECT id, employee_id AS "employeeId", month, year, 
             gross_amount AS "grossAmount", tax_deductions AS "taxDeductions",
             other_deductions AS "otherDeductions", net_amount AS "netAmount",
             bonuses, details, status, processed_at AS "processedAt",
             processed_by AS "processedBy"
      FROM payrolls
      ORDER BY year DESC, month DESC, id DESC
    `);
    
    return result.rows;
  }
  
  async getPayrollsByEmployeeId(employeeId: number): Promise<Payroll[]> {
    const result = await pool.query(`
      SELECT id, employee_id AS "employeeId", month, year, 
             gross_amount AS "grossAmount", tax_deductions AS "taxDeductions",
             other_deductions AS "otherDeductions", net_amount AS "netAmount",
             bonuses, details, status, processed_at AS "processedAt",
             processed_by AS "processedBy"
      FROM payrolls
      WHERE employee_id = $1
      ORDER BY year DESC, month DESC, id DESC
    `, [employeeId]);
    
    return result.rows;
  }
  
  async getPayrollsByMonth(month: number, year: number): Promise<Payroll[]> {
    const result = await pool.query(`
      SELECT id, employee_id AS "employeeId", month, year, 
             gross_amount AS "grossAmount", tax_deductions AS "taxDeductions",
             other_deductions AS "otherDeductions", net_amount AS "netAmount",
             bonuses, details, status, processed_at AS "processedAt",
             processed_by AS "processedBy"
      FROM payrolls
      WHERE month = $1 AND year = $2
      ORDER BY id
    `, [month, year]);
    
    return result.rows;
  }
  
  async getRecentPayrolls(limit: number): Promise<PayrollWithDetails[]> {
    const result = await pool.query(`
      SELECT 
        p.id, p.employee_id AS "employeeId", p.month, p.year, 
        p.gross_amount AS "grossAmount", p.tax_deductions AS "taxDeductions",
        p.other_deductions AS "otherDeductions", p.net_amount AS "netAmount",
        p.bonuses, p.details, p.status, p.processed_at AS "processedAt",
        p.processed_by AS "processedBy",
        e.id AS "employee.id", e.user_id AS "employee.userId", 
        e.department_id AS "employee.departmentId", e.position AS "employee.position",
        e.tax_id AS "employee.taxId", e.tax_status AS "employee.taxStatus", 
        e.bank_name AS "employee.bankName", e.account_number AS "employee.accountNumber", 
        e.routing_number AS "employee.routingNumber", e.base_salary AS "employee.baseSalary",
        e.join_date AS "employee.joinDate", e.status AS "employee.status",
        u.id AS "employee.user.id", u.username AS "employee.user.username", 
        u.first_name AS "employee.user.firstName", u.last_name AS "employee.user.lastName",
        u.email AS "employee.user.email", u.phone AS "employee.user.phone", 
        u.role AS "employee.user.role", u.created_at AS "employee.user.createdAt",
        d.id AS "employee.department.id", d.name AS "employee.department.name", 
        d.description AS "employee.department.description"
      FROM payrolls p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY p.processed_at DESC NULLS LAST, p.id DESC
      LIMIT $1
    `, [limit]);
    
    // Transform the flat results into nested objects
    return result.rows.map(row => ({
      id: row.id,
      employeeId: row.employeeId,
      month: row.month,
      year: row.year,
      grossAmount: row.grossAmount,
      taxDeductions: row.taxDeductions,
      otherDeductions: row.otherDeductions,
      netAmount: row.netAmount,
      bonuses: row.bonuses,
      details: row.details,
      status: row.status,
      processedAt: row.processedAt,
      processedBy: row.processedBy,
      employee: {
        id: row['employee.id'],
        userId: row['employee.userId'],
        departmentId: row['employee.departmentId'],
        position: row['employee.position'],
        taxId: row['employee.taxId'],
        taxStatus: row['employee.taxStatus'],
        bankName: row['employee.bankName'],
        accountNumber: row['employee.accountNumber'],
        routingNumber: row['employee.routingNumber'],
        baseSalary: row['employee.baseSalary'],
        joinDate: row['employee.joinDate'],
        status: row['employee.status'],
        user: {
          id: row['employee.user.id'],
          username: row['employee.user.username'],
          password: '', // We don't return the password
          firstName: row['employee.user.firstName'],
          lastName: row['employee.user.lastName'],
          email: row['employee.user.email'],
          phone: row['employee.user.phone'],
          role: row['employee.user.role'],
          createdAt: row['employee.user.createdAt']
        },
        department: {
          id: row['employee.department.id'],
          name: row['employee.department.name'],
          description: row['employee.department.description']
        }
      }
    }));
  }
  
  async createPayroll(payroll: InsertPayroll): Promise<Payroll> {
    return this.withTransaction(async (client) => {
      // Calculate net amount if not provided
      let netAmount = payroll.netAmount;
      if (!netAmount) {
        const grossAmount = parseFloat(payroll.grossAmount);
        const taxDeductions = parseFloat(payroll.taxDeductions);
        const otherDeductions = payroll.otherDeductions ? parseFloat(payroll.otherDeductions) : 0;
        const bonuses = payroll.bonuses ? parseFloat(payroll.bonuses) : 0;
        
        netAmount = (grossAmount - taxDeductions - otherDeductions + bonuses);
      }
      
      const result = await client.query(`
        INSERT INTO payrolls (
          employee_id, month, year, gross_amount, tax_deductions,
          other_deductions, net_amount, bonuses, details, status,
          processed_at, processed_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, employee_id AS "employeeId", month, year, 
                 gross_amount AS "grossAmount", tax_deductions AS "taxDeductions",
                 other_deductions AS "otherDeductions", net_amount AS "netAmount",
                 bonuses, details, status, processed_at AS "processedAt",
                 processed_by AS "processedBy"
      `, [
        payroll.employeeId,
        payroll.month,
        payroll.year,
        payroll.grossAmount,
        payroll.taxDeductions,
        payroll.otherDeductions,
        netAmount,
        payroll.bonuses,
        payroll.details,
        payroll.status || 'pending',
        payroll.processedAt || new Date(),
        payroll.processedBy
      ]);
      
      return result.rows[0];
    });
  }
  
  async updatePayroll(id: number, payrollData: Partial<Payroll>): Promise<Payroll | undefined> {
    return this.withTransaction(async (client) => {
      // Build SET clause dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      if (payrollData.employeeId !== undefined) {
        updates.push(`employee_id = $${paramCount++}`);
        values.push(payrollData.employeeId);
      }
      
      if (payrollData.month !== undefined) {
        updates.push(`month = $${paramCount++}`);
        values.push(payrollData.month);
      }
      
      if (payrollData.year !== undefined) {
        updates.push(`year = $${paramCount++}`);
        values.push(payrollData.year);
      }
      
      if (payrollData.grossAmount !== undefined) {
        updates.push(`gross_amount = $${paramCount++}`);
        values.push(payrollData.grossAmount);
      }
      
      if (payrollData.taxDeductions !== undefined) {
        updates.push(`tax_deductions = $${paramCount++}`);
        values.push(payrollData.taxDeductions);
      }
      
      if (payrollData.otherDeductions !== undefined) {
        updates.push(`other_deductions = $${paramCount++}`);
        values.push(payrollData.otherDeductions);
      }
      
      if (payrollData.netAmount !== undefined) {
        updates.push(`net_amount = $${paramCount++}`);
        values.push(payrollData.netAmount);
      }
      
      if (payrollData.bonuses !== undefined) {
        updates.push(`bonuses = $${paramCount++}`);
        values.push(payrollData.bonuses);
      }
      
      if (payrollData.details !== undefined) {
        updates.push(`details = $${paramCount++}`);
        values.push(payrollData.details);
      }
      
      if (payrollData.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(payrollData.status);
      }
      
      if (payrollData.processedAt !== undefined) {
        updates.push(`processed_at = $${paramCount++}`);
        values.push(payrollData.processedAt);
      }
      
      if (payrollData.processedBy !== undefined) {
        updates.push(`processed_by = $${paramCount++}`);
        values.push(payrollData.processedBy);
      }
      
      if (updates.length === 0) {
        return this.getPayroll(id);
      }
      
      values.push(id);
      
      const result = await client.query(`
        UPDATE payrolls
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, employee_id AS "employeeId", month, year, 
                 gross_amount AS "grossAmount", tax_deductions AS "taxDeductions",
                 other_deductions AS "otherDeductions", net_amount AS "netAmount",
                 bonuses, details, status, processed_at AS "processedAt",
                 processed_by AS "processedBy"
      `, values);
      
      return result.rowCount > 0 ? result.rows[0] : undefined;
    });
  }
  
  async deletePayroll(id: number): Promise<boolean> {
    return this.withTransaction(async (client) => {
      const result = await client.query(`
        DELETE FROM payrolls
        WHERE id = $1
      `, [id]);
      
      return result.rowCount > 0;
    });
  }
  
  // Dashboard data
  async getDashboardSummary(): Promise<any> {
    return this.withTransaction(async (client) => {
      // Get total employees
      const empCount = await client.query(`
        SELECT COUNT(*) FROM employees
        WHERE status = 'active'
      `);
      const employeeCount = parseInt(empCount.rows[0].count);
      
      // Calculate total payroll for current month
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // Try using payroll_summary_view if it exists
      let totalPayroll, averageSalary;
      try {
        // Get data from our specialized view
        const summaryView = await client.query(`
          SELECT * FROM payroll_summary_view
          WHERE month = $1 AND year = $2
        `, [currentMonth, currentYear]);
        
        if (summaryView.rows.length > 0) {
          totalPayroll = parseFloat(summaryView.rows[0].total_payroll || '0');
          averageSalary = parseFloat(summaryView.rows[0].average_salary || '0');
        } else {
          // Fallback to standard queries if no data for current month/year
          const payrollSum = await client.query(`
            SELECT COALESCE(SUM(CAST(net_amount AS DECIMAL)), 0) AS total
            FROM payrolls
            WHERE month = $1 AND year = $2
          `, [currentMonth, currentYear]);
          totalPayroll = parseFloat(payrollSum.rows[0].total);
          
          // Calculate average salary
          const avgSalary = await client.query(`
            SELECT COALESCE(AVG(CAST(base_salary AS DECIMAL)), 0) AS average
            FROM employees
            WHERE status = 'active'
          `);
          averageSalary = parseFloat(avgSalary.rows[0].average);
        }
      } catch (error) {
        // If view doesn't exist, fallback to standard queries
        const payrollSum = await client.query(`
          SELECT COALESCE(SUM(CAST(net_amount AS DECIMAL)), 0) AS total
          FROM payrolls
          WHERE month = $1 AND year = $2
        `, [currentMonth, currentYear]);
        totalPayroll = parseFloat(payrollSum.rows[0].total);
        
        // Calculate average salary
        const avgSalary = await client.query(`
          SELECT COALESCE(AVG(CAST(base_salary AS DECIMAL)), 0) AS average
          FROM employees
          WHERE status = 'active'
        `);
        averageSalary = parseFloat(avgSalary.rows[0].average);
      }
      
      // Count pending payrolls
      const pendingCount = await client.query(`
        SELECT COUNT(*) FROM payrolls
        WHERE status = 'pending'
      `);
      
      return {
        employeeCount,
        totalPayroll,
        averageSalary,
        pendingCount: parseInt(pendingCount.rows[0].count)
      };
    });
  }
  
  async getDepartmentDistribution(): Promise<any> {
    return this.withTransaction(async (client) => {
      // Get employee count by department
      const empCount = await client.query(`
        SELECT e.department_id, d.name, COUNT(*) as count
        FROM employees e
        JOIN departments d ON e.department_id = d.id
        WHERE e.status = 'active'
        GROUP BY e.department_id, d.name
        ORDER BY count DESC
      `);
      
      // Get total employee count for percentage calculation
      const totalCount = await client.query(`
        SELECT COUNT(*) FROM employees
        WHERE status = 'active'
      `);
      const total = parseInt(totalCount.rows[0].count);
      
      // Calculate percentages
      return empCount.rows.map((row: any) => ({
        id: row.department_id,
        name: row.name,
        count: parseInt(row.count),
        percentage: total > 0 ? Math.round((parseInt(row.count) / total) * 100) : 0
      }));
    });
  }
  
  // SQL Examples (for educational purposes)
  
  // DDL - Data Definition Language
  async showDDLExamples(): Promise<void> {
    // These are just examples, not meant to be executed directly
    console.log("CREATE TABLE Example:", `
      CREATE TABLE employees (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        hire_date DATE NOT NULL
      )
    `);
    
    console.log("ALTER TABLE Example:", `
      ALTER TABLE employees
      ADD COLUMN salary DECIMAL(10,2)
    `);
    
    console.log("DROP TABLE Example:", `
      DROP TABLE IF EXISTS temp_employees
    `);
    
    console.log("CREATE INDEX Example:", `
      CREATE INDEX idx_employee_name
      ON employees(first_name)
    `);
  }
  
  // DML - Data Manipulation Language
  async showDMLExamples(): Promise<void> {
    // These are just examples, not meant to be executed directly
    console.log("INSERT Example:", `
      INSERT INTO employees (first_name, hire_date, salary)
      VALUES ('John Doe', '2023-01-15', 75000.00)
    `);
    
    console.log("UPDATE Example:", `
      UPDATE employees
      SET salary = 80000.00
      WHERE id = 1
    `);
    
    console.log("DELETE Example:", `
      DELETE FROM employees
      WHERE id = 2
    `);
    
    console.log("SELECT Example:", `
      SELECT e.id, e.first_name, d.name as department
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      WHERE e.salary > 70000
      ORDER BY e.salary DESC
    `);
  }
  
  // DCL - Data Control Language
  async showDCLExamples(): Promise<void> {
    // These are just examples, not meant to be executed directly
    console.log("GRANT Example:", `
      GRANT SELECT, INSERT ON employees TO payroll_user
    `);
    
    console.log("REVOKE Example:", `
      REVOKE DELETE ON employees FROM payroll_user
    `);
    
    console.log("ROLE Example:", `
      CREATE ROLE payroll_admin
    `);
  }
  
  // TCL - Transaction Control Language
  async showTCLExamples(): Promise<void> {
    // These are just examples, not meant to be executed directly
    console.log("BEGIN TRANSACTION Example:", `
      BEGIN;
      INSERT INTO employees (first_name, hire_date, salary)
      VALUES ('Jane Smith', '2023-02-15', 85000.00);
      UPDATE departments SET budget = budget - 85000.00 WHERE id = 1;
      COMMIT;
    `);
    
    console.log("SAVEPOINT Example:", `
      BEGIN;
      SAVEPOINT before_change;
      UPDATE employees SET salary = 90000.00 WHERE id = 1;
      -- If something goes wrong
      ROLLBACK TO before_change;
      COMMIT;
    `);
  }
  
  // Advanced transaction with savepoints - Process monthly payroll
  async processMonthlyPayroll(month: number, year: number, processedBy: number): Promise<any[]> {
    return this.withTransaction(async (client) => {
      try {
        // Call our PostgreSQL function directly
        const result = await client.query(
          `SELECT * FROM process_monthly_payroll($1, $2, $3)`,
          [month, year, processedBy]
        );
        
        return result.rows;
      } catch (error: any) {
        console.error('Error processing monthly payroll:', error.message);
        throw new Error(`Failed to process monthly payroll: ${error.message}`);
      }
    });
  }
  
  // Setup payroll access controls using DCL
  async setupPayrollAccessControls(): Promise<void> {
    return this.withTransaction(async (client) => {
      try {
        // Call our PostgreSQL function directly
        await client.query(`SELECT setup_payroll_access_controls()`);
        
        return;
      } catch (error: any) {
        console.error('Error setting up payroll access controls:', error.message);
        throw new Error(`Failed to set up payroll access controls: ${error.message}`);
      }
    });
  }
}

export const database = new SQLDatabase();