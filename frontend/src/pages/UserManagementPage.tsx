import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { UserRole, UserStatus, DepartmentResponseDto } from '@healthclaim/shared';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  UserPlus,
  Users,
  Filter,
  Building2,
  Plus,
  Trash2,
  Power,
  Check,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
  Pencil,
  KeyRound,
} from 'lucide-react';

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  department?: string | null;
  benefitTier: string;
  remainingBalance: number;
  annualLimit: number;
  createdAt: string;
}

interface BenefitTierItem {
  id: string;
  name: string;
  code: string;
  annualLimit: number;
}

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tiers, setTiers] = useState<BenefitTierItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [statusCounts, setStatusCounts] = useState<{
    all: number;
    active: number;
    inactive: number;
    suspended: number;
  }>({ all: 0, active: 0, inactive: 0, suspended: 0 });

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // New User Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Password123!');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [newTierId, setNewTierId] = useState('');
  const [creating, setCreating] = useState(false);

  // Department Management Modal
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  // Assign Tier Modal
  const [assignModalUser, setAssignModalUser] = useState<UserRecord | null>(null);
  const [selectedTierId, setSelectedTierId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Edit User Profile & Credentials Modal
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [editStatus, setEditStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [editResetPassword, setEditResetPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleOpenEditModal = (u: UserRecord) => {
    setEditingUser(u);
    setEditFirstName(u.firstName);
    setEditLastName(u.lastName);
    setEditEmail(u.email);
    setEditDepartment(u.department || (departments[0]?.name || ''));
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditResetPassword('');
    setEditUserModalOpen(true);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      await apiClient.patch(`/users/${editingUser.id}/admin-profile`, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim(),
        department: editDepartment || undefined,
        role: editRole,
        status: editStatus,
        resetPassword: editResetPassword.trim() || undefined,
      });
      toast.success(`Member profile for ${editEmail} updated successfully`);
      setEditUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member profile');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleQuickActivate = async (u: UserRecord) => {
    try {
      await apiClient.patch(`/users/${u.id}/status`, {
        status: UserStatus.ACTIVE,
      });
      toast.success(`Account for ${u.firstName} ${u.lastName} (${u.email}) is now ACTIVE!`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate user');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      if (search.trim()) params.append('search', search.trim());
      if (roleFilter && roleFilter !== 'ALL') params.append('role', roleFilter);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);

      const data = await apiClient.get<
        any,
        {
          items: UserRecord[];
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
          counts?: { all: number; active: number; inactive: number; suspended: number };
        }
      >(`/users?${params.toString()}`);
      setUsers(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.counts) {
        setStatusCounts(data.counts);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await apiClient.get<any, DepartmentResponseDto[]>('/departments/admin');
      setDepartments(data);
      if (data.length > 0 && !newDepartment) {
        setNewDepartment(data[0].name);
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const fetchTiers = async () => {
    try {
      const data = await apiClient.get<any, BenefitTierItem[]>('/policies/tiers');
      setTiers(data);
      if (data.length > 0) {
        setNewTierId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load tiers', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, roleFilter, statusFilter]);

  useEffect(() => {
    fetchTiers();
    fetchDepartments();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await apiClient.patch(`/users/${userId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptCode.trim() || !newDeptName.trim()) return;
    setSavingDept(true);
    try {
      await apiClient.post('/departments', {
        code: newDeptCode.trim().toUpperCase(),
        name: newDeptName.trim(),
        description: newDeptDesc.trim() || undefined,
      });
      toast.success(`Department '${newDeptName}' created successfully`);
      setNewDeptCode('');
      setNewDeptName('');
      setNewDeptDesc('');
      await fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create department');
    } finally {
      setSavingDept(false);
    }
  };

  const handleToggleDeptStatus = async (dept: DepartmentResponseDto) => {
    try {
      await apiClient.patch(`/departments/${dept.id}`, {
        isActive: !dept.isActive,
      });
      toast.success(`Department '${dept.name}' ${dept.isActive ? 'deactivated' : 'activated'}`);
      await fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update department');
    }
  };

  const handleDeleteDept = async (dept: DepartmentResponseDto) => {
    try {
      const res = await apiClient.delete<any, any>(`/departments/${dept.id}`);
      toast.success(res.message || `Department deleted`);
      await fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete department');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiClient.post('/users', {
        email: newEmail,
        password: newPassword,
        firstName: newFirstName,
        lastName: newLastName,
        department: newDepartment || undefined,
        role: newRole,
        benefitTierId: newRole === UserRole.EMPLOYEE ? newTierId || undefined : undefined,
      });
      setIsModalOpen(false);
      toast.success(`User ${newEmail} created successfully`);
      setNewEmail('');
      setNewFirstName('');
      setNewLastName('');
      setNewDepartment(departments.length > 0 ? departments[0].name : '');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleAssignTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalUser || !selectedTierId) return;
    setAssigning(true);
    try {
      await apiClient.post('/policies/assign', {
        userId: assignModalUser.id,
        benefitTierId: selectedTierId,
        fiscalYear: new Date().getFullYear(),
      });
      setAssignModalUser(null);
      toast.success(`Benefit tier reassigned successfully`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign tier');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#0a2540] flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-700" />
            User Management & RBAC
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage enterprise member accounts, privilege tiers, and corporate departments.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setDeptModalOpen(true)}
            className="gap-2"
          >
            <Building2 className="h-4 w-4" />
            <span>Manage Departments</span>
          </Button>

          <Button
            onClick={() => setIsModalOpen(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Member</span>
          </Button>
        </div>
      </div>

      {/* Account Status Tabs */}
      <div className="flex border-b border-slate-200 gap-1 sm:gap-4 overflow-x-auto">
        {[
          { key: 'ALL', label: 'All Accounts', count: statusCounts.all, color: 'bg-slate-100 text-slate-700' },
          { key: UserStatus.INACTIVE, label: 'Pending Activation', count: statusCounts.inactive, color: 'bg-amber-100 text-amber-800' },
          { key: UserStatus.ACTIVE, label: 'Active', count: statusCounts.active, color: 'bg-emerald-100 text-emerald-800' },
          { key: UserStatus.SUSPENDED, label: 'Suspended', count: statusCounts.suspended, color: 'bg-rose-100 text-rose-800' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === tab.key
                ? 'border-[#0a2540] text-[#0a2540]'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${tab.color}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full sm:w-auto">
          <Search className="h-4 w-4 absolute left-3.5 top-2.5 text-slate-400" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or department..."
            className="pl-9"
          />
        </form>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Role Filter:</span>
          <div className="w-40">
            <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value={UserRole.EMPLOYEE}>Employee</SelectItem>
                <SelectItem value={UserRole.CLAIM_OFFICER}>Claim Officer</SelectItem>
                <SelectItem value={UserRole.FINANCE_MANAGER}>Finance Manager</SelectItem>
                <SelectItem value={UserRole.SYSTEM_ADMIN}>System Admin</SelectItem>
                <SelectItem value={UserRole.SECURITY_AUDITOR}>Security Auditor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold tracking-wider uppercase text-[11px]">
                <th className="py-3.5 px-5">Member</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">RBAC Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Benefit Plan</th>
                <th className="py-3.5 px-4">Remaining / Quota</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No members found matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                    <td className="py-3.5 px-5">
                      <div>
                        <p className="font-semibold text-slate-950 text-xs">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {u.department || '—'}
                    </td>
                    <td className="py-3.5 px-4 w-48 min-w-[180px]">
                      <Select
                        value={u.role}
                        onValueChange={(val) => handleRoleChange(u.id, val as UserRole)}
                      >
                        <SelectTrigger className="h-8 px-2.5 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UserRole.EMPLOYEE}>Employee</SelectItem>
                          <SelectItem value={UserRole.CLAIM_OFFICER}>Claim Officer</SelectItem>
                          <SelectItem value={UserRole.FINANCE_MANAGER}>Finance Manager</SelectItem>
                          <SelectItem value={UserRole.SYSTEM_ADMIN}>System Admin</SelectItem>
                          <SelectItem value={UserRole.SECURITY_AUDITOR}>Security Auditor</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.status === UserStatus.ACTIVE && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      )}
                      {u.status === UserStatus.INACTIVE && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Pending Activation
                        </span>
                      )}
                      {u.status === UserStatus.SUSPENDED && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {u.role === UserRole.EMPLOYEE ? (
                        u.benefitTier
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.role === UserRole.EMPLOYEE && u.annualLimit > 0 ? (
                        <div>
                          <span className="font-bold text-[#0a2540]">
                            ${u.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-slate-400 text-[11px]"> / ${u.annualLimit.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.status === UserStatus.INACTIVE && (
                          <Button
                            size="sm"
                            onClick={() => handleQuickActivate(u)}
                            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 shadow-xs cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Activate</span>
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(u)}
                          className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer bg-white"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </Button>

                        {u.role === UserRole.EMPLOYEE && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssignModalUser(u);
                              setSelectedTierId(tiers[0]?.id || '');
                            }}
                            className="h-7 px-2.5 text-xs cursor-pointer bg-white"
                          >
                            Change Tier
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="bg-slate-50/60 border-t border-slate-200/80 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-500">
            <span>
              Showing <strong className="text-slate-800">{users.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{' '}
              <strong className="text-slate-800">{Math.min(page * pageSize, total)}</strong> of{' '}
              <strong className="text-slate-800">{total}</strong> members
            </span>
            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <span className="text-[11px]">Rows per page:</span>
              <div className="w-16">
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px] font-mono mr-2">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-7 px-2 text-xs gap-1 bg-white cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-7 px-2 text-xs gap-1 bg-white cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Add Enterprise Member
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-3.5 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <Input
                  type="text"
                  required
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <Input
                  type="text"
                  required
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <Input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@healthclaim.pro"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password</label>
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Department</label>
              <Select
                value={newDepartment}
                onValueChange={setNewDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select corporate department" />
                </SelectTrigger>
                <SelectContent>
                  {departments
                    .filter((d) => d.isActive)
                    .map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        <span>{dept.name}</span>
                        <span className="ml-2 text-[10px] text-slate-400 font-mono">({dept.code})</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Enterprise Role</label>
              <Select
                value={newRole}
                onValueChange={(val) => setNewRole(val as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.EMPLOYEE}>Employee</SelectItem>
                  <SelectItem value={UserRole.CLAIM_OFFICER}>Claim Officer</SelectItem>
                  <SelectItem value={UserRole.FINANCE_MANAGER}>Finance Manager</SelectItem>
                  <SelectItem value={UserRole.SYSTEM_ADMIN}>System Admin</SelectItem>
                  <SelectItem value={UserRole.SECURITY_AUDITOR}>Security Auditor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newRole === UserRole.EMPLOYEE && tiers.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Benefit Plan</label>
                <Select
                  value={newTierId}
                  onValueChange={(val) => setNewTierId(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} (${t.annualLimit.toLocaleString()}/yr)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Tier Dialog */}
      <Dialog open={!!assignModalUser} onOpenChange={(open) => !open && setAssignModalUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Benefit Plan</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAssignTier} className="space-y-4 mt-2">
            <div>
              <p className="text-xs text-slate-500 mb-3">
                Select tier plan for <strong>{assignModalUser?.email}</strong>
              </p>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Benefit Plan Tier</label>
              <Select
                value={selectedTierId}
                onValueChange={(val) => setSelectedTierId(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} (${t.annualLimit.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignModalUser(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={assigning}
              >
                {assigning ? 'Saving...' : 'Confirm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Department Management Dialog */}
      <Dialog open={deptModalOpen} onOpenChange={setDeptModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#0a2540]">
              <Building2 className="h-5 w-5 text-slate-700" />
              Corporate Department Directory & Governance
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Configure organizational units and define selectable departments for enterprise accounts.
            </p>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Quick Add Department Form */}
            <form onSubmit={handleCreateDepartment} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-[#00a88f]" />
                Add New Corporate Department
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Code (e.g. DATA)</label>
                  <Input
                    type="text"
                    required
                    placeholder="ENG"
                    value={newDeptCode}
                    onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Department Name</label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Data Science & Analytics"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Description (Optional)</label>
                <Input
                  type="text"
                  placeholder="Responsibilities & scope"
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingDept || !newDeptCode.trim() || !newDeptName.trim()}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {savingDept ? 'Creating...' : 'Add Department'}
                </Button>
              </div>
            </form>

            {/* Existing Departments Table */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Code / Name</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Members</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                        No departments found. Add one above.
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-slate-900 text-xs">{dept.name}</span>
                          <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                            {dept.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[160px]">
                          {dept.description || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            {dept.userCount || 0}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {dept.isActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleDeptStatus(dept)}
                              title={dept.isActive ? 'Deactivate department' : 'Activate department'}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                dept.isActive
                                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDept(dept)}
                              title="Delete department"
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Member Profile & Credentials Dialog */}
      <Dialog open={editUserModalOpen} onOpenChange={setEditUserModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#0a2540]">
              <Pencil className="h-4 w-4 text-slate-700" />
              Edit Member Profile & Credentials
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Update personal identity, corporate department, RBAC role, and account credentials.
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveEditUser} className="space-y-3.5 mt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <Input
                  type="text"
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <Input
                  type="text"
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email</label>
              <Input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Department</label>
              <Select
                value={editDepartment}
                onValueChange={setEditDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select corporate department" />
                </SelectTrigger>
                <SelectContent>
                  {/* Keep current custom department if not in list */}
                  {editDepartment && !departments.some((d) => d.name === editDepartment) && (
                    <SelectItem value={editDepartment}>
                      <span>{editDepartment}</span>
                      <span className="ml-2 text-[10px] text-slate-400 font-mono">(Custom)</span>
                    </SelectItem>
                  )}
                  {departments
                    .filter((d) => d.isActive)
                    .map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        <span>{dept.name}</span>
                        <span className="ml-2 text-[10px] text-slate-400 font-mono">({dept.code})</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Enterprise Role</label>
                <Select
                  value={editRole}
                  onValueChange={(val) => setEditRole(val as UserRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.EMPLOYEE}>Employee</SelectItem>
                    <SelectItem value={UserRole.CLAIM_OFFICER}>Claim Officer</SelectItem>
                    <SelectItem value={UserRole.FINANCE_MANAGER}>Finance Manager</SelectItem>
                    <SelectItem value={UserRole.SYSTEM_ADMIN}>System Admin</SelectItem>
                    <SelectItem value={UserRole.SECURITY_AUDITOR}>Security Auditor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                <Select
                  value={editStatus}
                  onValueChange={(val) => setEditStatus(val as UserStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserStatus.ACTIVE}>Active</SelectItem>
                    <SelectItem value={UserStatus.SUSPENDED}>Suspended</SelectItem>
                    <SelectItem value={UserStatus.INACTIVE}>Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-[11px]">
                <KeyRound className="h-3.5 w-3.5" />
                Force Password Reset (Optional)
              </div>
              <Input
                type="password"
                placeholder="Leave blank to keep existing password"
                value={editResetPassword}
                onChange={(e) => setEditResetPassword(e.target.value)}
                className="h-8 text-xs bg-white"
              />
              <p className="text-[10px] text-amber-700/80 leading-tight">
                Entering a new password will immediately override this user's login credentials.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditUserModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
              >
                {savingEdit ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
