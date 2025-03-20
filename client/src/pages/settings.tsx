import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Header } from '@/components/ui/header';
import { Sidebar } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsIcon, Users, Building, Shield, FileText, Database } from 'lucide-react';
import { insertDepartmentSchema } from '@shared/schema';

// Schema for department form
const departmentFormSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters"),
  description: z.string().optional(),
});

type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

export default function Settings() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const { toast } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('departments');
  
  // Fetch departments
  const { data: departments = [], isLoading: isDepartmentsLoading, refetch: refetchDepartments } = useQuery({
    queryKey: ['http://localhost:5000/api/departments'],
  });
  
  // Department form
  const departmentForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  // Create department mutation
  const createDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormValues) => {
      await apiRequest('POST', 'http://localhost:5000/api/departments', data);
    },
    onSuccess: () => {
      toast({
        title: "Department created",
        description: "The department has been created successfully.",
      });
      departmentForm.reset({
        name: '',
        description: '',
      });
      queryClient.invalidateQueries({ queryKey: ['http://localhost:5000/api/departments'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create department",
        variant: "destructive",
      });
    },
  });
  
  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `http://localhost:5000/api/departments/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Department deleted",
        description: "The department has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['https://localhost:5000/api/departments'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete department",
        variant: "destructive",
      });
    },
  });
  
  const onDepartmentSubmit = async (values: DepartmentFormValues) => {
    await createDepartmentMutation.mutateAsync(values);
  };
  
  const handleDeleteDepartment = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      await deleteDepartmentMutation.mutateAsync(id);
    }
  };
  
  // Check if user is authenticated and is admin
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!isAuthenticated || !isAdmin) {
    navigate('/dashboard');
    return null;
  }
  
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold">System Settings</h1>
                <p className="text-muted-foreground">
                  Manage organization-wide settings and configurations
                </p>
              </div>
              
              <Tabs defaultValue="departments" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
                  <TabsTrigger value="departments" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span className="hidden md:inline">Departments</span>
                  </TabsTrigger>
                  {/* <TabsTrigger value="users" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden md:inline">Users</span>
                  </TabsTrigger>
                  <TabsTrigger value="security" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="hidden md:inline">Security</span>
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden md:inline">Reports</span>
                  </TabsTrigger>
                  <TabsTrigger value="backup" className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span className="hidden md:inline">Backup</span>
                  </TabsTrigger> */}
                </TabsList>
                
                <TabsContent value="departments" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Departments</CardTitle>
                      <CardDescription>
                        Manage the departments in your organization
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Add New Department</h3>
                        <Form {...departmentForm}>
                          <form onSubmit={departmentForm.handleSubmit(onDepartmentSubmit)} className="space-y-4">
                            <FormField
                              control={departmentForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Department Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="e.g. Human Resources" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={departmentForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description (Optional)</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      {...field} 
                                      placeholder="Describe the purpose of this department"
                                      value={field.value || ''}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <Button 
                              type="submit" 
                              disabled={createDepartmentMutation.isPending}
                            >
                              {createDepartmentMutation.isPending ? 'Adding...' : 'Add Department'}
                            </Button>
                          </form>
                        </Form>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Existing Departments</h3>
                        {isDepartmentsLoading ? (
                          <p>Loading departments...</p>
                        ) : departments.length === 0 ? (
                          <p className="text-muted-foreground">No departments found</p>
                        ) : (
                          <div className="space-y-2">
                            {departments.map((dept: any) => (
                              <Card key={dept.id} className="p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-medium">{dept.name}</h4>
                                    {dept.description && (
                                      <p className="text-sm text-muted-foreground">{dept.description}</p>
                                    )}
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleDeleteDepartment(dept.id)}
                                    disabled={deleteDepartmentMutation.isPending}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="users" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>User Management</CardTitle>
                      <CardDescription>
                        Manage users and their access levels
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-center py-8 text-muted-foreground">
                        User management functionality will be implemented in a future update.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="security" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security Settings</CardTitle>
                      <CardDescription>
                        Configure security options for your organization
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <h4 className="font-medium">Two-Factor Authentication</h4>
                          <p className="text-sm text-muted-foreground">
                            Require two-factor authentication for all admin users
                          </p>
                        </div>
                        <Switch disabled />
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <h4 className="font-medium">Password Complexity</h4>
                          <p className="text-sm text-muted-foreground">
                            Require complex passwords with special characters
                          </p>
                        </div>
                        <Switch checked disabled />
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <h4 className="font-medium">Session Timeout</h4>
                          <p className="text-sm text-muted-foreground">
                            Automatically log users out after inactivity
                          </p>
                        </div>
                        <Switch checked disabled />
                      </div>
                      
                      <p className="text-center py-4 text-muted-foreground">
                        Advanced security settings will be implemented in a future update.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="reports" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Report Settings</CardTitle>
                      <CardDescription>
                        Configure system-wide report settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-center py-8 text-muted-foreground">
                        Report configuration will be implemented in a future update.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="backup" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Backup & Restore</CardTitle>
                      <CardDescription>
                        Configure backup settings and restore from backups
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <Button disabled>Export Database</Button>
                        <p className="text-sm text-muted-foreground">
                          This feature will be implemented in a future update when persistent storage is utilized.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
