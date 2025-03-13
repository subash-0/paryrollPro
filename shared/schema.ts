import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric, date, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  role: text("role").default("employee").notNull(), // 'admin' or 'employee'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  departmentId: integer("department_id").references(() => departments.id),
  position: text("position").notNull(),
  taxId: text("tax_id").notNull(),
  taxStatus: text("tax_status").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  routingNumber: text("routing_number").notNull(),
  baseSalary: numeric("base_salary", { precision: 10, scale: 2 }).notNull(),
  joinDate: date("join_date").notNull(),
  status: text("status").default("active").notNull(), // 'active', 'inactive', 'terminated'
});

export const payrolls = pgTable("payrolls", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  grossAmount: numeric("gross_amount", { precision: 10, scale: 2 }).notNull(),
  taxDeductions: numeric("tax_deductions", { precision: 10, scale: 2 }).notNull(),
  otherDeductions: numeric("other_deductions", { precision: 10, scale: 2 }).default("0"),
  netAmount: numeric("net_amount", { precision: 10, scale: 2 }).notNull(),
  bonuses: numeric("bonuses", { precision: 10, scale: 2 }).default("0"),
  status: text("status").default("pending").notNull(), // 'pending', 'completed', 'failed'
  details: jsonb("details"), // Additional payment details
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => users.id),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const loginUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
});

export const insertPayrollSchema = createInsertSchema(payrolls).omit({
  id: true,
  processedAt: true
});

// Types for database operations
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type User = typeof users.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Payroll = typeof payrolls.$inferSelect;
export type InsertPayroll = z.infer<typeof insertPayrollSchema>;

// Extended types for frontend usage
export type EmployeeWithDetails = Employee & {
  user: User;
  department: Department;
};

export type PayrollWithDetails = Payroll & {
  employee: EmployeeWithDetails;
};
