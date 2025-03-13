import { 
  users, 
  departments, 
  employees, 
  payrolls, 
  type User, 
  type InsertUser, 
  type Department, 
  type InsertDepartment,
  type Employee,
  type InsertEmployee,
  type Payroll,
  type InsertPayroll,
  type EmployeeWithDetails,
  type PayrollWithDetails
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  
  // Department operations
  getDepartment(id: number): Promise<Department | undefined>;
  getDepartmentByName(name: string): Promise<Department | undefined>;
  getAllDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, department: Partial<Department>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;
  
  // Employee operations
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeWithDetails(id: number): Promise<EmployeeWithDetails | undefined>;
  getAllEmployees(): Promise<Employee[]>;
  getAllEmployeesWithDetails(): Promise<EmployeeWithDetails[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<Employee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;
  
  // Payroll operations
  getPayroll(id: number): Promise<Payroll | undefined>;
  getPayrollWithDetails(id: number): Promise<PayrollWithDetails | undefined>;
  getAllPayrolls(): Promise<Payroll[]>;
  getPayrollsByEmployeeId(employeeId: number): Promise<Payroll[]>;
  getPayrollsByMonth(month: number, year: number): Promise<Payroll[]>;
  getRecentPayrolls(limit: number): Promise<PayrollWithDetails[]>;
  createPayroll(payroll: InsertPayroll): Promise<Payroll>;
  updatePayroll(id: number, payroll: Partial<Payroll>): Promise<Payroll | undefined>;
  deletePayroll(id: number): Promise<boolean>;
  
  // Dashboard data
  getDashboardSummary(): Promise<any>;
  getDepartmentDistribution(): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private departments: Map<number, Department>;
  private employees: Map<number, Employee>;
  private payrolls: Map<number, Payroll>;
  
  private userIdCounter: number;
  private departmentIdCounter: number;
  private employeeIdCounter: number;
  private payrollIdCounter: number;

  constructor() {
    this.users = new Map();
    this.departments = new Map();
    this.employees = new Map();
    this.payrolls = new Map();
    
    this.userIdCounter = 1;
    this.departmentIdCounter = 1;
    this.employeeIdCounter = 1;
    this.payrollIdCounter = 1;
    
    // Initialize with sample data
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Add departments
    const departments = [
      { name: "Engineering", description: "Software development and IT" },
      { name: "Sales", description: "Sales and business development" },
      { name: "Marketing", description: "Marketing and communications" },
      { name: "Finance", description: "Finance and accounting" },
      { name: "HR", description: "Human resources" }
    ];
    
    departments.forEach(dept => {
      this.createDepartment(dept);
    });
    
    // Add an admin user
    this.createUser({
      username: "admin",
      password: "$2b$10$oQE/f1J.fbXILyzDhNB6tuUB6Z/ahB9wNUxfmCd0WE.XZ9gZe.m1i", // hashed 'password'
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      phone: "555-123-4567",
      role: "admin"
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const createdAt = new Date();
    const user: User = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // Department operations
  async getDepartment(id: number): Promise<Department | undefined> {
    return this.departments.get(id);
  }
  
  async getDepartmentByName(name: string): Promise<Department | undefined> {
    return Array.from(this.departments.values()).find(
      (dept) => dept.name.toLowerCase() === name.toLowerCase()
    );
  }
  
  async getAllDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }
  
  async createDepartment(department: InsertDepartment): Promise<Department> {
    const id = this.departmentIdCounter++;
    const newDepartment: Department = { ...department, id };
    this.departments.set(id, newDepartment);
    return newDepartment;
  }
  
  async updateDepartment(id: number, departmentData: Partial<Department>): Promise<Department | undefined> {
    const department = this.departments.get(id);
    if (!department) return undefined;
    
    const updatedDepartment = { ...department, ...departmentData };
    this.departments.set(id, updatedDepartment);
    return updatedDepartment;
  }
  
  async deleteDepartment(id: number): Promise<boolean> {
    return this.departments.delete(id);
  }
  
  // Employee operations
  async getEmployee(id: number): Promise<Employee | undefined> {
    return this.employees.get(id);
  }
  
  async getEmployeeWithDetails(id: number): Promise<EmployeeWithDetails | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    
    const user = employee.userId ? await this.getUser(employee.userId) : undefined;
    const department = employee.departmentId ? await this.getDepartment(employee.departmentId) : undefined;
    
    return {
      ...employee,
      user: user!,
      department: department!
    };
  }
  
  async getAllEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }
  
  async getAllEmployeesWithDetails(): Promise<EmployeeWithDetails[]> {
    const employees = Array.from(this.employees.values());
    const result: EmployeeWithDetails[] = [];
    
    for (const employee of employees) {
      const user = employee.userId ? await this.getUser(employee.userId) : undefined;
      const department = employee.departmentId ? await this.getDepartment(employee.departmentId) : undefined;
      
      if (user) {
        result.push({
          ...employee,
          user: user,
          department: department!
        });
      }
    }
    
    return result;
  }
  
  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const id = this.employeeIdCounter++;
    const newEmployee: Employee = { ...employee, id };
    this.employees.set(id, newEmployee);
    return newEmployee;
  }
  
  async updateEmployee(id: number, employeeData: Partial<Employee>): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    
    const updatedEmployee = { ...employee, ...employeeData };
    this.employees.set(id, updatedEmployee);
    return updatedEmployee;
  }
  
  async deleteEmployee(id: number): Promise<boolean> {
    // First delete all payrolls for this employee
    const payrolls = await this.getPayrollsByEmployeeId(id);
    for (const payroll of payrolls) {
      await this.deletePayroll(payroll.id);
    }
    
    return this.employees.delete(id);
  }
  
  // Payroll operations
  async getPayroll(id: number): Promise<Payroll | undefined> {
    return this.payrolls.get(id);
  }
  
  async getPayrollWithDetails(id: number): Promise<PayrollWithDetails | undefined> {
    const payroll = this.payrolls.get(id);
    if (!payroll) return undefined;
    
    const employee = await this.getEmployeeWithDetails(payroll.employeeId);
    if (!employee) return undefined;
    
    return {
      ...payroll,
      employee
    };
  }
  
  async getAllPayrolls(): Promise<Payroll[]> {
    return Array.from(this.payrolls.values());
  }
  
  async getPayrollsByEmployeeId(employeeId: number): Promise<Payroll[]> {
    return Array.from(this.payrolls.values()).filter(
      (payroll) => payroll.employeeId === employeeId
    );
  }
  
  async getPayrollsByMonth(month: number, year: number): Promise<Payroll[]> {
    return Array.from(this.payrolls.values()).filter(
      (payroll) => payroll.month === month && payroll.year === year
    );
  }
  
  async getRecentPayrolls(limit: number): Promise<PayrollWithDetails[]> {
    const payrolls = Array.from(this.payrolls.values())
      .sort((a, b) => {
        // Sort by processed date if available, otherwise by ID (most recent first)
        const dateA = a.processedAt ? new Date(a.processedAt).getTime() : 0;
        const dateB = b.processedAt ? new Date(b.processedAt).getTime() : 0;
        return dateB - dateA || b.id - a.id;
      })
      .slice(0, limit);
    
    const result: PayrollWithDetails[] = [];
    
    for (const payroll of payrolls) {
      const employee = await this.getEmployeeWithDetails(payroll.employeeId);
      if (employee) {
        result.push({
          ...payroll,
          employee
        });
      }
    }
    
    return result;
  }
  
  async createPayroll(payroll: InsertPayroll): Promise<Payroll> {
    const id = this.payrollIdCounter++;
    const newPayroll: Payroll = { 
      ...payroll, 
      id,
      processedAt: new Date()
    };
    this.payrolls.set(id, newPayroll);
    return newPayroll;
  }
  
  async updatePayroll(id: number, payrollData: Partial<Payroll>): Promise<Payroll | undefined> {
    const payroll = this.payrolls.get(id);
    if (!payroll) return undefined;
    
    const updatedPayroll = { ...payroll, ...payrollData };
    this.payrolls.set(id, updatedPayroll);
    return updatedPayroll;
  }
  
  async deletePayroll(id: number): Promise<boolean> {
    return this.payrolls.delete(id);
  }
  
  // Dashboard data
  async getDashboardSummary(): Promise<any> {
    const employees = await this.getAllEmployees();
    const payrolls = await this.getAllPayrolls();
    
    // Calculate total payroll for current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const currentMonthPayrolls = payrolls.filter(
      p => p.month === currentMonth && p.year === currentYear
    );
    
    const totalPayroll = currentMonthPayrolls.reduce(
      (sum, payroll) => sum + Number(payroll.netAmount), 
      0
    );
    
    // Calculate average salary
    const averageSalary = employees.length > 0 
      ? employees.reduce((sum, emp) => sum + Number(emp.baseSalary), 0) / employees.length
      : 0;
    
    // Count pending actions (pending payrolls)
    const pendingCount = payrolls.filter(p => p.status === 'pending').length;
    
    return {
      employeeCount: employees.length,
      totalPayroll,
      averageSalary,
      pendingCount
    };
  }
  
  async getDepartmentDistribution(): Promise<any> {
    const employees = await this.getAllEmployeesWithDetails();
    const departments = await this.getAllDepartments();
    
    const distribution = departments.map(dept => {
      const count = employees.filter(emp => emp.departmentId === dept.id).length;
      const percentage = employees.length > 0 
        ? Math.round((count / employees.length) * 100) 
        : 0;
      
      return {
        id: dept.id,
        name: dept.name,
        count,
        percentage
      };
    });
    
    return distribution.sort((a, b) => b.count - a.count);
  }
}

export const storage = new MemStorage();
